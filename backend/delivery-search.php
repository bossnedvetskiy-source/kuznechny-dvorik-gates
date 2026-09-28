<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (kd_method() !== 'GET') kd_json(['error' => 'Метод не поддерживается'], 405);
if (!kd_is_configured()) kd_json(['error' => 'PHP/MySQL backend ещё не настроен', 'backend' => 'timeweb-php'], 503);

try {
    kd_json(kd_delivery_search_places((string)($_GET['place'] ?? '')));
} catch (Throwable $e) {
    error_log('Kuzdvor delivery place search: ' . $e->getMessage());
    kd_json(['error' => 'Не удалось найти населённые пункты. Попробуйте ещё раз.'], 503);
}

function kd_delivery_search_places(string $place): array
{
    $place = preg_replace('/\s+/u', ' ', trim($place)) ?? '';
    $length = mb_strlen($place, 'UTF-8');
    if ($length < 2 || $length > 80) {
        kd_json(['error' => 'Укажите название населённого пункта'], 400);
    }

    $settings = kd_delivery_settings();
    $origin = $settings['origin'] ?? ['lat' => 52.96328, 'lon' => 55.928612, 'name' => 'Мелеуз'];
    $originLat = (float)($origin['lat'] ?? 52.96328);
    $originLon = (float)($origin['lon'] ?? 55.928612);

    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
        'q' => $place . ', Россия',
        'format' => 'jsonv2',
        'addressdetails' => '1',
        'accept-language' => 'ru',
        'countrycodes' => 'ru',
        'limit' => '10',
        // Bias the search toward Bashkortostan and nearby border areas without
        // excluding a customer who is slightly outside the normal service zone.
        'viewbox' => '50.0,57.5,61.5,50.0',
        'bounded' => '0',
    ]);

    $results = kd_delivery_search_http_json($url, [
        'User-Agent: KuznechnyDvorikDeliveryCalculator/2.2 (https://kuzdvor.tw1.ru)'
    ]);

    $queryKey = kd_delivery_search_normalize($place);
    $choices = [];
    foreach ($results as $candidate) {
        if (!is_array($candidate)) continue;
        $lat = (float)($candidate['lat'] ?? 0);
        $lon = (float)($candidate['lon'] ?? 0);
        if (!$lat || !$lon) continue;

        $address = is_array($candidate['address'] ?? null) ? $candidate['address'] : [];
        [$locality, $district, $region] = kd_delivery_search_parts($candidate, $address, $place);
        if ($locality === '') continue;

        $localityKey = kd_delivery_search_normalize($locality);
        if ($queryKey !== '' && !str_contains($localityKey, $queryKey) && !str_contains($queryKey, $localityKey)) continue;

        $secondaryParts = [];
        if ($district !== '') $secondaryParts[] = $district;
        if ($region !== '' && kd_delivery_search_normalize($region) !== kd_delivery_search_normalize($district)) $secondaryParts[] = $region;
        $secondary = implode(', ', $secondaryParts);
        $label = implode(', ', array_values(array_unique(array_filter([$locality, $district, $region]))));

        $queryParts = [$locality];
        if ($district !== '') $queryParts[] = $district;
        if ($region !== '') $queryParts[] = $region;
        $queryParts[] = 'Россия';
        $exactQuery = implode(', ', array_values(array_unique(array_filter($queryParts))));

        $osmType = (string)($candidate['osm_type'] ?? '');
        $osmId = (string)($candidate['osm_id'] ?? '');
        $identity = $osmType . ':' . $osmId;
        if ($identity === ':') $identity = sprintf('%.5F:%.5F', $lat, $lon);

        $choices[$identity] = [
            'name' => $locality,
            'label' => $label,
            'secondary' => $secondary,
            'query' => mb_substr($exactQuery, 0, 100, 'UTF-8'),
            'lat' => $lat,
            'lon' => $lon,
            '_distance' => kd_delivery_search_haversine($originLat, $originLon, $lat, $lon),
        ];
    }

    $choices = array_values($choices);
    usort($choices, static fn(array $a, array $b): int => ($a['_distance'] ?? INF) <=> ($b['_distance'] ?? INF));

    // Prefer settlements reasonably close to the normal work area. If none are
    // close, keep the nearest results so out-of-area requests still work.
    $nearby = array_values(array_filter($choices, static fn(array $item): bool => (float)($item['_distance'] ?? INF) <= 350));
    if ($nearby) $choices = $nearby;
    $choices = array_slice($choices, 0, 6);
    foreach ($choices as &$choice) unset($choice['_distance']);
    unset($choice);

    return ['query' => $place, 'choices' => $choices];
}

