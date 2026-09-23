<?php
declare(strict_types=1);

require __DIR__ . '/backend/bootstrap.php';
require __DIR__ . '/backend/manager-push.php';

$route = trim((string)($_GET['__route'] ?? ''), '/');
unset($_GET['__route']);
$method = kd_method();

if ($route === 'health') {
    $configured = kd_is_configured();
    $db = false;
    $error = '';
    if ($configured) {
        try {
            kd_db()->query('SELECT 1')->fetchColumn();
            $db = true;
        } catch (Throwable $e) {
            $error = $e->getMessage();
        }
    }
    kd_json(['ok' => true, 'backend' => 'timeweb-php', 'configured' => $configured, 'db' => $db, 'error' => $error]);
}

if (!kd_is_configured()) kd_json(['error' => 'PHP/MySQL backend ещё не настроен', 'backend' => 'timeweb-php'], 503);

try {
    if ($route === 'offline-version' && $method === 'GET') {
        header('Cache-Control: no-store, max-age=0');
        kd_json(kd_offline_version());
    }

    if ($route === 'catalog-images' && $method === 'GET') {
        kd_json(['galleries' => kd_all_galleries(false)]);
    }

    if ($route === 'delivery' && $method === 'GET') {
        kd_json(kd_delivery_quote((string)($_GET['place'] ?? '')));
    }

    if ($route === 'share-link' && $method === 'GET') {
        kd_public_share_link((string)($_GET['code'] ?? ''));
    }

    if ($route === 'leads') {
        if ($method !== 'POST') kd_json(['error' => 'Метод не поддерживается'], 405);
        kd_require_same_origin();
        kd_create_lead();
    }

    if ($route === 'admin/login') {
        if ($method !== 'POST') kd_json(['error' => 'Метод не поддерживается'], 405);
        kd_require_same_origin();
        kd_admin_login();
    }

    if ($route === 'admin/logout') {
        if ($method !== 'POST') kd_json(['error' => 'Метод не поддерживается'], 405);
        kd_require_same_origin();
        kd_require_admin();
        kd_logout_admin();
        kd_json(['ok' => true]);
    }

    if ($route === 'admin/manager-push-key' && $method === 'GET') {
        kd_require_admin();
        kd_manager_push_key_response();
    }

    if ($route === 'admin/manager-push-subscriptions') {
        if ($method !== 'POST' && $method !== 'DELETE') kd_json(['error' => 'Метод не поддерживается'], 405);
        kd_require_same_origin();
        $session = kd_require_admin();
        if ($method === 'POST') kd_manager_push_subscription_save((int)$session['admin_id']);
        kd_manager_push_subscription_delete((int)$session['admin_id']);
    }

    if ($route === 'admin/manager-push-test' && $method === 'POST') {
        kd_require_same_origin();
        $session = kd_require_admin();
        kd_manager_push_test((int)$session['admin_id']);
    }

    if ($route === 'admin/manager-push-status' && $method === 'POST') {
        kd_require_same_origin();
        $session = kd_require_admin();
        kd_manager_push_status((int)$session['admin_id']);
    }

    if (str_starts_with($route, 'admin/')) {
        if ($method !== 'GET') kd_require_same_origin();
        kd_require_admin();
        kd_handle_admin($route, $method);
    }

    if (str_starts_with($route, 'catalog-media/')) {
        if ($method !== 'GET' && $method !== 'HEAD') kd_json(['error' => 'Метод не поддерживается'], 405);
        kd_serve_media(substr($route, strlen('catalog-media/')), $method === 'HEAD');
    }

    kd_json(['error' => 'Маршрут не найден'], 404);
} catch (Throwable $e) {
    error_log('Kuzdvor Timeweb API: ' . $e->getMessage());
    kd_json(['error' => 'Ошибка серверной части сайта', 'detail' => $e->getMessage()], 500);
}

function kd_offline_version(): array
{
    $sourceSha = '';
    $versionFile = __DIR__ . '/deployment-version.json';
    if (is_file($versionFile)) {
        $raw = json_decode((string)file_get_contents($versionFile), true);
        if (is_array($raw)) $sourceSha = (string)($raw['sourceSha'] ?? '');
    }

    $keys = ['site_profile','prices','delivery_prices','catalog_color_photos','gate_excel_prices'];
    $placeholders = implode(',', array_fill(0, count($keys), '?'));
    $settingsStmt = kd_db()->prepare("SELECT COALESCE(DATE_FORMAT(MAX(updated_at),'%Y-%m-%dT%H:%i:%sZ'),'') FROM site_settings WHERE `key` IN ($placeholders)");
    $settingsStmt->execute($keys);
    $settingsUpdatedAt = (string)$settingsStmt->fetchColumn();

    $catalogUpdatedAt = (string)kd_db()->query("SELECT COALESCE(DATE_FORMAT(MAX(updated_at),'%Y-%m-%dT%H:%i:%sZ'),'') FROM catalog_galleries")->fetchColumn();
    $version = hash('sha256', implode('|', [$sourceSha, $settingsUpdatedAt, $catalogUpdatedAt]));

    return [
        'version' => $version,
        'source' => $sourceSha,
        'settingsUpdatedAt' => $settingsUpdatedAt,
        'catalogUpdatedAt' => $catalogUpdatedAt,
    ];
}

