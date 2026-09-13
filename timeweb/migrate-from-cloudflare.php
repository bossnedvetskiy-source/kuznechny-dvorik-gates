<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/backend/bootstrap.php';

const OLD_BACKEND = 'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev';

function prompt_cli(string $label): string
{
    fwrite(STDOUT, $label . ': ');
    return trim((string)fgets(STDIN));
}

function secret_cli(string $label): string
{
    fwrite(STDOUT, $label . ': ');
    $stty = trim((string)shell_exec('stty -g 2>/dev/null'));
    if ($stty !== '') shell_exec('stty -echo 2>/dev/null');
    $value = rtrim((string)fgets(STDIN), "\r\n");
    if ($stty !== '') shell_exec('stty ' . escapeshellarg($stty) . ' 2>/dev/null');
    fwrite(STDOUT, PHP_EOL);
    return $value;
}

function request_remote(string $path, string $cookieJar, string $method = 'GET', ?string $body = null, array $headers = [], bool $binary = false): array
{
    $url = OLD_BACKEND . $path;
    $ch = curl_init($url);
    $allHeaders = array_merge([
        'Accept: ' . ($binary ? '*/*' : 'application/json'),
        'Origin: ' . OLD_BACKEND,
        'Referer: ' . OLD_BACKEND . '/',
        'User-Agent: Kuzdvor-Timeweb-Migrator/1.0',
    ], $headers);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => $allHeaders,
        CURLOPT_COOKIEJAR => $cookieJar,
        CURLOPT_COOKIEFILE => $cookieJar,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $contentType = (string)curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('Ошибка соединения с Cloudflare: ' . $error);
    if ($status < 200 || $status >= 300) {
        $message = $raw;
        $decoded = json_decode((string)$raw, true);
        if (is_array($decoded) && isset($decoded['error'])) $message = (string)$decoded['error'];
        throw new RuntimeException("Cloudflare {$path}: HTTP {$status}: {$message}");
    }
    if ($binary) return ['raw' => (string)$raw, 'contentType' => $contentType, 'status' => $status];
    $decoded = json_decode((string)$raw, true);
    if (!is_array($decoded)) throw new RuntimeException("Cloudflare {$path}: некорректный JSON");
    return $decoded;
}

function save_setting_local(string $key, mixed $value, string $by = 'migration'): void
{
    kd_setting_set($key, $value, $by, false);
}

function download_media(string $url, string $cookieJar): void
{
    $key = kd_media_key_from_url($url);
    if (!$key) return;
    $path = kd_media_path($key);
    if (!$path || is_file($path)) return;
    $response = request_remote($url, $cookieJar, 'GET', null, [], true);
    $bytes = $response['raw'];
    if ($bytes === '' || @getimagesizefromstring($bytes) === false) {
        throw new RuntimeException('Получен повреждённый файл ' . $url);
    }
    if (!is_dir(dirname($path)) && !mkdir(dirname($path), 0700, true) && !is_dir(dirname($path))) {
        throw new RuntimeException('Не удалось создать каталог ' . dirname($path));
    }
    file_put_contents($path, $bytes, LOCK_EX);
    @chmod($path, 0600);
}

if (!kd_is_configured()) {
    fwrite(STDERR, "Сначала выполните: php setup-timeweb.php\n");
    exit(1);
}

try {
    kd_db()->query('SELECT 1')->fetchColumn();
} catch (Throwable $e) {
    fwrite(STDERR, "MySQL недоступен: {$e->getMessage()}\n");
    exit(1);
}

fwrite(STDOUT, "\nПеренос данных Cloudflare D1 → MySQL Timeweb\n");
fwrite(STDOUT, "Логин и пароль старой админки вводятся только здесь и никуда не сохраняются.\n\n");
$username = prompt_cli('Логин старой админки Cloudflare');
$password = secret_cli('Пароль старой админки Cloudflare');
if ($username === '' || $password === '') {
    fwrite(STDERR, "Логин и пароль обязательны.\n");
    exit(1);
}

$cookieJar = tempnam(sys_get_temp_dir(), 'kuzdvor-cf-cookie-');
if ($cookieJar === false) throw new RuntimeException('Не удалось создать временный cookie-файл');
@chmod($cookieJar, 0600);

