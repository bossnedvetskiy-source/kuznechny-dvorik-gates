<?php
declare(strict_types=1);

require_once __DIR__ . '/bootstrap.php';

if (kd_method() !== 'GET') kd_json(['error' => 'Метод не поддерживается'], 405);
if (!kd_is_configured()) kd_json(['error' => 'PHP/MySQL backend ещё не настроен', 'backend' => 'timeweb-php'], 503);

try {
    $lat = isset($_GET['lat']) && is_numeric($_GET['lat']) ? (float)$_GET['lat'] : null;
    $lon = isset($_GET['lon']) && is_numeric($_GET['lon']) ? (float)$_GET['lon'] : null;
    kd_json(kd_delivery_api_quote((string)($_GET['place'] ?? ''), $lat, $lon));
} catch (Throwable $e) {
    error_log('Kuzdvor delivery API: ' . $e->getMessage());
    kd_json(['error' => 'Не удалось рассчитать доставку. Попробуйте ещё раз.'], 503);
}

function kd_delivery_api_quote(string $place, ?float $selectedLat = null, ?float $selectedLon = null): array
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
        $name = trim((string)($item['name'] ?? ''));
        if (kd_delivery_api_normalize($name) === kd_delivery_api_normalize($place)) {
            return [
                'price' => max(0, (int)($item['price'] ?? 0)),
                'distanceKm' => null,
                'requestedName' => $place,
                'shortName' => $name !== '' ? $name : $place,
                'resolvedName' => $name !== '' ? $name : $place,
                'serviceAreaKm' => $serviceArea,
                'outOfArea' => false,
                'resolved' => true,
                'source' => 'fixed',
            ];
        }
    }

    $origin = $settings['origin'] ?? ['lat' => 52.96328, 'lon' => 55.928612, 'name' => 'Мелеуз'];
    $best = null;

    $hasSelectedCoordinates = $selectedLat !== null && $selectedLon !== null
        && $selectedLat >= -90 && $selectedLat <= 90
        && $selectedLon >= -180 && $selectedLon <= 180
        && abs($selectedLat) > 0.000001 && abs($selectedLon) > 0.000001;

    if ($hasSelectedCoordinates) {
        $best = [
            'lat' => (string)$selectedLat,
            'lon' => (string)$selectedLon,
            'name' => $place,
            'address' => [],
        ];
    } else {
        $searchPlace = preg_match('/(?:^|,\s*)Россия(?:\s*$)/ui', $place) ? $place : $place . ', Россия';
        $searchUrl = 'https://nominatim.openstreetmap.org/search?' . http_build_query([
            'q' => $searchPlace,
            'format' => 'jsonv2',
            'addressdetails' => '1',
            'accept-language' => 'ru',
            'countrycodes' => 'ru',
            'limit' => '5',
        ]);
        $results = kd_delivery_api_http_json($searchUrl, ['User-Agent: KuznechnyDvorikDeliveryCalculator/2.2 (https://kuzdvor.tw1.ru)']);
        if (!$results) kd_json(['error' => 'Населённый пункт не найден. Уточните название или добавьте район.'], 404);

        $bestDistance = INF;
        foreach ($results as $candidate) {
            if (!is_array($candidate)) continue;
            $candidateLat = (float)($candidate['lat'] ?? 0);
            $candidateLon = (float)($candidate['lon'] ?? 0);
            if (!$candidateLat || !$candidateLon) continue;
            $distance = kd_delivery_api_haversine((float)($origin['lat'] ?? 52.96328), (float)($origin['lon'] ?? 55.928612), $candidateLat, $candidateLon);
            if ($distance < $bestDistance) {
                $bestDistance = $distance;
                $best = $candidate;
            }
        }
        if (!$best) kd_json(['error' => 'Населённый пункт не найден.'], 404);
    }

    $lat = (float)$best['lat'];
    $lon = (float)$best['lon'];
    $routeUrl = sprintf(
        'https://router.project-osrm.org/route/v1/driving/%F,%F;%F,%F?overview=false&alternatives=false&steps=false',
        (float)($origin['lon'] ?? 55.928612),
        (float)($origin['lat'] ?? 52.96328),
        $lon,
        $lat
    );
    $route = kd_delivery_api_http_json($routeUrl, ['User-Agent: KuznechnyDvorikDeliveryCalculator/2.1 (https://kuzdvor.tw1.ru)']);
    $meters = (float)($route['routes'][0]['distance'] ?? 0);
    if ($meters <= 0) kd_json(['error' => 'Не удалось построить автомобильный маршрут до этого пункта'], 503);

    $distanceKm = (int)ceil($meters / 1000);
    $address = is_array($best['address'] ?? null) ? $best['address'] : [];
    [$localityName, $resolvedName] = kd_delivery_api_place_names($best, $address, $place);
    $outOfArea = $serviceArea > 0 && $distanceKm > $serviceArea;

    return [
        'price' => $outOfArea ? null : $distanceKm * $rate,
        'distanceKm' => $distanceKm,
        'requestedName' => $place,
        // Existing frontend versions read shortName first. Keep the concise
        // district-qualified label here so old cached pages also show it.
        'shortName' => $resolvedName,
        'localityName' => $localityName,
        'resolvedName' => $resolvedName,
        'serviceAreaKm' => $serviceArea,
        'outOfArea' => $outOfArea,
        'resolved' => !$outOfArea,
        'source' => 'route',
    ];
}

function kd_delivery_api_place_names(array $item, array $address, string $fallback): array
{
    $locality = '';
    foreach (['name', 'city', 'town', 'village', 'hamlet', 'municipality'] as $key) {
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
        if ($value !== '' && kd_delivery_api_normalize($value) !== kd_delivery_api_normalize($locality)) {
            $district = $value;
            break;
        }
    }

    // Some OSM records put a municipal district into municipality instead of
    // county. Use it only when it clearly describes a district/okrug and is not
    // the locality itself.
    if ($district === '') {
        $municipality = trim((string)($address['municipality'] ?? ''));
        if ($municipality !== ''
            && kd_delivery_api_normalize($municipality) !== kd_delivery_api_normalize($locality)
            && preg_match('/район|округ|муниципал/u', mb_strtolower($municipality, 'UTF-8'))) {
            $district = $municipality;
        }
    }

    $resolved = $locality;
    if ($district !== '' && !str_contains(kd_delivery_api_normalize($locality), kd_delivery_api_normalize($district))) {
        $resolved .= ', ' . $district;
    }

    // If OSM has no district at all, region still disambiguates duplicate place
    // names without exposing the long raw display_name.
    if ($district === '') {
        $region = trim((string)($address['state'] ?? $address['region'] ?? ''));
        if ($region !== '' && kd_delivery_api_normalize($region) !== kd_delivery_api_normalize($locality)) {
            $resolved .= ', ' . $region;
        }
    }

    return [$locality, $resolved];
}

function kd_delivery_api_normalize(string $value): string
{
    $value = mb_strtolower(trim($value), 'UTF-8');
    $value = str_replace('ё', 'е', $value);
    return preg_replace('/[^а-яa-z0-9]+/u', '', $value) ?? '';
}

function kd_delivery_api_http_json(string $url, array $headers = []): array
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

function kd_delivery_api_haversine(float $lat1, float $lon1, float $lat2, float $lon2): float
{
    $dLat = deg2rad($lat2 - $lat1);
    $dLon = deg2rad($lon2 - $lon1);
    $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;
    return 6371 * 2 * atan2(sqrt($a), sqrt(1 - $a));
}