function kd_admin_login(): never
{
    kd_body_limit(4096);
    $ip = kd_client_ip();
    $limit = kd_db()->prepare('SELECT attempt_count,reset_at FROM login_rate_limits WHERE ip_key = ? LIMIT 1');
    $limit->execute([$ip]);
    $row = $limit->fetch();
    if ($row && strtotime((string)$row['reset_at'] . ' UTC') > time() && (int)$row['attempt_count'] >= 5) {
        kd_json(['error' => 'Слишком много попыток. Попробуйте через 15 минут.'], 429, ['Retry-After' => '900']);
    }

    $body = kd_json_body(4096);
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    $stmt = kd_db()->prepare('SELECT id,username,password_hash FROM admin_auth WHERE username = ? LIMIT 1');
    $stmt->execute([$username]);
    $admin = $stmt->fetch();
    if (!$admin || !password_verify($password, (string)$admin['password_hash'])) {
        $resetAt = gmdate('Y-m-d H:i:s', time() + 900);
        $upsert = kd_db()->prepare('INSERT INTO login_rate_limits (ip_key,attempt_count,reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE attempt_count=IF(reset_at<=UTC_TIMESTAMP(),1,attempt_count+1),reset_at=IF(reset_at<=UTC_TIMESTAMP(),VALUES(reset_at),reset_at)');
        $upsert->execute([$ip, $resetAt]);
        kd_json(['error' => 'Неверный логин или пароль'], 401);
    }
    kd_db()->prepare('DELETE FROM login_rate_limits WHERE ip_key = ?')->execute([$ip]);
    if (password_needs_rehash((string)$admin['password_hash'], PASSWORD_DEFAULT)) {
        kd_db()->prepare('UPDATE admin_auth SET password_hash = ?,updated_at=UTC_TIMESTAMP() WHERE id = ?')->execute([password_hash($password, PASSWORD_DEFAULT), (int)$admin['id']]);
    }
    kd_create_admin_session((int)$admin['id']);
    kd_json(['ok' => true]);
}

function kd_delivery_quote(string $place): array
{
    $place = preg_replace('/\s+/u', ' ', trim($place)) ?? '';
    if (mb_strlen($place, 'UTF-8') < 2 || mb_strlen($place, 'UTF-8') > 100) {
        kd_json(['error' => 'Укажите название населённого пункта'], 400);
    }
    $settings = kd_delivery_settings();
    $site = kd_site_profile();
    $rate = max(0, (int)($site['deliveryRate'] ?? $settings['fallbackRatePerKm'] ?? 90));
    $serviceArea = max(0, (int)($site['serviceAreaKm'] ?? 150));
    foreach (($settings['destinations'] ?? []) as $item) {
        if (kd_normalize_name((string)($item['name'] ?? '')) === kd_normalize_name($place)) {
            return [
                'price' => max(0, (int)($item['price'] ?? 0)),
                'distanceKm' => null,
                'shortName' => (string)($item['name'] ?? $place),
                'serviceAreaKm' => $serviceArea,
                'outOfArea' => false,
                'resolved' => true,
                'source' => 'fixed',
            ];
        }
    }

    $origin = $settings['origin'] ?? ['lat' => 52.96328, 'lon' => 55.928612, 'name' => 'Мелеуз'];
    $searchUrl = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
        'q' => $place . ', Россия', 'format' => 'jsonv2', 'addressdetails' => '1', 'accept-language' => 'ru', 'countrycodes' => 'ru', 'limit' => '5'
    ]);
    $results = kd_http_json($searchUrl, ['User-Agent: KuznechnyDvorikDeliveryCalculator/2.0 (https://kuzdvor.tw1.ru)']);
    if (!is_array($results) || !$results) kd_json(['error' => 'Населённый пункт не найден. Уточните название или добавьте район.'], 404);
    $best = null;
    $bestDistance = INF;
    foreach ($results as $candidate) {
        $lat = (float)($candidate['lat'] ?? 0);
        $lon = (float)($candidate['lon'] ?? 0);
        if (!$lat || !$lon) continue;
        $distance = kd_haversine((float)($origin['lat'] ?? 52.96328), (float)($origin['lon'] ?? 55.928612), $lat, $lon);
        if ($distance < $bestDistance) { $bestDistance = $distance; $best = $candidate; }
    }
    if (!$best) kd_json(['error' => 'Населённый пункт не найден.'], 404);
    $lat = (float)$best['lat'];
    $lon = (float)$best['lon'];
    $routeUrl = sprintf('https://router.project-osrm.org/route/v1/driving/%F,%F;%F,%F?overview=false&alternatives=false&steps=false',
        (float)($origin['lon'] ?? 55.928612), (float)($origin['lat'] ?? 52.96328), $lon, $lat);
    $route = kd_http_json($routeUrl, ['User-Agent: KuznechnyDvorikDeliveryCalculator/2.0 (https://kuzdvor.tw1.ru)']);
    $meters = (float)($route['routes'][0]['distance'] ?? 0);
    if ($meters <= 0) kd_json(['error' => 'Не удалось построить автомобильный маршрут до этого пункта'], 503);
    $distanceKm = (int)ceil($meters / 1000);
    $address = is_array($best['address'] ?? null) ? $best['address'] : [];
    $shortName = (string)($best['name'] ?? $address['city'] ?? $address['town'] ?? $address['village'] ?? $place);
    $outOfArea = $serviceArea > 0 && $distanceKm > $serviceArea;
    return [
        'price' => $outOfArea ? null : $distanceKm * $rate,
        'distanceKm' => $distanceKm,
        'shortName' => $shortName,
        'serviceAreaKm' => $serviceArea,
        'outOfArea' => $outOfArea,
        'resolved' => !$outOfArea,
        'source' => 'route',
    ];
}

