<?php
declare(strict_types=1);

const KD_SESSION_COOKIE = 'kd_admin_session';
const KD_SESSION_SECONDS = 604800;

function kd_account_home(): string
{
    $home = trim((string)getenv('HOME'));
    if ($home !== '' && is_dir($home)) return rtrim($home, '/');
    return dirname(__DIR__, 3);
}

function kd_private_dir(): string
{
    return kd_account_home() . '/.kuzdvor';
}

function kd_config_path(): string
{
    return kd_private_dir() . '/config.php';
}

function kd_storage_dir(): string
{
    return kd_private_dir() . '/storage';
}

function kd_is_configured(): bool
{
    return is_file(kd_config_path());
}

function kd_config(): array
{
    static $config = null;
    if (is_array($config)) return $config;
    $path = kd_config_path();
    if (!is_file($path)) throw new RuntimeException('Timeweb backend is not configured');
    $loaded = require $path;
    if (!is_array($loaded)) throw new RuntimeException('Invalid backend config');
    $config = $loaded;
    return $config;
}

function kd_db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    $cfg = kd_config();
    $host = (string)($cfg['db_host'] ?? 'localhost');
    $port = (int)($cfg['db_port'] ?? 3306);
    $name = (string)($cfg['db_name'] ?? '');
    $user = (string)($cfg['db_user'] ?? '');
    $pass = (string)($cfg['db_password'] ?? '');
    if ($name === '' || $user === '') throw new RuntimeException('MySQL credentials are incomplete');
    $dsn = "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4";
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function kd_defaults(): array
{
    static $defaults = null;
    if (is_array($defaults)) return $defaults;
    $path = __DIR__ . '/defaults.json';
    $raw = @file_get_contents($path);
    $decoded = $raw === false ? null : json_decode($raw, true);
    if (!is_array($decoded)) throw new RuntimeException('Backend defaults are unavailable');
    $defaults = $decoded;
    return $defaults;
}