try {
    request_remote('/api/admin/login', $cookieJar, 'POST', json_encode(['username' => $username, 'password' => $password], JSON_UNESCAPED_UNICODE), ['Content-Type: application/json']);
    fwrite(STDOUT, "✓ Вход в старую админку выполнен\n");

    $site = request_remote('/api/admin/site-settings', $cookieJar);
    if (isset($site['site'])) save_setting_local('site_profile', $site['site']);
    $prices = request_remote('/api/admin/prices', $cookieJar);
    if (isset($prices['prices'])) save_setting_local('prices', $prices['prices']);
    $delivery = request_remote('/api/admin/delivery', $cookieJar);
    if (isset($delivery['delivery'])) save_setting_local('delivery_prices', $delivery['delivery']);
    fwrite(STDOUT, "✓ Настройки сайта, цены и доставка перенесены\n");

    foreach (['prices','site_profile','delivery_prices'] as $historyKey) {
        try {
            $history = request_remote('/api/admin/history?key=' . rawurlencode($historyKey), $cookieJar);
            foreach (array_reverse($history['history'] ?? []) as $item) {
                if (!array_key_exists('value', $item)) continue;
                $stmt = kd_db()->prepare('INSERT INTO site_settings_history (setting_key,value_json,saved_at,updated_by) VALUES (?,?,?,?)');
                $stmt->execute([
                    $historyKey,
                    json_encode($item['value'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    preg_match('/^\d{4}-\d{2}-\d{2}/', (string)($item['savedAt'] ?? '')) ? (string)$item['savedAt'] : gmdate('Y-m-d H:i:s'),
                    (string)($item['updatedBy'] ?? 'migration')
                ]);
            }
        } catch (Throwable $e) {
            fwrite(STDOUT, "  История {$historyKey}: пропущена ({$e->getMessage()})\n");
        }
    }

    $catalog = request_remote('/api/admin/catalog', $cookieJar);
    $galleries = is_array($catalog['galleries'] ?? null) ? $catalog['galleries'] : [];
    $colorMap = [];
    $mediaUrls = [];
    foreach ($galleries as $article => $gallery) {
        if (!is_array($gallery)) continue;
        foreach (($gallery['photos'] ?? []) as $url) if (is_string($url) && str_starts_with($url, '/catalog-media/')) $mediaUrls[$url] = true;
        foreach (($gallery['colorPhotos'] ?? []) as $url) if (is_string($url) && str_starts_with($url, '/catalog-media/')) $mediaUrls[$url] = true;
        if (!empty($gallery['colorPhotos']) && is_array($gallery['colorPhotos'])) $colorMap[$article] = $gallery['colorPhotos'];
        if (empty($gallery['customized'])) continue;
        $photos = [];
        foreach (($gallery['photos'] ?? []) as $url) {
            if (!is_string($url) || $url === '') continue;
            $pos = is_array($gallery['positions'][$url] ?? null) ? $gallery['positions'][$url] : [];
            $photos[] = [
                'url' => $url,
                'x' => max(0, min(100, (float)($pos['x'] ?? 50))),
                'y' => max(0, min(100, (float)($pos['y'] ?? 50))),
                'zoom' => max(.4, min(4, (float)($gallery['zooms'][$url] ?? 1))),
            ];
        }
        if (!$photos) continue;
        $stmt = kd_db()->prepare('INSERT INTO catalog_galleries (article,photos_json,fit_mode,media_type,updated_at,updated_by) VALUES (?,?,\'contain\',?,UTC_TIMESTAMP(),\'migration\') ON DUPLICATE KEY UPDATE photos_json=VALUES(photos_json),fit_mode=VALUES(fit_mode),media_type=VALUES(media_type),updated_at=UTC_TIMESTAMP(),updated_by=\'migration\'');
        $stmt->execute([$article, json_encode($photos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), ($gallery['mediaType'] ?? '') === 'sketch' ? 'sketch' : 'photo']);
    }
    if ($colorMap) save_setting_local('catalog_color_photos', $colorMap);
    $mediaCount = count($mediaUrls);
    $done = 0;
    foreach (array_keys($mediaUrls) as $url) {
        download_media($url, $cookieJar);
        $done++;
        if ($done % 10 === 0 || $done === $mediaCount) fwrite(STDOUT, "  Фото: {$done}/{$mediaCount}\n");
    }
    fwrite(STDOUT, "✓ Каталог и пользовательские фотографии перенесены\n");

    try {
        $excel = request_remote('/api/admin/gate-excel', $cookieJar);
        $state = [
            'version' => 2,
            'prices' => is_array($excel['prices'] ?? null) ? $excel['prices'] : [],
            'meta' => is_array($excel['meta'] ?? null) ? $excel['meta'] : [],
            'standardPrices' => is_array($excel['standardPrices'] ?? null) ? $excel['standardPrices'] : [],
        ];
        if (!empty($excel['fileAvailable'])) {
            $file = request_remote('/api/admin/gate-excel/file', $cookieJar, 'GET', null, [], true);
            $dir = kd_storage_dir() . '/excel';
            if (!is_dir($dir)) mkdir($dir, 0700, true);
            file_put_contents($dir . '/current.xlsx', $file['raw'], LOCK_EX);
            @chmod($dir . '/current.xlsx', 0600);
            $state['meta']['fileUploadId'] = 'migrated_timeweb';
        }
        save_setting_local('gate_excel_prices', $state, 'migration-excel');
        fwrite(STDOUT, "✓ Excel-расчёт перенесён\n");
    } catch (Throwable $e) {
        fwrite(STDOUT, "  Excel: пропущен ({$e->getMessage()})\n");
    }

    $allLeads = [];
    $before = null;
    do {
        $query = '/api/admin/leads?limit=200' . ($before ? '&before_id=' . $before : '');
        $page = request_remote($query, $cookieJar);
        foreach (($page['leads'] ?? []) as $lead) if (is_array($lead)) $allLeads[] = $lead;
        $before = !empty($page['page']['hasMore']) ? (int)($page['page']['nextBeforeId'] ?? 0) : null;
    } while ($before);

    $insertLead = kd_db()->prepare('INSERT INTO site_leads (id,created_at,updated_at,status,name,phone,city,category,source,article,product_title,configuration_json,width,wicket_width,wicket_height,height,install,posts,color,total,client_total,quote_verified,delivery_pending,delivery_out_of_area,delivery_distance_km,consent,consent_at,policy_version,comment,message) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE created_at=VALUES(created_at),updated_at=VALUES(updated_at),status=VALUES(status),name=VALUES(name),phone=VALUES(phone),city=VALUES(city),category=VALUES(category),source=VALUES(source),article=VALUES(article),product_title=VALUES(product_title),configuration_json=VALUES(configuration_json),width=VALUES(width),wicket_width=VALUES(wicket_width),wicket_height=VALUES(wicket_height),height=VALUES(height),install=VALUES(install),posts=VALUES(posts),color=VALUES(color),total=VALUES(total),client_total=VALUES(client_total),quote_verified=VALUES(quote_verified),delivery_pending=VALUES(delivery_pending),delivery_out_of_area=VALUES(delivery_out_of_area),delivery_distance_km=VALUES(delivery_distance_km),consent=VALUES(consent),consent_at=VALUES(consent_at),policy_version=VALUES(policy_version),comment=VALUES(comment),message=VALUES(message)');
    foreach ($allLeads as $lead) {
        $insertLead->execute([
            (int)$lead['id'], (string)($lead['created_at'] ?? gmdate('Y-m-d H:i:s')), (string)($lead['updated_at'] ?? $lead['created_at'] ?? gmdate('Y-m-d H:i:s')),
            (string)($lead['status'] ?? 'new'), (string)($lead['name'] ?? ''), (string)($lead['phone'] ?? ''), (string)($lead['city'] ?? ''), (string)($lead['category'] ?? 'gates'),
            (string)($lead['source'] ?? ''), (string)($lead['article'] ?? ''), (string)($lead['product_title'] ?? ''), json_encode($lead['configuration'] ?? [], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $lead['width'] ?? null, $lead['wicket_width'] ?? null, $lead['wicket_height'] ?? null, $lead['height'] ?? null, !empty($lead['install']) ? 1 : 0, !empty($lead['posts']) ? 1 : 0,
            (string)($lead['color'] ?? ''), (int)($lead['total'] ?? 0), (int)($lead['client_total'] ?? $lead['total'] ?? 0), !empty($lead['quote_verified']) ? 1 : 0,
            !empty($lead['delivery_pending']) ? 1 : 0, !empty($lead['delivery_out_of_area']) ? 1 : 0, $lead['delivery_distance_km'] ?? null, !empty($lead['consent']) ? 1 : 0,
            ($lead['consent_at'] ?? '') !== '' ? (string)$lead['consent_at'] : null, (string)($lead['policy_version'] ?? ''), (string)($lead['comment'] ?? ''), (string)($lead['message'] ?? '')
        ]);
    }

    $leadIds = array_map(fn($lead) => (int)$lead['id'], $allLeads);
    foreach (array_chunk($leadIds, 150) as $chunk) {
        if (!$chunk) continue;
        try {
            $wf = request_remote('/api/admin/lead-workflows?ids=' . implode(',', $chunk), $cookieJar);
            foreach (($wf['workflows'] ?? []) as $id => $item) {
                if (!is_array($item)) continue;
                $stmt = kd_db()->prepare('INSERT INTO lead_workflow (lead_id,stage,admin_note,next_action_at,loss_reason,updated_at) VALUES (?,?,?,?,?,UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE stage=VALUES(stage),admin_note=VALUES(admin_note),next_action_at=VALUES(next_action_at),loss_reason=VALUES(loss_reason),updated_at=UTC_TIMESTAMP()');
                $stmt->execute([(int)$id, (string)($item['stage'] ?? 'new'), (string)($item['note'] ?? ''), (string)($item['nextActionAt'] ?? ''), (string)($item['lossReason'] ?? '')]);
            }
        } catch (Throwable $e) {
            fwrite(STDOUT, "  Этапы заявок: часть пропущена ({$e->getMessage()})\n");
        }
    }
    fwrite(STDOUT, "✓ Заявки перенесены: " . count($allLeads) . "\n");

    fwrite(STDOUT, "\nПеренос завершён. Cloudflare пока НЕ отключён: сайт продолжает работать через старый API до финального переключения.\n");
    fwrite(STDOUT, "Теперь можно проверить локальный backend по /api-local/health и /api-local/catalog-images.\n");
} catch (Throwable $e) {
    fwrite(STDERR, "\nОШИБКА ПЕРЕНОСА: {$e->getMessage()}\n");
    fwrite(STDERR, "Старый Cloudflare backend не изменён. Повторный запуск безопасен.\n");
    exit(1);
} finally {
    @unlink($cookieJar);
}