function kd_http_json(string $url, array $headers = []): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 25, CURLOPT_HTTPHEADER => $headers]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($raw === false || $status < 200 || $status >= 300) throw new RuntimeException($error !== '' ? $error : 'Внешний сервис вернул HTTP ' . $status);
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) throw new RuntimeException('Внешний сервис вернул некорректный ответ');
    return $data;
}

function kd_haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
}

function kd_create_lead(): never
{
    $body = kd_json_body(32768);
    if (!empty($body['website']) || !empty($body['companyWebsite'])) kd_json(['ok' => true, 'id' => null], 201);
    $phone = trim((string)($body['phone'] ?? ''));
    $digits = preg_replace('/\D/', '', $phone) ?? '';
    $city = trim((string)($body['city'] ?? ''));
    $message = trim((string)($body['message'] ?? ''));
    $consent = ($body['consent'] ?? false) === true;
    if (strlen($digits) < 10 || strlen($digits) > 11) kd_json(['error' => 'Укажите корректный номер телефона'], 400);
    if (!$consent) kd_json(['error' => 'Подтвердите согласие на обработку персональных данных'], 400);
    if ($city === '' || $message === '') kd_json(['error' => 'В заявке не хватает обязательных данных'], 400);

    $category = (string)($body['category'] ?? 'gates');
    if (!in_array($category, ['gates','canopy','forged-fence','profsheet-fence','picket-fence'], true)) $category = 'gates';
    $clientTotal = max(0, min(10000000, (int)round((float)($body['total'] ?? 0))));
    $delivery = null;
    try { $delivery = kd_delivery_quote($city); } catch (Throwable) { $delivery = null; }
    $config = is_array($body['configuration'] ?? null) ? $body['configuration'] : [];
    foreach (['article','width','height','wicketWidth','wicketHeight','install','posts','color'] as $key) {
        if (array_key_exists($key, $body)) $config[$key] = $body[$key];
    }
    $configJson = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';
    if (strlen($configJson) > 8000) kd_json(['error' => 'Слишком много параметров в заявке'], 413);

    $stmt = kd_db()->prepare('INSERT INTO site_leads (created_at,updated_at,status,name,phone,city,category,source,article,product_title,configuration_json,width,wicket_width,wicket_height,height,install,posts,color,total,client_total,quote_verified,delivery_pending,delivery_out_of_area,delivery_distance_km,consent,consent_at,policy_version,comment,message) VALUES (UTC_TIMESTAMP(),UTC_TIMESTAMP(),\'new\',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,1,UTC_TIMESTAMP(),?,?,?)');
    $deliveryPending = !$delivery || !($delivery['resolved'] ?? false);
    $stmt->execute([
        mb_substr(trim((string)($body['name'] ?? '')),0,100), $phone, mb_substr($city,0,150), $category,
        mb_substr(trim((string)($body['source'] ?? '')),0,100), mb_substr(trim((string)($body['article'] ?? '')),0,50),
        mb_substr(trim((string)($body['productTitle'] ?? ($category === 'gates' ? 'Ворота с калиткой' : ''))),0,120), $configJson,
        kd_nullable_number($body['width'] ?? null), kd_nullable_number($body['wicketWidth'] ?? null), kd_nullable_number($body['wicketHeight'] ?? null), kd_nullable_number($body['height'] ?? null),
        !empty($body['install']) ? 1 : 0, !empty($body['posts']) ? 1 : 0, mb_substr(trim((string)($body['color'] ?? '')),0,100),
        $clientTotal, $clientTotal, $deliveryPending ? 1 : 0, !empty($delivery['outOfArea']) ? 1 : 0, $delivery['distanceKm'] ?? null,
        mb_substr(trim((string)($body['policyVersion'] ?? '')),0,64), mb_substr(trim((string)($body['comment'] ?? '')),0,1000), mb_substr($message,0,8000)
    ]);
    $leadId = (int)kd_db()->lastInsertId();
    register_shutdown_function(static function() use ($leadId): void {
        kd_send_manager_push_notifications($leadId);
    });
    kd_json(['ok' => true, 'id' => $leadId, 'quote' => ['total' => $clientTotal, 'verified' => false, 'deliveryPending' => $deliveryPending]], 201);
}

function kd_nullable_number(mixed $value): ?float
{
    if ($value === null || $value === '') return null;
    $number = filter_var($value, FILTER_VALIDATE_FLOAT);
    return $number === false ? null : (float)$number;
}

function kd_share_link_payload(array $body): array
{
    $city = preg_replace('/\s+/u', ' ', trim((string)($body['city'] ?? ''))) ?? '';
    if ($city === '' || mb_strlen($city, 'UTF-8') > 160) kd_json(['error' => 'Не указан населённый пункт'], 400);

    $payload = [
        'city' => mb_substr($city, 0, 160),
        'name' => mb_substr(trim((string)($body['name'] ?? $city)), 0, 120),
        'place' => mb_substr(trim((string)($body['place'] ?? $city)), 0, 220),
        'posts' => ((string)($body['posts'] ?? 'own')) === 'new' ? 'new' : 'own',
    ];

    foreach ([['gw',.8,8],['gh',1,3],['ww',.7,2.5],['wh',1,3]] as [$key,$min,$max]) {
        if (!array_key_exists($key, $body) || $body[$key] === '' || $body[$key] === null) continue;
        $value = filter_var($body[$key], FILTER_VALIDATE_FLOAT);
        if ($value === false || $value < $min || $value > $max) kd_json(['error' => 'Некорректные размеры в ссылке'], 400);
        $payload[$key] = (float)$value;
    }

    $art = trim((string)($body['art'] ?? ''));
    if ($art !== '') $payload['art'] = mb_substr(preg_replace('/^арт\.?\s*/iu', '', $art) ?? $art, 0, 20);
    return $payload;
}