function kd_json(mixed $data, int $status = 200, array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    header('X-Kuzdvor-Backend: timeweb-php');
    foreach ($headers as $name => $value) header($name . ': ' . $value, true);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function kd_text(string $data, int $status = 200, string $contentType = 'text/plain; charset=utf-8', array $headers = []): never
{
    http_response_code($status);
    header('Content-Type: ' . $contentType);
    header('X-Content-Type-Options: nosniff');
    header('X-Kuzdvor-Backend: timeweb-php');
    foreach ($headers as $name => $value) header($name . ': ' . $value, true);
    echo $data;
    exit;
}

function kd_body_limit(int $bytes): void
{
    $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
    if ($length > $bytes) kd_json(['error' => 'Слишком большой запрос'], 413);
}

function kd_json_body(int $maxBytes = 131072): array
{
    kd_body_limit($maxBytes);
    $raw = file_get_contents('php://input');
    if ($raw === false || strlen($raw) > $maxBytes) kd_json(['error' => 'Слишком большой запрос'], 413);
    $data = json_decode($raw ?: '{}', true);
    if (!is_array($data)) kd_json(['error' => 'Некорректный JSON'], 400);
    return $data;
}

function kd_method(): string
{
    return strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
}

function kd_current_origin(): string
{
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (string)($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    $host = preg_replace('/[^A-Za-z0-9.:-]/', '', (string)($_SERVER['HTTP_HOST'] ?? 'kuzdvor.tw1.ru'));
    return ($https ? 'https' : 'http') . '://' . $host;
}

function kd_same_origin(): bool
{
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    return $origin !== '' && hash_equals(kd_current_origin(), $origin);
}

function kd_require_same_origin(): void
{
    if (!kd_same_origin()) kd_json(['error' => 'Недопустимый источник запроса'], 403);
}

function kd_client_ip(): string
{
    $ip = trim((string)($_SERVER['REMOTE_ADDR'] ?? ''));
    return substr($ip, 0, 64);
}

function kd_setting_get(string $key, mixed $fallback = null): mixed
{
    $stmt = kd_db()->prepare('SELECT value_json FROM site_settings WHERE `key` = ? LIMIT 1');
    $stmt->execute([$key]);
    $raw = $stmt->fetchColumn();
    if (!is_string($raw) || $raw === '') return $fallback;
    $decoded = json_decode($raw, true);
    return $decoded === null && $raw !== 'null' ? $fallback : $decoded;
}

function kd_setting_archive(string $key): void
{
    $stmt = kd_db()->prepare('SELECT value_json FROM site_settings WHERE `key` = ? LIMIT 1');
    $stmt->execute([$key]);
    $raw = $stmt->fetchColumn();
    if (!is_string($raw)) return;
    $insert = kd_db()->prepare('INSERT INTO site_settings_history (setting_key,value_json,saved_at,updated_by) VALUES (?,?,UTC_TIMESTAMP(),?)');
    $insert->execute([$key, $raw, 'admin']);
    $trim = kd_db()->prepare('DELETE FROM site_settings_history WHERE setting_key = ? AND id NOT IN (SELECT id FROM (SELECT id FROM site_settings_history WHERE setting_key = ? ORDER BY id DESC LIMIT 20) AS keep_rows)');
    $trim->execute([$key, $key]);
}

function kd_setting_set(string $key, mixed $value, string $updatedBy = 'admin', bool $archive = false): void
{
    if ($archive) kd_setting_archive($key);
    $json = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) throw new RuntimeException('Не удалось сериализовать настройки');
    $stmt = kd_db()->prepare('INSERT INTO site_settings (`key`,value_json,updated_at,updated_by) VALUES (?,?,UTC_TIMESTAMP(),?) ON DUPLICATE KEY UPDATE value_json=VALUES(value_json),updated_at=UTC_TIMESTAMP(),updated_by=VALUES(updated_by)');
    $stmt->execute([$key, $json, $updatedBy]);
}

function kd_default_site_profile(): array
{
    return kd_defaults()['siteProfile'] ?? [];
}

function kd_site_profile(): array
{
    $defaults = kd_default_site_profile();
    $saved = kd_setting_get('site_profile', []);
    return is_array($saved) ? array_replace($defaults, $saved) : $defaults;
}

function kd_prices(): array
{
    $defaults = kd_defaults()['prices'] ?? [];
    $saved = kd_setting_get('prices', []);
    return is_array($saved) ? array_replace_recursive($defaults, $saved) : $defaults;
}

function kd_delivery_settings(): array
{
    $defaults = kd_defaults()['delivery'] ?? [];
    $saved = kd_setting_get('delivery_prices', []);
    if (!is_array($saved) || !$saved) return $defaults;

    $result = array_replace($defaults, $saved);
    $defaultRows = is_array($defaults['destinations'] ?? null) ? $defaults['destinations'] : [];
    $savedRows = is_array($saved['destinations'] ?? null) ? $saved['destinations'] : [];
    if (!$defaultRows) return $result;

    // Production defaults contain the generated 200 km offline grid. Saved admin
    // rows stay authoritative for matching names, but no longer hide newly generated
    // settlements when an older delivery table is stored in MySQL.
    $rows = [];
    $order = [];
    foreach ($defaultRows as $item) {
        if (!is_array($item)) continue;
        $key = kd_normalize_name((string)($item['name'] ?? ''));
        if ($key === '') continue;
        if (!array_key_exists($key, $rows)) $order[] = $key;
        $rows[$key] = $item;
    }
    foreach ($savedRows as $item) {
        if (!is_array($item)) continue;
        $key = kd_normalize_name((string)($item['name'] ?? ''));
        if ($key === '') continue;
        if (!array_key_exists($key, $rows)) $order[] = $key;
        $rows[$key] = array_replace($rows[$key] ?? [], $item);
    }
    $result['destinations'] = array_values(array_map(static fn(string $key): array => $rows[$key], $order));
    return $result;
}

function kd_article_slug(string $article): string
{
    $value = preg_replace('/^Арт\.\s*/u', '', $article) ?? $article;
    $value = str_replace(['С', 'с'], 's', mb_strtolower($value, 'UTF-8'));
    $value = preg_replace('/[^a-z0-9-]/', '', $value) ?? '';
    return $value !== '' ? $value : 'model';
}

function kd_default_gallery(string $article): array
{
    $images = kd_defaults()['catalogImages'][$article] ?? [];
    $positions = [];
    $zooms = [];
    foreach ($images as $url) {
        $positions[$url] = ['x' => 50, 'y' => 50];
        $zooms[$url] = 1;
    }
    return [
        'photos' => array_values($images),
        'positions' => $positions,
        'zooms' => $zooms,
        'fitMode' => 'contain',
        'mediaType' => in_array($article, ['Арт.4','Арт.11','Арт.34','Арт.37'], true) ? 'sketch' : 'photo',
        'customized' => false,
        'defaultPhotos' => array_values($images),
        'colorPhotos' => [],
    ];
}

function kd_media_key_from_url(string $url): ?string
{
    $prefix = '/catalog-media/';
    if (!str_starts_with($url, $prefix)) return null;
    $key = rawurldecode(substr($url, strlen($prefix)));
    if (!str_starts_with($key, 'catalog/') || str_contains($key, '..') || str_starts_with($key, '/')) return null;
    return preg_match('#^catalog/[a-z0-9-]+/[A-Za-z0-9._-]+$#', $key) ? $key : null;
}

function kd_media_path(string $key): ?string
{
    if (!preg_match('#^catalog/[a-z0-9-]+/[A-Za-z0-9._-]+$#', $key)) return null;
    return kd_storage_dir() . '/' . $key;
}

function kd_catalog_media_url_available(string $url): bool
{
    $key = kd_media_key_from_url($url);
    if ($key === null) return true;
    $path = kd_media_path($key);
    return $path !== null && is_file($path) && filesize($path) > 0;
}

function kd_all_galleries(bool $includeDefaults = false): array
{
    $defaults = kd_defaults()['catalogImages'] ?? [];
    $galleries = [];
    foreach (array_keys($defaults) as $article) $galleries[$article] = kd_default_gallery($article);
    $rows = kd_db()->query('SELECT article,photos_json,fit_mode,media_type FROM catalog_galleries')->fetchAll();
    foreach ($rows as $row) {
        $article = (string)$row['article'];
        if (!array_key_exists($article, $galleries)) continue;
        $stored = json_decode((string)$row['photos_json'], true);
        if (!is_array($stored) || !$stored) continue;
        $photos = [];
        $positions = [];
        $zooms = [];
        foreach ($stored as $item) {
            $url = is_array($item) ? (string)($item['url'] ?? '') : (string)$item;
            if ($url === '' || !kd_catalog_media_url_available($url)) continue;
            $photos[] = $url;
            $positions[$url] = [
                'x' => max(0, min(100, (float)(is_array($item) ? ($item['x'] ?? 50) : 50))),
                'y' => max(0, min(100, (float)(is_array($item) ? ($item['y'] ?? 50) : 50))),
            ];
            $zooms[$url] = max(.4, min(4, (float)(is_array($item) ? ($item['zoom'] ?? 1) : 1)));
        }
        if ($photos) {
            $galleries[$article] = [
                'photos' => $photos,
                'positions' => $positions,
                'zooms' => $zooms,
                'fitMode' => 'contain',
                'mediaType' => $row['media_type'] === 'sketch' ? 'sketch' : 'photo',
                'customized' => true,
                'defaultPhotos' => array_values($defaults[$article]),
                'colorPhotos' => [],
            ];
        }
    }
    $colors = kd_setting_get('catalog_color_photos', []);
    if (is_array($colors)) {
        foreach ($galleries as $article => &$gallery) {
            $savedColors = is_array($colors[$article] ?? null) ? $colors[$article] : [];
            $gallery['colorPhotos'] = array_filter(
                $savedColors,
                static fn($url): bool => is_string($url) && $url !== '' && kd_catalog_media_url_available($url)
            );
        }
        unset($gallery);
    }
    if (!$includeDefaults) {
        foreach ($galleries as &$gallery) {
            unset($gallery['customized'], $gallery['defaultPhotos']);
        }
        unset($gallery);
    }
    return $galleries;
}

function kd_set_session_cookie(string $token, int $expires): void
{
    setcookie(KD_SESSION_COOKIE, $token, [
        'expires' => $expires,
        'path' => '/',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function kd_admin_session(): ?array
{
    $token = (string)($_COOKIE[KD_SESSION_COOKIE] ?? '');
    if (!preg_match('/^[A-Za-z0-9_-]{40,120}$/', $token)) return null;
    $hash = hash('sha256', $token);
    $stmt = kd_db()->prepare('SELECT id,admin_id,expires_at FROM admin_sessions WHERE token_hash = ? AND expires_at > UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([$hash]);
    $row = $stmt->fetch();
    return is_array($row) ? $row : null;
}

function kd_require_admin(): array
{
    $session = kd_admin_session();
    if (!$session) kd_json(['error' => 'Требуется вход'], 401);
    return $session;
}

function kd_create_admin_session(int $adminId): void
{
    $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $hash = hash('sha256', $token);
    $expires = time() + KD_SESSION_SECONDS;
    kd_db()->prepare('DELETE FROM admin_sessions WHERE expires_at <= UTC_TIMESTAMP()')->execute();
    $stmt = kd_db()->prepare('INSERT INTO admin_sessions (admin_id,token_hash,expires_at,created_at,ip_address) VALUES (?,?,FROM_UNIXTIME(?),UTC_TIMESTAMP(),?)');
    $stmt->execute([$adminId, $hash, $expires, kd_client_ip()]);
    kd_set_session_cookie($token, $expires);
}

function kd_logout_admin(): void
{
    $token = (string)($_COOKIE[KD_SESSION_COOKIE] ?? '');
    if ($token !== '') {
        kd_db()->prepare('DELETE FROM admin_sessions WHERE token_hash = ?')->execute([hash('sha256', $token)]);
    }
    setcookie(KD_SESSION_COOKIE, '', ['expires' => time() - 3600, 'path' => '/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
}

function kd_normalize_name(string $value): string
{
    $value = mb_strtolower(trim($value), 'UTF-8');
    $value = str_replace('ё', 'е', $value);
    return preg_replace('/[^а-яa-z0-9]/u', '', $value) ?? '';
}