function kd_delivery_search_parts(array $item, array $address, string $fallback): array
{
    $locality = '';
    foreach (['name', 'city', 'town', 'village', 'hamlet'] as $key) {
        $value = $key === 'name' ? ($item['name'] ?? '') : ($address[$key] ?? '');
        $value = trim((string)$value);
        if ($value !== '') {
            $locality = $value;
            break;
        }
    }
    if ($locality === '') $locality = trim($fallback);

    $district = '';
    foreach (['county', 'state_district', 'district'] as $key) {
        $value = trim((string)($address[$key] ?? ''));
        if ($value !== '' && kd_delivery_search_normalize($value) !== kd_delivery_search_normalize($locality)) {
            $district = $value;
            break;
        }
    }
    if ($district === '') {
        $municipality = trim((string)($address['municipality'] ?? ''));
        if ($municipality !== ''
            && kd_delivery_search_normalize($municipality) !== kd_delivery_search_normalize($locality)
            && preg_match('/район|округ|муниципал/u', mb_strtolower($municipality, 'UTF-8'))) {
            $district = $municipality;
        }
    }

    // Some OSM objects omit county/state_district in addressdetails but still
    // include the municipality in display_name. Recover it so every visible
    // suggestion carries a useful administrative address instead of
    // "село / деревня".
    $displayParts = array_values(array_filter(array_map(
        static fn($part): string => trim((string)$part),
        explode(',', (string)($item['display_name'] ?? ''))
    )));
    if ($district === '') {
        foreach ($displayParts as $part) {
            $normalized = kd_delivery_search_normalize($part);
            if ($normalized === '' || $normalized === kd_delivery_search_normalize($locality)) continue;
            if (preg_match('/район|округ|муниципал/u', mb_strtolower($part, 'UTF-8'))) {
                $district = $part;
                break;
            }
        }
    }

    $region = trim((string)($address['state'] ?? $address['region'] ?? ''));
    if ($region === '') {
        foreach ($displayParts as $part) {
            if (preg_match('/республика|область|край/u', mb_strtolower($part, 'UTF-8'))) {
                $region = $part;
                break;
            }
        }
    }
    if (kd_delivery_search_normalize($region) === kd_delivery_search_normalize($locality)) $region = '';
    return [$locality, $district, $region];
}

function kd_delivery_search_normalize(string $value): string
{
    $value = mb_strtolower(trim($value), 'UTF-8');
    $value = str_replace('ё', 'е', $value);
    return preg_replace('/[^а-яa-z0-9]+/u', '', $value) ?? '';
}

function kd_delivery_search_http_json(string $url, array $headers = []): array
{
    $ch = curl_init($url);
    if ($ch === false) throw new RuntimeException('Не удалось запустить HTTP-клиент');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_HTTPHEADER => $headers,
    ]);
    $raw = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if ($raw === false || $status < 200 || $status >= 300) {
        throw new RuntimeException($error !== '' ? $error : 'Внешний сервис вернул HTTP ' . $status);
    }
    $data = json_decode((string)$raw, true);
    if (!is_array($data)) throw new RuntimeException('Внешний сервис вернул некорректный ответ');
    return $data;
}

function kd_delivery_search_haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
}