function kd_admin_share_link_create(): never
{
    $body = kd_json_body(16384);
    $payload = kd_share_link_payload($body);
    $canonical = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($canonical === false) throw new RuntimeException('Не удалось подготовить короткую ссылку');
    $code = substr(hash('sha256', $canonical), 0, 12);
    kd_setting_set('client_share_' . $code, ['payload' => $payload, 'createdAt' => gmdate('c')], 'admin-share');
    kd_json(['ok' => true, 'code' => $code, 'url' => kd_current_origin() . '/?s=' . $code], 201);
}

function kd_public_share_link(string $code): never
{
    $code = strtolower(trim($code));
    if (!preg_match('/^[a-f0-9]{12}$/', $code)) kd_json(['error' => 'Ссылка некорректна'], 400);
    $stored = kd_setting_get('client_share_' . $code, null);
    $payload = is_array($stored) && is_array($stored['payload'] ?? null) ? $stored['payload'] : null;
    if (!$payload) kd_json(['error' => 'Ссылка не найдена'], 404);
    kd_json(['ok' => true, 'payload' => $payload]);
}

function kd_handle_admin(string $route, string $method): never
{
    if ($route === 'admin/site-settings') {
        if ($method === 'GET') kd_json(['site' => kd_site_profile()]);
        if ($method === 'POST') {
            $body = kd_json_body(65536); $site = is_array($body['site'] ?? null) ? $body['site'] : [];
            kd_setting_set('site_profile', array_replace(kd_default_site_profile(), $site), 'admin', true);
            kd_json(['ok' => true, 'site' => kd_site_profile()]);
        }
        kd_json(['error' => 'Метод не поддерживается'], 405);
    }

    if ($route === 'admin/prices') {
        if ($method === 'GET') kd_json(['prices' => kd_prices()]);
        if ($method === 'POST') {
            $body = kd_json_body(131072); $prices = is_array($body['prices'] ?? null) ? $body['prices'] : [];
            kd_setting_set('prices', $prices, 'admin', true); kd_json(['ok' => true, 'prices' => kd_prices()]);
        }
        kd_json(['error' => 'Метод не поддерживается'], 405);
    }

    if ($route === 'admin/delivery') {
        if ($method === 'GET') kd_json(['delivery' => kd_delivery_settings()]);
        if ($method === 'POST') {
            $body = kd_json_body(131072); $delivery = is_array($body['delivery'] ?? null) ? $body['delivery'] : [];
            kd_setting_set('delivery_prices', $delivery, 'admin', true); kd_json(['ok' => true, 'delivery' => kd_delivery_settings()]);
        }
        kd_json(['error' => 'Метод не поддерживается'], 405);
    }

    if ($route === 'admin/catalog' && $method === 'GET') {
        kd_json(['galleries' => kd_all_galleries(true), 'photoUploadEnabled' => true]);
    }

    if ($route === 'admin/upload' && $method === 'POST') {
        kd_catalog_upload((string)($_GET['article'] ?? ''));
    }

    if (str_starts_with($route, 'admin/catalog/')) {
        $article = rawurldecode(substr($route, strlen('admin/catalog/')));
        kd_catalog_save_or_reset($article, $method);
    }

    if (str_starts_with($route, 'admin/catalog-colors/')) {
        $article = rawurldecode(substr($route, strlen('admin/catalog-colors/')));
        $all = kd_setting_get('catalog_color_photos', []); if (!is_array($all)) $all = [];
        if ($method === 'GET') kd_json(['colorPhotos' => is_array($all[$article] ?? null) ? $all[$article] : []]);
        if ($method === 'POST') {
            $body = kd_json_body(32768); $colors = is_array($body['colorPhotos'] ?? null) ? $body['colorPhotos'] : [];
            $all[$article] = $colors; if (!$colors) unset($all[$article]);
            kd_setting_set('catalog_color_photos', $all, 'admin'); kd_json(['ok' => true, 'colorPhotos' => $colors]);
        }
        kd_json(['error' => 'Метод не поддерживается'], 405);
    }

    if (str_starts_with($route, 'admin/catalog-color-upload/') && $method === 'POST') {
        kd_catalog_color_upload(substr($route, strlen('admin/catalog-color-upload/')));
    }
    if (str_starts_with($route, 'admin/catalog-color-slot/') && $method === 'DELETE') {
        kd_catalog_color_delete(substr($route, strlen('admin/catalog-color-slot/')));
    }

    if ($route === 'admin/leads' && $method === 'GET') kd_admin_leads();
    if (str_starts_with($route, 'admin/leads/') && $method === 'POST') kd_admin_lead_status(substr($route, strlen('admin/leads/')));

    if ($route === 'admin/lead-workflows' && $method === 'GET') kd_admin_workflows();
    if (str_starts_with($route, 'admin/lead-workflows/') && $method === 'POST') kd_admin_workflow_save(substr($route, strlen('admin/lead-workflows/')));

    if ($route === 'admin/history' && $method === 'GET') kd_admin_history();
    if ($route === 'admin/history/restore' && $method === 'POST') kd_admin_history_restore();

    if ($route === 'admin/share-link' && $method === 'POST') kd_admin_share_link_create();

    if ($route === 'admin/gate-excel') kd_admin_gate_excel($method);
    if ($route === 'admin/gate-excel/file') kd_admin_gate_excel_file($method);

    if ($route === 'admin/media-cleanup' && $method === 'POST') kd_admin_media_cleanup();

    kd_json(['error' => 'Маршрут не найден'], 404);
}

