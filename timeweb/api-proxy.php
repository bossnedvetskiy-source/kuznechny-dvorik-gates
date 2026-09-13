<?php
declare(strict_types=1);

const KUZDVOR_BACKEND = 'https://kuznechny-dvorik-gates.boss-nedvetskiy.workers.dev';

$proxyPath = ltrim((string)($_GET['__proxy_path'] ?? ''), '/');
unset($_GET['__proxy_path']);

if ($proxyPath === '' || !preg_match('#^(?:api/|catalog-media/)#', $proxyPath)) {
    http_response_code(404);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Маршрут не найден'], JSON_UNESCAPED_UNICODE);
    exit;
}

$query = http_build_query($_GET);
$target = KUZDVOR_BACKEND . '/' . $proxyPath . ($query !== '' ? '?' . $query : '');
$method = strtoupper((string)($_SERVER['REQUEST_METHOD'] ?? 'GET'));
$body = in_array($method, ['GET', 'HEAD'], true) ? null : file_get_contents('php://input');

$incomingHeaders = function_exists('getallheaders') ? getallheaders() : [];
$outgoingHeaders = [];
foreach ($incomingHeaders as $name => $value) {
    $lower = strtolower((string)$name);
    if (in_array($lower, ['host', 'content-length', 'connection', 'origin', 'referer', 'accept-encoding'], true)) {
        continue;
    }
    if (in_array($lower, ['accept', 'content-type', 'cookie', 'user-agent'], true)) {
        $outgoingHeaders[] = $name . ': ' . $value;
    }
}
$outgoingHeaders[] = 'Origin: ' . KUZDVOR_BACKEND;
$outgoingHeaders[] = 'Referer: ' . KUZDVOR_BACKEND . '/';
$outgoingHeaders[] = 'X-Kuzdvor-Timeweb-Proxy: 1';

if (!function_exists('curl_init')) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'На хостинге недоступен модуль cURL'], JSON_UNESCAPED_UNICODE);
    exit;
}

$responseHeaders = [];
$ch = curl_init($target);
curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => $method,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 12,
    CURLOPT_TIMEOUT => 45,
    CURLOPT_HTTPHEADER => $outgoingHeaders,
    CURLOPT_HEADERFUNCTION => static function ($curl, string $headerLine) use (&$responseHeaders): int {
        $length = strlen($headerLine);
        $line = trim($headerLine);
        if ($line !== '' && strpos($line, ':') !== false) {
            [$name, $value] = array_map('trim', explode(':', $line, 2));
            $responseHeaders[] = [$name, $value];
        }
        return $length;
    },
]);

if ($body !== null) {
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
}

$responseBody = curl_exec($ch);
if ($responseBody === false) {
    $message = curl_error($ch);
    curl_close($ch);
    http_response_code(502);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => 'Не удалось связаться с серверной частью сайта', 'detail' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

$status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
curl_close($ch);
http_response_code($status > 0 ? $status : 502);

$forward = ['content-type', 'cache-control', 'content-disposition', 'etag', 'last-modified', 'set-cookie'];
foreach ($responseHeaders as [$name, $value]) {
    if (in_array(strtolower($name), $forward, true)) {
        header($name . ': ' . $value, false);
    }
}
header('X-Content-Type-Options: nosniff');

echo $responseBody;
