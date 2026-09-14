<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/backend/bootstrap.php';

const KD_OLD_BACKEND = 'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev';

function kd_migration_remote_json(string $path): array
{
    $ch = curl_init(KD_OLD_BACKEND . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_TIMEOUT => 45,
        CURLOPT_HTTPHEADER => [
            'Accept: application/json',
            'User-Agent: Kuzdvor-Timeweb-Public-Catalog-Migrator/1.0',
        ],
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($raw === false) throw new RuntimeException('Не удалось получить каталог Cloudflare: ' . $error);
    if ($status < 200 || $status >= 300) throw new RuntimeException("Cloudflare {$path}: HTTP {$status}");
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) throw new RuntimeException('Cloudflare вернул некорректный JSON каталога');
    return $data;
}

function kd_migration_remote_media(string $url): string
{
    $ch = curl_init(KD_OLD_BACKEND . $url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_CONNECTTIMEOUT => 12,
        CURLOPT_TIMEOUT => 60,
        CURLOPT_HTTPHEADER => [
            'Accept: image/avif,image/webp,image/png,image/jpeg,*/*;q=0.8',
            'User-Agent: Kuzdvor-Timeweb-Public-Catalog-Migrator/1.0',
        ],
    ]);
    $bytes = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($bytes === false) throw new RuntimeException('Не удалось скачать фото ' . $url . ': ' . $error);
    if ($status < 200 || $status >= 300) throw new RuntimeException("Фото {$url}: HTTP {$status}");
    if ($bytes === '' || strlen($bytes) > 8 * 1024 * 1024 || @getimagesizefromstring($bytes) === false) {
        throw new RuntimeException('Cloudflare вернул повреждённое фото ' . $url);
    }
    return (string)$bytes;
}

function kd_migration_gallery_is_custom(string $article, array $remote): bool
{
    $default = kd_default_gallery($article);
    $photos = array_values(array_filter($remote['photos'] ?? [], 'is_string'));
    if ($photos !== array_values($default['photos'] ?? [])) return true;
    if (($remote['mediaType'] ?? 'photo') !== ($default['mediaType'] ?? 'photo')) return true;
    foreach ($photos as $url) {
        $pos = is_array($remote['positions'][$url] ?? null) ? $remote['positions'][$url] : [];
        $x = (float)($pos['x'] ?? 50);
        $y = (float)($pos['y'] ?? 50);
        $zoom = (float)($remote['zooms'][$url] ?? 1);
        if (abs($x - 50) > 0.001 || abs($y - 50) > 0.001 || abs($zoom - 1) > 0.001) return true;
    }
    return false;
}

function kd_migration_add_media(array &$media, string $article, mixed $value): void
{
    if (!is_string($value) || !str_starts_with($value, '/catalog-media/')) return;
    $key = kd_media_key_from_url($value);
    $expectedPrefix = 'catalog/' . kd_article_slug($article) . '/';
    if (!$key || !str_starts_with($key, $expectedPrefix)) {
        throw new RuntimeException('В старом каталоге найден небезопасный путь медиа: ' . $value);
    }
    $media[$value] = $key;
}

