<?php
declare(strict_types=1);

const KD_SURVEYOR_SESSION_SECONDS = 2592000;

function kd_surveyor_allowed_origin(): string
{
    $origin = trim((string)($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') return '';
    $allowed = [kd_current_origin(), 'https://bossnedvetskiy-source.github.io', 'https://appassets.androidplatform.net'];
    return in_array($origin, $allowed, true) ? $origin : '';
}

function kd_surveyor_headers(): array
{
    $origin = kd_surveyor_allowed_origin();
    if ($origin === '') return [];
    return [
        'Access-Control-Allow-Origin' => $origin,
        'Access-Control-Allow-Credentials' => 'false',
        'Vary' => 'Origin',
    ];
}

function kd_surveyor_json(mixed $data, int $status = 200, array $extra = []): never
{
    kd_json($data, $status, array_merge(kd_surveyor_headers(), $extra));
}

function kd_surveyor_preflight(): never
{
    $origin = kd_surveyor_allowed_origin();
    if ($origin === '') kd_json(['error' => 'Недопустимый источник запроса'], 403);
    http_response_code(204);
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET,POST,OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 86400');
    header('Vary: Origin');
    exit;
}

function kd_surveyor_ensure_schema(): void
{
    static $ready = false;
    if ($ready) return;
    $db = kd_db();
    $db->exec("CREATE TABLE IF NOT EXISTS surveyor_users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(120) NOT NULL,
      username VARCHAR(120) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(24) NOT NULL DEFAULT 'surveyor',
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_surveyor_username (username),
      KEY idx_surveyor_active (active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS surveyor_sessions (
      token_hash CHAR(64) NOT NULL,
      principal_type VARCHAR(20) NOT NULL,
      principal_id INT UNSIGNED NOT NULL,
      role VARCHAR(24) NOT NULL,
      display_name VARCHAR(120) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(64) NOT NULL DEFAULT '',
      PRIMARY KEY (token_hash),
      KEY idx_surveyor_sessions_expiry (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS surveyor_clients (
      uuid VARCHAR(80) NOT NULL,
      name VARCHAR(120) NOT NULL,
      phone VARCHAR(60) NOT NULL,
      address VARCHAR(500) NOT NULL DEFAULT '',
      revision INT UNSIGNED NOT NULL DEFAULT 1,
      client_updated_at VARCHAR(40) NOT NULL DEFAULT '',
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_by VARCHAR(160) NOT NULL DEFAULT '',
      PRIMARY KEY (uuid),
      KEY idx_surveyor_clients_phone (phone),
      KEY idx_surveyor_clients_updated (updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS surveyor_orders (
      seq_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      uuid VARCHAR(80) NOT NULL,
      order_number VARCHAR(40) NULL,
      client_uuid VARCHAR(80) NULL,
      client_name VARCHAR(120) NOT NULL,
      client_phone VARCHAR(60) NOT NULL,
      address VARCHAR(500) NOT NULL,
      note TEXT NOT NULL,
      work_types_json TEXT NOT NULL,
      configuration_json MEDIUMTEXT NOT NULL,
      status VARCHAR(32) NOT NULL DEFAULT 'draft',
      archived TINYINT(1) NOT NULL DEFAULT 0,
      created_by VARCHAR(160) NOT NULL,
      created_by_name VARCHAR(120) NOT NULL,
      revision INT UNSIGNED NOT NULL DEFAULT 1,
      client_updated_at VARCHAR(40) NOT NULL DEFAULT '',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (seq_id),
      UNIQUE KEY uq_surveyor_order_uuid (uuid),
      UNIQUE KEY uq_surveyor_order_number (order_number),
      KEY idx_surveyor_order_updated (updated_at),
      KEY idx_surveyor_order_creator (created_by),
      KEY idx_surveyor_order_archived (archived)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $column = $db->query("SHOW COLUMNS FROM surveyor_orders LIKE 'configuration_json'")->fetch();
    if (!$column) {
        $db->exec("ALTER TABLE surveyor_orders ADD COLUMN configuration_json MEDIUMTEXT NOT NULL AFTER work_types_json");
    }

    $db->exec('DELETE FROM surveyor_sessions WHERE expires_at <= UTC_TIMESTAMP()');
    $ready = true;
}

function kd_surveyor_bearer_token(): string
{
    $header = trim((string)($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
    if ($header === '' && function_exists('getallheaders')) {
        $headers = getallheaders();
        $header = trim((string)($headers['Authorization'] ?? $headers['authorization'] ?? ''));
    }
    if (!preg_match('/^Bearer\s+([A-Za-z0-9_-]{40,160})$/i', $header, $m)) return '';
    return $m[1];
}

function kd_surveyor_session(): ?array
{
    kd_surveyor_ensure_schema();
    $token = kd_surveyor_bearer_token();
    if ($token === '') return null;
    $stmt = kd_db()->prepare('SELECT principal_type,principal_id,role,display_name,expires_at FROM surveyor_sessions WHERE token_hash=? AND expires_at>UTC_TIMESTAMP() LIMIT 1');
    $stmt->execute([hash('sha256', $token)]);
    $row = $stmt->fetch();
    if (!is_array($row)) return null;
    if ($row['principal_type'] === 'surveyor') {
        $check = kd_db()->prepare('SELECT active,name,role FROM surveyor_users WHERE id=? LIMIT 1');
        $check->execute([(int)$row['principal_id']]);
        $user = $check->fetch();
        if (!$user || !(int)$user['active']) return null;
        $row['display_name'] = (string)$user['name'];
        $row['role'] = (string)$user['role'];
    }
    return $row;
}

function kd_surveyor_require_session(?string $role = null): array
{
    $session = kd_surveyor_session();
    if (!$session) kd_surveyor_json(['error' => 'Требуется вход'], 401);
    if ($role !== null && (string)$session['role'] !== $role) kd_surveyor_json(['error' => 'Недостаточно прав'], 403);
    return $session;
}

function kd_surveyor_principal_key(array $session): string
{
    return (string)$session['principal_type'] . ':' . (int)$session['principal_id'];
}

function kd_surveyor_issue_token(string $type, int $id, string $role, string $name): string
{
    $token = rtrim(strtr(base64_encode(random_bytes(48)), '+/', '-_'), '=');
    $hash = hash('sha256', $token);
    kd_db()->prepare('DELETE FROM surveyor_sessions WHERE expires_at<=UTC_TIMESTAMP()')->execute();
    $stmt = kd_db()->prepare('INSERT INTO surveyor_sessions (token_hash,principal_type,principal_id,role,display_name,expires_at,created_at,ip_address) VALUES (?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 30 DAY),UTC_TIMESTAMP(),?)');
    $stmt->execute([$hash, $type, $id, $role, $name, kd_client_ip()]);
    return $token;
}

function kd_surveyor_login(): never
{
    kd_surveyor_ensure_schema();
    kd_body_limit(4096);
    $body = kd_json_body(4096);
    $username = trim((string)($body['username'] ?? ''));
    $password = (string)($body['password'] ?? '');
    if ($username === '' || $password === '') kd_surveyor_json(['error' => 'Введите логин и пароль'], 400);

    $ipKey = 'surveyor:' . kd_client_ip();
    $rate = kd_db()->prepare('SELECT attempt_count,reset_at FROM login_rate_limits WHERE ip_key=? LIMIT 1');
    $rate->execute([$ipKey]);
    $limit = $rate->fetch();
    if ($limit && strtotime((string)$limit['reset_at'] . ' UTC') > time() && (int)$limit['attempt_count'] >= 7) {
        kd_surveyor_json(['error' => 'Слишком много попыток. Попробуйте через 15 минут.'], 429, ['Retry-After' => '900']);
    }

    $stmt = kd_db()->prepare('SELECT id,name,username,password_hash,role,active FROM surveyor_users WHERE username=? LIMIT 1');
    $stmt->execute([$username]);
    $user = $stmt->fetch();
    $type = 'surveyor';
    $id = 0;
    $role = 'surveyor';
    $name = '';

    if ($user && (int)$user['active'] === 1 && password_verify($password, (string)$user['password_hash'])) {
        $id = (int)$user['id'];
        $role = in_array((string)$user['role'], ['owner','surveyor'], true) ? (string)$user['role'] : 'surveyor';
        $name = (string)$user['name'];
        if (password_needs_rehash((string)$user['password_hash'], PASSWORD_DEFAULT)) {
            kd_db()->prepare('UPDATE surveyor_users SET password_hash=?,updated_at=UTC_TIMESTAMP() WHERE id=?')
                ->execute([password_hash($password, PASSWORD_DEFAULT), $id]);
        }
    } else {
        $adminStmt = kd_db()->prepare('SELECT id,username,password_hash FROM admin_auth WHERE username=? LIMIT 1');
        $adminStmt->execute([$username]);
        $admin = $adminStmt->fetch();
        if ($admin && password_verify($password, (string)$admin['password_hash'])) {
            $type = 'admin';
            $id = (int)$admin['id'];
            $role = 'owner';
            $name = 'Собственник';
        }
    }

    if ($id <= 0) {
        $resetAt = gmdate('Y-m-d H:i:s', time() + 900);
        kd_db()->prepare('INSERT INTO login_rate_limits (ip_key,attempt_count,reset_at) VALUES (?,1,?) ON DUPLICATE KEY UPDATE attempt_count=IF(reset_at<=UTC_TIMESTAMP(),1,attempt_count+1),reset_at=IF(reset_at<=UTC_TIMESTAMP(),VALUES(reset_at),reset_at)')
            ->execute([$ipKey, $resetAt]);
        kd_surveyor_json(['error' => 'Неверный логин или пароль'], 401);
    }

    kd_db()->prepare('DELETE FROM login_rate_limits WHERE ip_key=?')->execute([$ipKey]);
    $token = kd_surveyor_issue_token($type, $id, $role, $name);
    kd_surveyor_json([
        'ok' => true,
        'token' => $token,
        'expiresIn' => KD_SURVEYOR_SESSION_SECONDS,
        'user' => ['id' => $type . ':' . $id, 'name' => $name, 'role' => $role]
    ]);
}

function kd_surveyor_logout(): never
{
    $token = kd_surveyor_bearer_token();
    if ($token !== '') kd_db()->prepare('DELETE FROM surveyor_sessions WHERE token_hash=?')->execute([hash('sha256', $token)]);
    kd_surveyor_json(['ok' => true]);
}

function kd_surveyor_valid_uuid(mixed $value): string
{
    $uuid = trim((string)$value);
    if (!preg_match('/^[A-Za-z0-9_-]{6,80}$/', $uuid)) kd_surveyor_json(['error' => 'Некорректный идентификатор'], 400);
    return $uuid;
}

function kd_surveyor_work_types(mixed $value): array
{
    $allowed = ['gates','fence','canopy'];
    $types = is_array($value) ? array_values(array_unique(array_map('strval', $value))) : [];
    $types = array_values(array_filter($types, static fn(string $type): bool => in_array($type, $allowed, true)));
    return $types;
}

function kd_surveyor_row_to_client(array $row): array
{
    return [
        'id' => (string)$row['uuid'], 'name' => (string)$row['name'], 'phone' => (string)$row['phone'],
        'address' => (string)$row['address'], 'serverRevision' => (int)$row['revision'],
        'updatedAt' => (string)$row['client_updated_at'], 'serverUpdatedAt' => (string)$row['updated_at']
    ];
}

function kd_surveyor_row_to_order(array $row): array
{
    $types = json_decode((string)$row['work_types_json'], true);
    $configuration = json_decode((string)($row['configuration_json'] ?? '{}'), true);
    return [
        'id' => (string)$row['uuid'], 'number' => (string)($row['order_number'] ?? ''),
        'clientId' => (string)($row['client_uuid'] ?? ''), 'clientName' => (string)$row['client_name'],
        'clientPhone' => (string)$row['client_phone'], 'address' => (string)$row['address'],
        'note' => (string)$row['note'], 'workTypes' => is_array($types) ? $types : [],
        'configuration' => is_array($configuration) ? $configuration : [],
        'status' => (string)$row['status'], 'archived' => (bool)$row['archived'],
        'createdBy' => (string)$row['created_by'], 'createdByName' => (string)$row['created_by_name'],
        'serverRevision' => (int)$row['revision'], 'updatedAt' => (string)$row['client_updated_at'],
        'createdAt' => (string)$row['created_at'], 'serverUpdatedAt' => (string)$row['updated_at']
    ];
}

function kd_surveyor_sync_client(array $item, array $session): array
{
    $uuid = kd_surveyor_valid_uuid($item['id'] ?? '');
    $name = mb_substr(trim((string)($item['name'] ?? '')), 0, 120);
    $phone = mb_substr(trim((string)($item['phone'] ?? '')), 0, 60);
    $address = mb_substr(trim((string)($item['address'] ?? '')), 0, 500);
    $updatedAt = mb_substr(trim((string)($item['updatedAt'] ?? '')), 0, 40);
    $incomingRevision = max(0, (int)($item['serverRevision'] ?? 0));
    if (strlen(preg_replace('/\D/', '', $phone) ?? '') < 10) kd_surveyor_json(['error' => 'У клиента не заполнен телефон'], 400);
    $key = kd_surveyor_principal_key($session);

    $stmt = kd_db()->prepare('SELECT * FROM surveyor_clients WHERE uuid=? LIMIT 1');
    $stmt->execute([$uuid]);
    $existing = $stmt->fetch();
    if (!$existing) {
        kd_db()->prepare('INSERT INTO surveyor_clients (uuid,name,phone,address,revision,client_updated_at,updated_at,updated_by) VALUES (?,?,?,?,1,?,UTC_TIMESTAMP(),?)')
            ->execute([$uuid,$name,$phone,$address,$updatedAt,$key]);
    } elseif ($incomingRevision === (int)$existing['revision']) {
        kd_db()->prepare('UPDATE surveyor_clients SET name=?,phone=?,address=?,revision=revision+1,client_updated_at=?,updated_at=UTC_TIMESTAMP(),updated_by=? WHERE uuid=?')
            ->execute([$name,$phone,$address,$updatedAt,$key,$uuid]);
    } elseif ($incomingRevision === 0 && (string)$existing['client_updated_at'] === $updatedAt) {
        // Idempotent retry after the server accepted a create but the client missed the response.
    } else {
        return ['conflict' => true, 'entity' => 'client', 'id' => $uuid, 'server' => kd_surveyor_row_to_client($existing)];
    }
    $stmt->execute([$uuid]);
    return ['conflict' => false, 'server' => kd_surveyor_row_to_client($stmt->fetch())];
}

function kd_surveyor_sync_order(array $item, array $session): array
{
    $uuid = kd_surveyor_valid_uuid($item['id'] ?? '');
    $clientUuid = trim((string)($item['clientId'] ?? ''));
    if ($clientUuid !== '') kd_surveyor_valid_uuid($clientUuid);
    $name = mb_substr(trim((string)($item['clientName'] ?? '')),0,120);
    $phone = mb_substr(trim((string)($item['clientPhone'] ?? '')),0,60);
    $address = mb_substr(trim((string)($item['address'] ?? '')),0,500);
    $note = mb_substr(trim((string)($item['note'] ?? '')),0,5000);
    $types = kd_surveyor_work_types($item['workTypes'] ?? []);
    $configuration = is_array($item['configuration'] ?? null) ? $item['configuration'] : [];
    $configurationJson = json_encode($configuration, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($configurationJson === false || strlen($configurationJson) > 120000) kd_surveyor_json(['error' => 'Схема объекта слишком большая'],413);
    $status = in_array((string)($item['status'] ?? ''), ['draft','ready'], true) ? (string)$item['status'] : 'draft';
    $updatedAt = mb_substr(trim((string)($item['updatedAt'] ?? '')),0,40);
    $incomingRevision = max(0,(int)($item['serverRevision'] ?? 0));
    $key = kd_surveyor_principal_key($session);
    if (strlen(preg_replace('/\D/', '', $phone) ?? '') < 10 || $address === '') kd_surveyor_json(['error' => 'Для замера нужны телефон и адрес объекта'],400);

    $stmt = kd_db()->prepare('SELECT * FROM surveyor_orders WHERE uuid=? LIMIT 1');
    $stmt->execute([$uuid]);
    $existing = $stmt->fetch();
    $archived = !empty($item['archived']) && (string)$session['role'] === 'owner' ? 1 : 0;

    if (!$existing) {
        $createdBy = $key;
        $createdByName = mb_substr(trim((string)($item['createdByName'] ?? $session['display_name'])),0,120);
        kd_db()->prepare('INSERT INTO surveyor_orders (uuid,client_uuid,client_name,client_phone,address,note,work_types_json,configuration_json,status,archived,created_by,created_by_name,revision,client_updated_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?,UTC_TIMESTAMP(),UTC_TIMESTAMP())')
            ->execute([$uuid,$clientUuid !== '' ? $clientUuid : null,$name,$phone,$address,$note,json_encode($types),$configurationJson,$status,$archived,$createdBy,$createdByName,$updatedAt]);
        $seq = (int)kd_db()->lastInsertId();
        $number = 'ЗМ-' . str_pad((string)$seq, 6, '0', STR_PAD_LEFT);
        kd_db()->prepare('UPDATE surveyor_orders SET order_number=? WHERE seq_id=?')->execute([$number,$seq]);
    } else {
        if ((string)$session['role'] !== 'owner' && (string)$existing['created_by'] !== $key) {
            kd_surveyor_json(['error' => 'Нет доступа к этому замеру'],403);
        }
        if ($incomingRevision === (int)$existing['revision']) {
            $nextArchived = (string)$session['role'] === 'owner' ? $archived : (int)$existing['archived'];
            kd_db()->prepare('UPDATE surveyor_orders SET client_uuid=?,client_name=?,client_phone=?,address=?,note=?,work_types_json=?,configuration_json=?,status=?,archived=?,revision=revision+1,client_updated_at=?,updated_at=UTC_TIMESTAMP() WHERE uuid=?')
                ->execute([$clientUuid !== '' ? $clientUuid : null,$name,$phone,$address,$note,json_encode($types),$configurationJson,$status,$nextArchived,$updatedAt,$uuid]);
        } elseif ($incomingRevision === 0 && (string)$existing['client_updated_at'] === $updatedAt) {
            // Idempotent create retry.
        } else {
            return ['conflict' => true, 'entity' => 'survey', 'id' => $uuid, 'server' => kd_surveyor_row_to_order($existing)];
        }
    }
    $stmt->execute([$uuid]);
    return ['conflict' => false, 'server' => kd_surveyor_row_to_order($stmt->fetch())];
}

function kd_surveyor_sync(): never
{
    $session = kd_surveyor_require_session();
    $body = kd_json_body(524288);
    $clients = is_array($body['clients'] ?? null) ? array_slice($body['clients'],0,200) : [];
    $surveys = is_array($body['surveys'] ?? null) ? array_slice($body['surveys'],0,200) : [];
    $since = trim((string)($body['since'] ?? '1970-01-01 00:00:00'));
    if (!preg_match('/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/', $since)) $since = '1970-01-01 00:00:00';

    $acks = ['clients'=>[],'surveys'=>[]];
    $conflicts = [];
    kd_db()->beginTransaction();
    try {
        foreach ($clients as $item) {
            if (!is_array($item)) continue;
            $result = kd_surveyor_sync_client($item,$session);
            if ($result['conflict']) $conflicts[] = $result; else $acks['clients'][] = $result['server'];
        }
        foreach ($surveys as $item) {
            if (!is_array($item)) continue;
            $result = kd_surveyor_sync_order($item,$session);
            if ($result['conflict']) $conflicts[] = $result; else $acks['surveys'][] = $result['server'];
        }
        kd_db()->commit();
    } catch (Throwable $e) {
        if (kd_db()->inTransaction()) kd_db()->rollBack();
        throw $e;
    }

    $serverNow = (string)kd_db()->query("SELECT DATE_FORMAT(UTC_TIMESTAMP(),'%Y-%m-%d %H:%i:%s')")->fetchColumn();
    $clientStmt = kd_db()->prepare('SELECT * FROM surveyor_clients WHERE updated_at>=? ORDER BY updated_at ASC LIMIT 1000');
    $clientStmt->execute([$since]);
    $pullClients = array_map('kd_surveyor_row_to_client', $clientStmt->fetchAll());

    $key = kd_surveyor_principal_key($session);
    if ((string)$session['role'] === 'owner') {
        $orderStmt = kd_db()->prepare('SELECT * FROM surveyor_orders WHERE updated_at>=? ORDER BY updated_at ASC LIMIT 1000');
        $orderStmt->execute([$since]);
    } else {
        $orderStmt = kd_db()->prepare('SELECT * FROM surveyor_orders WHERE updated_at>=? AND created_by=? ORDER BY updated_at ASC LIMIT 1000');
        $orderStmt->execute([$since,$key]);
    }
    $pullSurveys = array_map('kd_surveyor_row_to_order', $orderStmt->fetchAll());

    kd_surveyor_json([
        'ok'=>true,'serverNow'=>$serverNow,'acks'=>$acks,'conflicts'=>$conflicts,
        'pull'=>['clients'=>$pullClients,'surveys'=>$pullSurveys],
        'user'=>['id'=>$key,'name'=>(string)$session['display_name'],'role'=>(string)$session['role']]
    ]);
}

function kd_surveyor_users(string $method, string $suffix): never
{
    $session = kd_surveyor_require_session('owner');
    if ($method === 'GET' && $suffix === '') {
        $rows = kd_db()->query('SELECT id,name,username,role,active,created_at,updated_at FROM surveyor_users ORDER BY active DESC,name ASC')->fetchAll();
        kd_surveyor_json(['users'=>array_map(static fn(array $row): array => [
            'id'=>'surveyor:'.(int)$row['id'],'numericId'=>(int)$row['id'],'name'=>(string)$row['name'],
            'login'=>(string)$row['username'],'role'=>(string)$row['role'],'active'=>(bool)$row['active'],
            'createdAt'=>(string)$row['created_at'],'updatedAt'=>(string)$row['updated_at']
        ],$rows)]);
    }
    if ($method === 'POST' && $suffix === '') {
        $body = kd_json_body(8192);
        $id = max(0,(int)($body['numericId'] ?? 0));
        $name = mb_substr(trim((string)($body['name'] ?? '')),0,120);
        $login = mb_substr(trim((string)($body['login'] ?? '')),0,120);
        $role = in_array((string)($body['role'] ?? ''),['owner','surveyor'],true) ? (string)$body['role'] : 'surveyor';
        $password = (string)($body['password'] ?? '');
        if ($name === '' || $login === '') kd_surveyor_json(['error'=>'Заполните имя и логин'],400);
        if ($id <= 0 && strlen($password) < 6) kd_surveyor_json(['error'=>'Пароль нового сотрудника должен быть не короче 6 символов'],400);
        if ($id > 0) {
            $current = kd_db()->prepare('SELECT id FROM surveyor_users WHERE id=? LIMIT 1'); $current->execute([$id]);
            if (!$current->fetch()) kd_surveyor_json(['error'=>'Сотрудник не найден'],404);
            if ($password !== '' && strlen($password) < 6) kd_surveyor_json(['error'=>'Пароль должен быть не короче 6 символов'],400);
            if ($password !== '') {
                kd_db()->prepare('UPDATE surveyor_users SET name=?,username=?,role=?,password_hash=?,updated_at=UTC_TIMESTAMP() WHERE id=?')
                    ->execute([$name,$login,$role,password_hash($password,PASSWORD_DEFAULT),$id]);
            } else {
                kd_db()->prepare('UPDATE surveyor_users SET name=?,username=?,role=?,updated_at=UTC_TIMESTAMP() WHERE id=?')
                    ->execute([$name,$login,$role,$id]);
            }
        } else {
            try {
                kd_db()->prepare('INSERT INTO surveyor_users (name,username,password_hash,role,active,created_at,updated_at) VALUES (?,?,?,?,1,UTC_TIMESTAMP(),UTC_TIMESTAMP())')
                    ->execute([$name,$login,password_hash($password,PASSWORD_DEFAULT),$role]);
                $id = (int)kd_db()->lastInsertId();
            } catch (PDOException $e) {
                if ((string)$e->getCode() === '23000') kd_surveyor_json(['error'=>'Такой логин уже используется'],409);
                throw $e;
            }
        }
        kd_surveyor_json(['ok'=>true,'id'=>'surveyor:'.$id]);
    }
    if ($method === 'POST' && preg_match('#^(\d+)/toggle$#',$suffix,$m)) {
        $id = (int)$m[1];
        $stmt = kd_db()->prepare('SELECT active FROM surveyor_users WHERE id=? LIMIT 1'); $stmt->execute([$id]);
        $row = $stmt->fetch();
        if (!$row) kd_surveyor_json(['error'=>'Сотрудник не найден'],404);
        $active = (int)$row['active'] ? 0 : 1;
        kd_db()->prepare('UPDATE surveyor_users SET active=?,updated_at=UTC_TIMESTAMP() WHERE id=?')->execute([$active,$id]);
        if (!$active) kd_db()->prepare("DELETE FROM surveyor_sessions WHERE principal_type='surveyor' AND principal_id=?")->execute([$id]);
        kd_surveyor_json(['ok'=>true,'active'=>(bool)$active]);
    }
    kd_surveyor_json(['error'=>'Маршрут не найден'],404);
}

function kd_surveyor_handle(string $route, string $method): never
{
    if ($method === 'OPTIONS') kd_surveyor_preflight();
    kd_surveyor_ensure_schema();
    $suffix = substr($route, strlen('surveyor/'));
    if ($suffix === 'login' && $method === 'POST') kd_surveyor_login();
    if ($suffix === 'logout' && $method === 'POST') {
        kd_surveyor_require_session(); kd_surveyor_logout();
    }
    if ($suffix === 'me' && $method === 'GET') {
        $session = kd_surveyor_require_session();
        kd_surveyor_json(['user'=>['id'=>kd_surveyor_principal_key($session),'name'=>(string)$session['display_name'],'role'=>(string)$session['role']]]);
    }
    if ($suffix === 'sync' && $method === 'POST') kd_surveyor_sync();
    if ($suffix === 'users' || str_starts_with($suffix,'users/')) {
        kd_surveyor_users($method, $suffix === 'users' ? '' : substr($suffix,strlen('users/')));
    }
    kd_surveyor_json(['error'=>'Маршрут не найден'],404);
}
