<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require __DIR__ . '/backend/bootstrap.php';

function prompt(string $label, string $default = ''): string
{
    $suffix = $default !== '' ? " [{$default}]" : '';
    fwrite(STDOUT, $label . $suffix . ': ');
    $value = trim((string)fgets(STDIN));
    return $value !== '' ? $value : $default;
}

function secret_prompt(string $label): string
{
    fwrite(STDOUT, $label . ': ');
    $stty = trim((string)shell_exec('stty -g 2>/dev/null'));
    if ($stty !== '') shell_exec('stty -echo 2>/dev/null');
    $value = rtrim((string)fgets(STDIN), "\r\n");
    if ($stty !== '') shell_exec('stty ' . escapeshellarg($stty) . ' 2>/dev/null');
    fwrite(STDOUT, PHP_EOL);
    return $value;
}

function run_schema(PDO $pdo, string $file): void
{
    $sql = (string)file_get_contents($file);
    $parts = preg_split('/;\s*(?:\r?\n|$)/', $sql) ?: [];
    foreach ($parts as $statement) {
        $statement = trim($statement);
        if ($statement !== '') $pdo->exec($statement);
    }
}

fwrite(STDOUT, "\nКузнечный Дворик — настройка PHP/MySQL Timeweb\n");
fwrite(STDOUT, "Пароли не выводятся на экран и будут сохранены только вне public_html.\n\n");

$host = prompt('MySQL host', 'localhost');
$port = (int)prompt('MySQL port', '3306');
$dbName = prompt('Имя базы MySQL');
$dbUser = prompt('Пользователь MySQL');
$dbPassword = secret_prompt('Пароль MySQL');

if ($dbName === '' || $dbUser === '' || $dbPassword === '') {
    fwrite(STDERR, "Ошибка: заполните имя базы, пользователя и пароль.\n");
    exit(1);
}

try {
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$dbName};charset=utf8mb4", $dbUser, $dbPassword, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    run_schema($pdo, __DIR__ . '/backend/schema.mysql.sql');
} catch (Throwable $e) {
    fwrite(STDERR, "Не удалось подключиться к MySQL или создать таблицы: {$e->getMessage()}\n");
    exit(1);
}

$privateDir = kd_private_dir();
$storageDir = $privateDir . '/storage';
foreach ([$privateDir, $storageDir, $storageDir . '/catalog', $storageDir . '/excel', $storageDir . '/excel/uploads'] as $dir) {
    if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) {
        fwrite(STDERR, "Не удалось создать {$dir}\n");
        exit(1);
    }
    @chmod($dir, 0700);
}

$config = [
    'db_host' => $host,
    'db_port' => $port,
    'db_name' => $dbName,
    'db_user' => $dbUser,
    'db_password' => $dbPassword,
    'created_at' => gmdate('c'),
];
$configPhp = "<?php\nreturn " . var_export($config, true) . ";\n";
if (file_put_contents(kd_config_path(), $configPhp, LOCK_EX) === false) {
    fwrite(STDERR, "Не удалось сохранить приватную конфигурацию.\n");
    exit(1);
}
@chmod(kd_config_path(), 0600);

fwrite(STDOUT, "\nСоздаём отдельный вход в админку Timeweb.\n");
$username = prompt('Логин администратора');
$password = secret_prompt('Новый пароль администратора');
$password2 = secret_prompt('Повторите пароль');
if ($username === '' || strlen($password) < 10 || !hash_equals($password, $password2)) {
    fwrite(STDERR, "Ошибка: логин обязателен, пароль — минимум 10 символов, оба пароля должны совпасть.\n");
    exit(1);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $pdo->prepare('INSERT INTO admin_auth (id,username,password_hash,created_at,updated_at) VALUES (1,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE username=VALUES(username),password_hash=VALUES(password_hash),updated_at=UTC_TIMESTAMP()');
$stmt->execute([$username, $hash]);
$pdo->exec('DELETE FROM admin_sessions');

fwrite(STDOUT, "\nГотово. PHP/MySQL backend настроен.\n");
fwrite(STDOUT, "Конфигурация: " . kd_config_path() . " (вне public_html)\n");
fwrite(STDOUT, "Следующий шаг: php migrate-from-cloudflare.php\n");