function kd_allowed_article(string $article): bool
{
    return array_key_exists($article, kd_defaults()['catalogImages'] ?? []);
}

function kd_catalog_upload(string $article, bool $emit = true): array
{
    if (!kd_allowed_article($article)) kd_json(['error' => 'Модель не найдена'], 404);
    kd_body_limit(8 * 1024 * 1024);
    $type = strtolower(trim(explode(';', (string)($_SERVER['CONTENT_TYPE'] ?? ''))[0]));
    $ext = ['image/webp' => 'webp', 'image/jpeg' => 'jpg', 'image/png' => 'png'][$type] ?? null;
    if (!$ext) kd_json(['error' => 'Поддерживаются фотографии JPG, PNG и WebP'], 415);
    $bytes = file_get_contents('php://input');
    if ($bytes === false || $bytes === '' || strlen($bytes) > 8 * 1024 * 1024 || @getimagesizefromstring($bytes) === false) kd_json(['error' => 'Файл пустой, повреждён или слишком большой'], 413);
    $key = 'catalog/' . kd_article_slug($article) . '/' . bin2hex(random_bytes(16)) . '.' . $ext;
    $path = kd_media_path($key); if (!$path) kd_json(['error' => 'Некорректный путь файла'], 500);
    if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0700, true) && !is_dir(dirname($path))) throw new RuntimeException('Не удалось создать каталог фотографий');
    if (file_put_contents($path, $bytes, LOCK_EX) === false) throw new RuntimeException('Не удалось сохранить фотографию');
    @chmod($path, 0600);
    $result = ['photo' => ['url' => '/catalog-media/' . $key]];
    if ($emit) kd_json($result, 201);
    return $result;
}

function kd_catalog_save_or_reset(string $article, string $method): never
{
    if (!kd_allowed_article($article)) kd_json(['error' => 'Модель не найдена'], 404);
    if ($method === 'DELETE') {
        $old = kd_gallery_row($article);
        kd_db()->prepare('DELETE FROM catalog_galleries WHERE article = ?')->execute([$article]);
        kd_delete_gallery_media($old['photos'] ?? []);
        kd_json(['ok' => true, 'gallery' => kd_default_gallery($article)]);
    }
    if ($method !== 'POST') kd_json(['error' => 'Метод не поддерживается'], 405);
    $body = kd_json_body(65536);
    $photos = array_values(array_unique(array_filter(array_map('strval', is_array($body['photos'] ?? null) ? $body['photos'] : []))));
    if (!$photos || count($photos) > 12) kd_json(['error' => 'В карточке должно быть от 1 до 12 фотографий'], 400);
    $positions = is_array($body['positions'] ?? null) ? $body['positions'] : [];
    $zooms = is_array($body['zooms'] ?? null) ? $body['zooms'] : [];
    $stored = [];
    foreach ($photos as $url) {
        if (!kd_photo_url_allowed($article, $url)) kd_json(['error' => 'В списке есть недопустимая фотография'], 400);
        $pos = is_array($positions[$url] ?? null) ? $positions[$url] : [];
        $stored[] = ['url' => $url, 'x' => max(0,min(100,(float)($pos['x'] ?? 50))), 'y' => max(0,min(100,(float)($pos['y'] ?? 50))), 'zoom' => max(.4,min(4,(float)($zooms[$url] ?? 1)))];
    }
    $old = kd_gallery_row($article);
    $stmt = kd_db()->prepare('INSERT INTO catalog_galleries (article,photos_json,fit_mode,media_type,updated_at,updated_by) VALUES (?,?,\'contain\',?,UTC_TIMESTAMP(),\'admin\') ON DUPLICATE KEY UPDATE photos_json=VALUES(photos_json),fit_mode=\'contain\',media_type=VALUES(media_type),updated_at=UTC_TIMESTAMP(),updated_by=\'admin\'');
    $stmt->execute([$article, json_encode($stored, JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES), ($body['mediaType'] ?? '') === 'sketch' ? 'sketch' : 'photo']);
    $removed = is_array($body['removedUrls'] ?? null) ? $body['removedUrls'] : [];
    $keep = array_flip(array_map('strval', $photos));
    kd_delete_gallery_media(array_filter(array_merge($old['photos'] ?? [], $removed), fn($url) => !isset($keep[(string)$url])));
    $galleries = kd_all_galleries(true);
    kd_json(['ok' => true, 'gallery' => $galleries[$article]]);
}

function kd_gallery_row(string $article): array
{
    $stmt = kd_db()->prepare('SELECT photos_json FROM catalog_galleries WHERE article=? LIMIT 1'); $stmt->execute([$article]); $raw = $stmt->fetchColumn();
    if (!is_string($raw)) return ['photos' => []];
    $items = json_decode($raw, true); if (!is_array($items)) return ['photos' => []];
    return ['photos' => array_values(array_filter(array_map(fn($x) => is_array($x) ? (string)($x['url'] ?? '') : (string)$x, $items)))];
}