function kd_migration_backup(PDO $pdo): string
{
    $catalog = $pdo->query('SELECT article,photos_json,fit_mode,media_type,updated_at,updated_by FROM catalog_galleries ORDER BY article')->fetchAll();
    $stmt = $pdo->prepare('SELECT value_json,updated_at,updated_by FROM site_settings WHERE `key` = ? LIMIT 1');
    $stmt->execute(['catalog_color_photos']);
    $colors = $stmt->fetch() ?: null;
    $dir = kd_private_dir() . '/migration-backups';
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Не удалось создать каталог резервных копий');
    }
    $path = $dir . '/catalog-' . gmdate('Ymd-His') . '.json';
    $json = json_encode([
        'createdAt' => gmdate('c'),
        'catalogGalleries' => $catalog,
        'catalogColorPhotos' => $colors,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
    if ($json === false || file_put_contents($path, $json, LOCK_EX) === false) {
        throw new RuntimeException('Не удалось сохранить резервную копию каталога');
    }
    @chmod($path, 0600);
    return $path;
}

if (!kd_is_configured()) {
    fwrite(STDERR, "Timeweb backend не настроен. Сначала выполните setup-timeweb.php\n");
    exit(1);
}

try {
    $pdo = kd_db();
    $pdo->query('SELECT 1')->fetchColumn();

    fwrite(STDOUT, "Перенос публичного каталога Cloudflare → Timeweb\n");
    fwrite(STDOUT, "Старая админка и пароль Cloudflare не используются.\n\n");

    $remote = kd_migration_remote_json('/api/catalog-images');
    $galleries = is_array($remote['galleries'] ?? null) ? $remote['galleries'] : [];
    $allowed = kd_defaults()['catalogImages'] ?? [];
    if (!$galleries || !$allowed) throw new RuntimeException('Каталог Cloudflare пуст или локальные данные каталога недоступны');

    $customRows = [];
    $colorMap = [];
    $media = [];

    foreach ($galleries as $article => $gallery) {
        if (!is_string($article) || !array_key_exists($article, $allowed) || !is_array($gallery)) continue;

        $photos = array_values(array_filter($gallery['photos'] ?? [], fn($value) => is_string($value) && $value !== ''));
        foreach ($photos as $url) kd_migration_add_media($media, $article, $url);

        $colors = is_array($gallery['colorPhotos'] ?? null) ? $gallery['colorPhotos'] : [];
        $cleanColors = [];
        foreach ($colors as $colorId => $url) {
            if (!is_string($colorId) || !is_string($url) || $url === '') continue;
            kd_migration_add_media($media, $article, $url);
            $cleanColors[$colorId] = $url;
        }
        if ($cleanColors) $colorMap[$article] = $cleanColors;

        if (!$photos || !kd_migration_gallery_is_custom($article, $gallery)) continue;
        $storedPhotos = [];
        foreach ($photos as $url) {
            $pos = is_array($gallery['positions'][$url] ?? null) ? $gallery['positions'][$url] : [];
            $storedPhotos[] = [
                'url' => $url,
                'x' => max(0, min(100, (float)($pos['x'] ?? 50))),
                'y' => max(0, min(100, (float)($pos['y'] ?? 50))),
                'zoom' => max(.4, min(4, (float)($gallery['zooms'][$url] ?? 1))),
            ];
        }
        $customRows[$article] = [
            'photos' => $storedPhotos,
            'mediaType' => ($gallery['mediaType'] ?? '') === 'sketch' ? 'sketch' : 'photo',
        ];
    }

    $backupPath = kd_migration_backup($pdo);
    fwrite(STDOUT, "✓ Резервная копия локального каталога: {$backupPath}\n");

    $downloaded = 0;
    $alreadyPresent = 0;
    foreach ($media as $url => $key) {
        $path = kd_media_path($key);
        if (!$path) throw new RuntimeException('Не удалось определить локальный путь для ' . $url);
        if (is_file($path) && @getimagesize($path) !== false) {
            $alreadyPresent++;
            continue;
        }
        $bytes = kd_migration_remote_media($url);
        $dir = dirname($path);
        if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
            throw new RuntimeException('Не удалось создать каталог ' . $dir);
        }
        $tmp = $path . '.tmp-' . bin2hex(random_bytes(6));
        if (file_put_contents($tmp, $bytes, LOCK_EX) === false) throw new RuntimeException('Не удалось сохранить ' . $url);
        @chmod($tmp, 0600);
        if (!rename($tmp, $path)) {
            @unlink($tmp);
            throw new RuntimeException('Не удалось завершить сохранение ' . $url);
        }
        @chmod($path, 0600);
        $downloaded++;
    }
    fwrite(STDOUT, "✓ Медиа: скачано {$downloaded}, уже было {$alreadyPresent}\n");

    $pdo->beginTransaction();
    try {
        $upsert = $pdo->prepare("INSERT INTO catalog_galleries (article,photos_json,fit_mode,media_type,updated_at,updated_by) VALUES (?,?,'contain',?,UTC_TIMESTAMP(),'cloudflare-public-migration') ON DUPLICATE KEY UPDATE photos_json=VALUES(photos_json),fit_mode='contain',media_type=VALUES(media_type),updated_at=UTC_TIMESTAMP(),updated_by='cloudflare-public-migration'");
        foreach ($customRows as $article => $row) {
            $json = json_encode($row['photos'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            if ($json === false) throw new RuntimeException('Не удалось сериализовать галерею ' . $article);
            $upsert->execute([$article, $json, $row['mediaType']]);
        }
        if ($colorMap) kd_setting_set('catalog_color_photos', $colorMap, 'cloudflare-public-migration', false);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    $storedCount = (int)$pdo->query('SELECT COUNT(*) FROM catalog_galleries')->fetchColumn();
    $missing = [];
    foreach ($media as $url => $key) {
        $path = kd_media_path($key);
        if (!$path || !is_file($path) || @getimagesize($path) === false) $missing[] = $url;
    }
    if ($missing) throw new RuntimeException('После переноса не найдены файлы: ' . implode(', ', $missing));

    fwrite(STDOUT, "✓ Пользовательских галерей перенесено: " . count($customRows) . "\n");
    fwrite(STDOUT, "✓ Цветовых наборов перенесено: " . count($colorMap) . "\n");
    fwrite(STDOUT, "✓ Галерей в MySQL сейчас: {$storedCount}\n");
    fwrite(STDOUT, "\nMIGRATION_OK\n");
} catch (Throwable $e) {
    fwrite(STDERR, "MIGRATION_ERROR: {$e->getMessage()}\n");
    exit(1);
}
