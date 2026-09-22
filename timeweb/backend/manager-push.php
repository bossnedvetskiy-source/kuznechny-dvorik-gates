<?php
declare(strict_types=1);

function kd_manager_push_ensure_table(): void
{
    static $ready = false;
    if ($ready) return;
    kd_db()->exec("
        CREATE TABLE IF NOT EXISTS manager_push_subscriptions (
          endpoint_hash CHAR(64) NOT NULL,
          admin_id INT UNSIGNED NOT NULL,
          endpoint TEXT NOT NULL,
          p256dh VARCHAR(255) NOT NULL DEFAULT '',
          auth_token VARCHAR(255) NOT NULL DEFAULT '',
          user_agent VARCHAR(500) NOT NULL DEFAULT '',
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (endpoint_hash),
          KEY idx_manager_push_admin (admin_id),
          KEY idx_manager_push_updated (updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $ready = true;
}

function kd_manager_b64url(string $value): string
{
    return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
}

function kd_manager_vapid_keys(): array
{
    static $keys = null;
    if (is_array($keys)) return $keys;

    $dir = kd_private_dir();
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        throw new RuntimeException('Не удалось создать закрытый каталог для push-ключей');
    }
    $path = $dir . '/manager-vapid.json';

    if (is_file($path)) {
        $raw = @file_get_contents($path);
        $decoded = $raw === false ? null : json_decode($raw, true);
        if (is_array($decoded) && !empty($decoded['privatePem']) && !empty($decoded['publicKey'])) {
            $keys = $decoded;
            return $keys;
        }
    }

    if (!extension_loaded('openssl')) throw new RuntimeException('OpenSSL недоступен для Web Push');

    $resource = openssl_pkey_new([
        'private_key_type' => OPENSSL_KEYTYPE_EC,
        'curve_name' => 'prime256v1',
    ]);
    if ($resource === false) throw new RuntimeException('Не удалось создать VAPID-ключ');

    $privatePem = '';
    if (!openssl_pkey_export($resource, $privatePem) || $privatePem === '') {
        throw new RuntimeException('Не удалось экспортировать VAPID-ключ');
    }

    $details = openssl_pkey_get_details($resource);
    $x = is_array($details['ec'] ?? null) ? ($details['ec']['x'] ?? null) : null;
    $y = is_array($details['ec'] ?? null) ? ($details['ec']['y'] ?? null) : null;
    if (!is_string($x) || !is_string($y)) {
        throw new RuntimeException('PHP не вернул координаты VAPID-ключа');
    }
    $x = str_pad(substr($x, -32), 32, "\0", STR_PAD_LEFT);
    $y = str_pad(substr($y, -32), 32, "\0", STR_PAD_LEFT);

    $keys = [
        'privatePem' => $privatePem,
        'publicKey' => kd_manager_b64url("\x04" . $x . $y),
        'createdAt' => gmdate('c'),
    ];

    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));
    if (file_put_contents($tmp, json_encode($keys, JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        throw new RuntimeException('Не удалось сохранить VAPID-ключ');
    }
    @chmod($tmp, 0600);
    if (!@rename($tmp, $path)) {
        @unlink($tmp);
        throw new RuntimeException('Не удалось активировать VAPID-ключ');
    }
    @chmod($path, 0600);
    return $keys;
}

function kd_manager_der_length(string $der, int &$offset): int
{
    if ($offset >= strlen($der)) throw new RuntimeException('Некорректная DER-подпись');
    $first = ord($der[$offset++]);
    if (($first & 0x80) === 0) return $first;
    $count = $first & 0x7f;
    if ($count < 1 || $count > 4 || $offset + $count > strlen($der)) throw new RuntimeException('Некорректная длина DER');
    $length = 0;
    for ($i = 0; $i < $count; $i++) $length = ($length << 8) | ord($der[$offset++]);
    return $length;
}

function kd_manager_der_to_jose(string $der): string
{
    $offset = 0;
    if (ord($der[$offset++] ?? "\0") !== 0x30) throw new RuntimeException('Некорректная ECDSA-подпись');
    kd_manager_der_length($der, $offset);
    if (ord($der[$offset++] ?? "\0") !== 0x02) throw new RuntimeException('Некорректная ECDSA R');
    $rLen = kd_manager_der_length($der, $offset);
    $r = substr($der, $offset, $rLen);
    $offset += $rLen;
    if (ord($der[$offset++] ?? "\0") !== 0x02) throw new RuntimeException('Некорректная ECDSA S');
    $sLen = kd_manager_der_length($der, $offset);
    $s = substr($der, $offset, $sLen);

    $r = ltrim($r, "\0");
    $s = ltrim($s, "\0");
    if (strlen($r) > 32) $r = substr($r, -32);
    if (strlen($s) > 32) $s = substr($s, -32);
    return str_pad($r, 32, "\0", STR_PAD_LEFT) . str_pad($s, 32, "\0", STR_PAD_LEFT);
}

function kd_manager_vapid_jwt(string $endpoint, array $keys): string
{
    $parts = parse_url($endpoint);
    $scheme = strtolower((string)($parts['scheme'] ?? ''));
    $host = (string)($parts['host'] ?? '');
    if ($scheme !== 'https' || $host === '') throw new RuntimeException('Некорректный push endpoint');
    $port = isset($parts['port']) ? ':' . (int)$parts['port'] : '';
    $audience = $scheme . '://' . $host . $port;

    $header = kd_manager_b64url(json_encode(['typ' => 'JWT', 'alg' => 'ES256'], JSON_UNESCAPED_SLASHES) ?: '{}');
    $payload = kd_manager_b64url(json_encode([
        'aud' => $audience,
        'exp' => time() + 12 * 60 * 60,
        'sub' => 'https://kuzdvor.tw1.ru/manager',
    ], JSON_UNESCAPED_SLASHES) ?: '{}');
    $input = $header . '.' . $payload;

    $der = '';
    if (!openssl_sign($input, $der, (string)$keys['privatePem'], OPENSSL_ALGO_SHA256)) {
        throw new RuntimeException('Не удалось подписать VAPID JWT');
    }
    return $input . '.' . kd_manager_b64url(kd_manager_der_to_jose($der));
}

function kd_manager_push_key_response(): never
{
    $keys = kd_manager_vapid_keys();
    kd_json(['publicKey' => $keys['publicKey']]);
}

function kd_manager_push_subscription_save(int $adminId): never
{
    kd_manager_push_ensure_table();
    $body = kd_json_body(16384);
    $subscription = is_array($body['subscription'] ?? null) ? $body['subscription'] : [];
    $endpoint = trim((string)($subscription['endpoint'] ?? ''));
    if ($endpoint === '' || !str_starts_with($endpoint, 'https://') || strlen($endpoint) > 4000) {
        kd_json(['error' => 'Некорректная push-подписка'], 400);
    }
    $keys = is_array($subscription['keys'] ?? null) ? $subscription['keys'] : [];
    $p256dh = mb_substr((string)($keys['p256dh'] ?? ''), 0, 255);
    $auth = mb_substr((string)($keys['auth'] ?? ''), 0, 255);
    $ua = mb_substr(trim((string)($body['userAgent'] ?? '')), 0, 500);
    $hash = hash('sha256', $endpoint);

    $stmt = kd_db()->prepare('
      INSERT INTO manager_push_subscriptions (endpoint_hash,admin_id,endpoint,p256dh,auth_token,user_agent,created_at,updated_at)
      VALUES (?,?,?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE admin_id=VALUES(admin_id),endpoint=VALUES(endpoint),p256dh=VALUES(p256dh),auth_token=VALUES(auth_token),user_agent=VALUES(user_agent),updated_at=UTC_TIMESTAMP()
    ');
    $stmt->execute([$hash, $adminId, $endpoint, $p256dh, $auth, $ua]);
    kd_json(['ok' => true]);
}

function kd_manager_push_subscription_delete(int $adminId): never
{
    kd_manager_push_ensure_table();
    $body = kd_json_body(8192);
    $endpoint = trim((string)($body['endpoint'] ?? ''));
    if ($endpoint === '') kd_json(['error' => 'Push endpoint не указан'], 400);
    kd_db()->prepare('DELETE FROM manager_push_subscriptions WHERE endpoint_hash=? AND admin_id=?')->execute([hash('sha256', $endpoint), $adminId]);
    kd_json(['ok' => true]);
}

function kd_manager_push_http(string $endpoint, array $keys): int
{
    if (!function_exists('curl_init')) throw new RuntimeException('cURL недоступен для Web Push');
    $jwt = kd_manager_vapid_jwt($endpoint, $keys);
    $headers = [
        'TTL: 90',
        'Urgency: high',
        'Authorization: vapid t=' . $jwt . ', k=' . $keys['publicKey'],
        'Crypto-Key: p256ecdsa=' . $keys['publicKey'],
        'Content-Length: 0',
    ];
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => '',
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HEADER => false,
        CURLOPT_CONNECTTIMEOUT => 2,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
        CURLOPT_USERAGENT => 'KuzdvorManagerPush/1.0',
    ]);
    curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($status === 0 && $error !== '') throw new RuntimeException('Push transport: ' . $error);
    return $status;
}

function kd_send_manager_push_notifications(int $leadId): void
{
    try {
        kd_manager_push_ensure_table();
        $rows = kd_db()->query('SELECT endpoint_hash,endpoint FROM manager_push_subscriptions ORDER BY updated_at DESC LIMIT 20')->fetchAll();
        if (!$rows) return;
        $keys = kd_manager_vapid_keys();
        foreach ($rows as $row) {
            $endpoint = (string)($row['endpoint'] ?? '');
            if ($endpoint === '') continue;
            try {
                $status = kd_manager_push_http($endpoint, $keys);
                if ($status === 404 || $status === 410) {
                    kd_db()->prepare('DELETE FROM manager_push_subscriptions WHERE endpoint_hash=?')->execute([(string)$row['endpoint_hash']]);
                } elseif ($status < 200 || $status >= 300) {
                    error_log('Kuzdvor manager push HTTP ' . $status . ' for lead ' . $leadId);
                }
            } catch (Throwable $e) {
                error_log('Kuzdvor manager push: ' . $e->getMessage());
            }
        }
    } catch (Throwable $e) {
        error_log('Kuzdvor manager push setup: ' . $e->getMessage());
    }
}


function kd_manager_push_test(int $adminId): never
{
    kd_manager_push_ensure_table();
    $stmt = kd_db()->prepare('
      SELECT endpoint_hash,endpoint
      FROM manager_push_subscriptions
      WHERE admin_id=?
      ORDER BY updated_at DESC
      LIMIT 10
    ');
    $stmt->execute([$adminId]);
    $rows = $stmt->fetchAll();
    if (!$rows) {
        kd_json(['error' => 'Push-подписка не найдена. Нажмите «Включить уведомления» ещё раз.'], 409);
    }

    $keys = kd_manager_vapid_keys();
    $accepted = 0;
    $failed = [];
    foreach ($rows as $row) {
        $endpoint = (string)($row['endpoint'] ?? '');
        if ($endpoint === '') continue;
        try {
            $status = kd_manager_push_http($endpoint, $keys);
            if ($status >= 200 && $status < 300) {
                $accepted++;
                continue;
            }
            if ($status === 404 || $status === 410) {
                kd_db()->prepare('DELETE FROM manager_push_subscriptions WHERE endpoint_hash=?')->execute([(string)$row['endpoint_hash']]);
            }
            $failed[] = ['status' => $status];
        } catch (Throwable $e) {
            $failed[] = ['status' => 0, 'error' => mb_substr($e->getMessage(), 0, 300)];
        }
    }

    if ($accepted < 1) {
        $first = $failed[0] ?? [];
        $detail = !empty($first['status'])
            ? 'Push-сервис вернул HTTP ' . (int)$first['status']
            : (string)($first['error'] ?? 'Не удалось связаться с push-сервисом');
        kd_json([
            'error' => 'Тестовое уведомление не отправлено',
            'detail' => $detail,
            'failed' => count($failed),
        ], 502);
    }

    kd_json([
        'ok' => true,
        'sent' => $accepted,
        'failed' => count($failed),
    ]);
}