function kd_photo_url_allowed(string $article, string $url): bool
{
    if (in_array($url, kd_defaults()['catalogImages'][$article] ?? [], true)) return true;
    $key = kd_media_key_from_url($url);
    return $key !== null && str_starts_with($key, 'catalog/' . kd_article_slug($article) . '/');
}

function kd_delete_gallery_media(array $urls): void
{
    foreach ($urls as $url) {
        $key = kd_media_key_from_url((string)$url); if (!$key) continue;
        $path = kd_media_path($key); if ($path && is_file($path)) @unlink($path);
    }
}

function kd_catalog_color_upload(string $remainder): never
{
    $decoded = rawurldecode($remainder); $pos = strrpos($decoded, '/'); if ($pos === false) kd_json(['error'=>'Некорректный адрес'],400);
    $article = substr($decoded,0,$pos); $color = substr($decoded,$pos+1);
    if (!in_array($color,['chocolate','graphite','moss','mint','wine'],true)) kd_json(['error'=>'Цвет не найден'],404);
    $upload = kd_catalog_upload($article, false); $url = $upload['photo']['url'];
    $all = kd_setting_get('catalog_color_photos', []); if (!is_array($all)) $all=[];
    $previous = (string)($all[$article][$color] ?? ''); $all[$article] = is_array($all[$article] ?? null) ? $all[$article] : []; $all[$article][$color]=$url;
    kd_setting_set('catalog_color_photos',$all,'admin'); if ($previous && $previous !== $url) kd_delete_gallery_media([$previous]);
    kd_json(['ok'=>true,'colorId'=>$color,'url'=>$url,'colorPhotos'=>$all[$article]],201);
}

function kd_catalog_color_delete(string $remainder): never
{
    $decoded=rawurldecode($remainder);$pos=strrpos($decoded,'/');if($pos===false)kd_json(['error'=>'Некорректный адрес'],400);
    $article=substr($decoded,0,$pos);$color=substr($decoded,$pos+1);$all=kd_setting_get('catalog_color_photos',[]);if(!is_array($all))$all=[];
    $previous=(string)($all[$article][$color]??'');unset($all[$article][$color]);if(empty($all[$article]))unset($all[$article]);kd_setting_set('catalog_color_photos',$all,'admin');if($previous)kd_delete_gallery_media([$previous]);
    kd_json(['ok'=>true,'colorId'=>$color,'colorPhotos'=>$all[$article]??[]]);
}

function kd_serve_media(string $key, bool $head): never
{
    $key=rawurldecode($key);$path=kd_media_path($key);if(!$path||!is_file($path))kd_text('Файл не найден',404);
    $ext=strtolower(pathinfo($path,PATHINFO_EXTENSION));$type=['webp'=>'image/webp','jpg'=>'image/jpeg','jpeg'=>'image/jpeg','png'=>'image/png'][$ext]??'application/octet-stream';
    http_response_code(200);header('Content-Type: '.$type);header('Content-Length: '.filesize($path));header('Cache-Control: public, max-age=31536000, immutable');header('X-Content-Type-Options: nosniff');header('X-Kuzdvor-Backend: timeweb-php');if(!$head)readfile($path);exit;
}

function kd_admin_leads(): never
{
    $limit=max(1,min(200,(int)($_GET['limit']??50)));$before=(int)($_GET['before_id']??0);$status=trim((string)($_GET['status']??''));$q=trim((string)($_GET['q']??''));$source=trim((string)($_GET['source']??''));$from=(string)($_GET['from']??'');$to=(string)($_GET['to']??'');
    $where=[];$args=[];if($before>0){$where[]='id < ?';$args[]=$before;}if(in_array($status,['new','contacted','done','archived'],true)){$where[]='status=?';$args[]=$status;}if($source!==''){$where[]='source=?';$args[]=$source;}if(preg_match('/^\d{4}-\d{2}-\d{2}$/',$from)){$where[]='created_at>=?';$args[]=$from.' 00:00:00';}if(preg_match('/^\d{4}-\d{2}-\d{2}$/',$to)){$where[]='created_at<DATE_ADD(?,INTERVAL 1 DAY)';$args[]=$to.' 00:00:00';}
    if($q!==''){$where[]='(name LIKE ? OR city LIKE ? OR article LIKE ? OR source LIKE ? OR product_title LIKE ? OR phone LIKE ?)';$like='%'.$q.'%';array_push($args,$like,$like,$like,$like,$like,$like);}
    $sqlWhere=$where?' WHERE '.implode(' AND ',$where):'';$stmt=kd_db()->prepare('SELECT * FROM site_leads'.$sqlWhere.' ORDER BY id DESC LIMIT '.($limit+1));$stmt->execute($args);$rows=$stmt->fetchAll();$hasMore=count($rows)>$limit;if($hasMore)$rows=array_slice($rows,0,$limit);
    $leads=array_map('kd_lead_row',$rows);$counts=['new'=>0,'contacted'=>0,'done'=>0,'archived'=>0];foreach(kd_db()->query('SELECT status,COUNT(*) c FROM site_leads GROUP BY status')->fetchAll() as $r)if(isset($counts[$r['status']]))$counts[$r['status']]=(int)$r['c'];$sources=[];foreach(kd_db()->query("SELECT source,COUNT(*) c FROM site_leads WHERE TRIM(source)<>'' GROUP BY source ORDER BY c DESC,source ASC LIMIT 100")->fetchAll() as $r)$sources[]=['value'=>$r['source'],'count'=>(int)$r['c']];
    kd_json(['leads'=>$leads,'counts'=>$counts,'sources'=>$sources,'limited'=>false,'page'=>['limit'=>$limit,'beforeId'=>$before?:null,'nextBeforeId'=>$hasMore&&$leads?(int)end($leads)['id']:null,'hasMore'=>$hasMore,'status'=>$status?:'all','q'=>$q,'source'=>$source,'from'=>$from,'to'=>$to],'totalCount'=>array_sum($counts),'filteredTotal'=>count($leads)]);
}

function kd_lead_row(array $r): array
{
    $r['id']=(int)$r['id'];foreach(['install','posts','quote_verified','delivery_pending','delivery_out_of_area','consent'] as $k)$r[$k]=(bool)$r[$k];$r['configuration']=json_decode((string)($r['configuration_json']??'{}'),true)?:[];unset($r['configuration_json']);return $r;
}

function kd_admin_lead_status(string $id): never
{
    $leadId=(int)$id;if($leadId<=0)kd_json(['error'=>'Заявка не найдена'],404);$body=kd_json_body(8192);$status=(string)($body['status']??'');if(!in_array($status,['new','contacted','done','archived'],true))kd_json(['error'=>'Некорректный статус'],400);$stmt=kd_db()->prepare('UPDATE site_leads SET status=?,updated_at=UTC_TIMESTAMP() WHERE id=?');$stmt->execute([$status,$leadId]);if(!$stmt->rowCount())kd_json(['error'=>'Заявка не найдена'],404);kd_json(['ok'=>true,'id'=>$leadId,'status'=>$status]);
}

function kd_admin_workflows(): never
{
    $ids=array_values(array_filter(array_map('intval',explode(',',(string)($_GET['ids']??''))),fn($v)=>$v>0));$ids=array_slice($ids,0,200);if(!$ids)kd_json(['workflows'=>[]]);$marks=implode(',',array_fill(0,count($ids),'?'));$stmt=kd_db()->prepare("SELECT l.id,l.status,l.color,w.stage,w.admin_note,w.next_action_at,w.loss_reason,w.updated_at FROM site_leads l LEFT JOIN lead_workflow w ON w.lead_id=l.id WHERE l.id IN ($marks)");$stmt->execute($ids);$out=[];foreach($stmt->fetchAll() as $r){$stage=$r['stage']?:($r['status']==='done'?'completed':($r['status']==='archived'?'lost':($r['status']==='contacted'?'contacted':'new')));$out[(string)$r['id']]=['stage'=>$stage,'note'=>(string)($r['admin_note']??''),'nextActionAt'=>(string)($r['next_action_at']??''),'lossReason'=>(string)($r['loss_reason']??''),'updatedAt'=>(string)($r['updated_at']??''),'color'=>(string)($r['color']??'')];}kd_json(['workflows'=>$out]);
}

function kd_admin_workflow_save(string $id): never
{
    $leadId=(int)$id;$body=kd_json_body(16384);$stage=(string)($body['stage']??'');$allowed=['new','contacted','measurement_scheduled','measurement_done','contract','production','installation','completed','lost'];if($leadId<=0||!in_array($stage,$allowed,true))kd_json(['error'=>'Некорректные данные'],400);$note=mb_substr(trim((string)($body['note']??'')),0,1200);$next=mb_substr(trim((string)($body['nextActionAt']??'')),0,40);$loss=mb_substr(trim((string)($body['lossReason']??'')),0,400);$stmt=kd_db()->prepare('INSERT INTO lead_workflow (lead_id,stage,admin_note,next_action_at,loss_reason,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE stage=VALUES(stage),admin_note=VALUES(admin_note),next_action_at=VALUES(next_action_at),loss_reason=VALUES(loss_reason),updated_at=UTC_TIMESTAMP()');$stmt->execute([$leadId,$stage,$note,$next,$loss]);$coarse=$stage==='new'?'new':(($stage==='completed'||$stage==='lost')?'done':'contacted');kd_db()->prepare("UPDATE site_leads SET status=IF(status='archived',status,?),updated_at=UTC_TIMESTAMP() WHERE id=?")->execute([$coarse,$leadId]);kd_json(['ok'=>true,'id'=>$leadId,'stage'=>$stage,'note'=>$note,'nextActionAt'=>$next,'lossReason'=>$loss]);
}

function kd_admin_history(): never
{
    $key=(string)($_GET['key']??'');if(!in_array($key,['prices','site_profile','delivery_prices'],true))kd_json(['error'=>'Неизвестный раздел истории'],400);$stmt=kd_db()->prepare('SELECT id,setting_key,saved_at,updated_by,value_json FROM site_settings_history WHERE setting_key=? ORDER BY id DESC LIMIT 10');$stmt->execute([$key]);$history=[];foreach($stmt->fetchAll() as $r)$history[]=['id'=>(int)$r['id'],'key'=>$r['setting_key'],'savedAt'=>$r['saved_at'],'updatedBy'=>$r['updated_by'],'value'=>json_decode($r['value_json'],true)];kd_json(['history'=>$history]);
}

function kd_admin_history_restore(): never
{
    $body=kd_json_body(8192);$id=(int)($body['id']??0);$stmt=kd_db()->prepare('SELECT setting_key,value_json FROM site_settings_history WHERE id=? LIMIT 1');$stmt->execute([$id]);$row=$stmt->fetch();if(!$row)kd_json(['error'=>'Версия не найдена'],404);$value=json_decode((string)$row['value_json'],true);kd_setting_set((string)$row['setting_key'],$value,'history-restore',true);kd_json(['ok'=>true,'key'=>$row['setting_key']]);
}

function kd_admin_gate_excel(string $method): never
{
    $defaults=kd_defaults()['gateCalcPrices']??[];$saved=kd_setting_get('gate_excel_prices',[]);if(!is_array($saved))$saved=[];
    if($method==='GET'){$meta=is_array($saved['meta']??null)?$saved['meta']:null;$current=kd_storage_dir().'/excel/current.xlsx';kd_json(['prices'=>is_array($saved['prices']??null)?$saved['prices']:$defaults,'meta'=>$meta,'standardPrices'=>is_array($saved['standardPrices']??null)?$saved['standardPrices']:[],'fileAvailable'=>is_file($current)]);}
    if($method==='POST'){$body=kd_json_body(262144);$prices=is_array($body['prices']??null)?$body['prices']:[];$standards=is_array($body['standardPrices']??null)?$body['standardPrices']:[];$uploadId=preg_replace('/[^A-Za-z0-9_-]/','',(string)($body['fileUploadId']??$body['meta']['fileUploadId']??''));$meta=is_array($body['meta']??null)?$body['meta']:[];$dir=kd_storage_dir().'/excel';if(!is_dir($dir))mkdir($dir,0700,true);if($uploadId){$temp=$dir.'/uploads/'.$uploadId.'.xlsx';if(!is_file($temp))kd_json(['error'=>'Загруженный Excel не найден. Выберите файл ещё раз.'],400);rename($temp,$dir.'/current.xlsx');@chmod($dir.'/current.xlsx',0600);$meta['fileUploadId']=$uploadId;}$meta['importedAt']=gmdate('c');$state=['version'=>2,'prices'=>$prices,'meta'=>$meta,'standardPrices'=>$standards];kd_setting_set('gate_excel_prices',$state,'admin-excel');kd_json(['ok'=>true,'prices'=>$prices,'meta'=>$meta,'standardPrices'=>$standards,'fileAvailable'=>is_file($dir.'/current.xlsx')]);}
    kd_json(['error'=>'Метод не поддерживается'],405);
}

function kd_admin_gate_excel_file(string $method): never
{
    $dir=kd_storage_dir().'/excel';if($method==='GET'){$path=$dir.'/current.xlsx';if(!is_file($path))kd_text('Текущий Excel ещё не сохранён на сайте',404);$saved=kd_setting_get('gate_excel_prices',[]);$name=(string)($saved['meta']['fileName']??'ворота_расчет.xlsx');http_response_code(200);header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');header('Content-Length: '.filesize($path));header("Content-Disposition: attachment; filename=\"gate-calculation.xlsx\"; filename*=UTF-8''".rawurlencode($name));header('Cache-Control: private, no-store');header('X-Kuzdvor-Backend: timeweb-php');readfile($path);exit;}
    if($method==='PUT'||$method==='POST'){kd_body_limit(10*1024*1024);$bytes=file_get_contents('php://input');if($bytes===false||strlen($bytes)<4||strlen($bytes)>10*1024*1024||substr($bytes,0,2)!=='PK')kd_json(['error'=>'Файл не похож на корректный .xlsx'],400);$expected=strtolower(preg_replace('/[^a-f0-9]/','',(string)($_SERVER['HTTP_X_FILE_SHA256']??'')));$sha=hash('sha256',$bytes);if($expected!==''&&!hash_equals($expected,$sha))kd_json(['error'=>'Контрольная сумма Excel не совпала'],400);$uploadId='xlsx_'.time().'_'.bin2hex(random_bytes(12));$updir=$dir.'/uploads';if(!is_dir($updir))mkdir($updir,0700,true);file_put_contents($updir.'/'.$uploadId.'.xlsx',$bytes,LOCK_EX);@chmod($updir.'/'.$uploadId.'.xlsx',0600);$name=rawurldecode((string)($_SERVER['HTTP_X_FILE_NAME']??'ворота_расчет.xlsx'));$name=preg_replace('/[\r\n\\\/]/',' ',$name)??'ворота_расчет.xlsx';kd_json(['ok'=>true,'uploadId'=>$uploadId,'fileName'=>mb_substr($name,0,220),'fileSize'=>strlen($bytes),'sha256'=>$sha],201);}
    kd_json(['error'=>'Метод не поддерживается'],405);
}

function kd_admin_media_cleanup(): never
{
    $galleries=kd_all_galleries(true);$keep=[];foreach($galleries as $g){foreach(array_merge($g['photos']??[],array_values($g['colorPhotos']??[])) as $url){$key=kd_media_key_from_url((string)$url);if($key)$keep[$key]=true;}}$root=kd_storage_dir().'/catalog';$removed=0;$keys=[];if(is_dir($root)){$it=new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root,FilesystemIterator::SKIP_DOTS));foreach($it as $file){if(!$file->isFile()||time()-$file->getMTime()<86400)continue;$full=$file->getPathname();$key='catalog/'.str_replace(DIRECTORY_SEPARATOR,'/',substr($full,strlen($root)+1));if(isset($keep[$key]))continue;if(@unlink($full)){$removed++;if(count($keys)<100)$keys[]=$key;}}}kd_json(['ok'=>true,'removed'=>$removed,'removedKeys'=>$keys,'referenced'=>count($keep)]);
}
