<?php
declare(strict_types=1);

$dist = $argv[1] ?? (__DIR__ . '/../timeweb-dist');
$dist = rtrim($dist, '/');
require $dist . '/backend/bootstrap.php';
require $dist . '/backend/gate-quote.php';

$defaults = kd_defaults();
$prices = $defaults['gateCalcPrices'] ?? [];
$models = $defaults['gateCalcModels']['models'] ?? [];
if (!is_array($models) || count($models) !== 38) {
    fwrite(STDERR, 'Ожидалось 38 активных PHP-моделей ворот, получено ' . (is_array($models) ? count($models) : 0) . "\n");
    exit(1);
}

$failures = 0;
$checkedStandards = 0;
foreach ($models as $article => $model) {
    $standard = is_array($model['standard'] ?? null) ? $model['standard'] : [];
    if (!$standard) continue;
    $expected = (int)round((float)($standard['total_round100'] ?? 0));
    $actual = kd_gate_calculate_product(
        (string)$article,
        (float)($standard['gate_width_m'] ?? 3.4),
        (float)($standard['gate_height_m'] ?? 1.8),
        (float)($standard['wicket_width_m'] ?? 1.0),
        (float)($standard['wicket_height_m'] ?? 1.8),
        $prices
    );
    $checkedStandards++;
    if ($actual !== $expected) {
        $failures++;
        fwrite(STDERR, "STANDARD PHP FAIL {$article}: expected {$expected}, got {$actual}\n");
    }
}

$cases = [
    ['6',3.4,1.8,1.0,1.8,56600],
    ['6',3.8,1.8,1.0,1.8,61300],
    ['6',3.4,2.0,1.0,2.0,59300],
    ['6',3.4,1.8,1.1,1.8,56900],
    ['6',4.0,2.0,1.1,2.0,65400],
    ['17С',3.4,1.8,1.0,1.8,90000],
    ['17С',3.8,1.8,1.0,1.8,96700],
    ['17С',3.4,2.0,1.0,2.0,93900],
    ['17С',3.4,1.8,1.1,1.8,90300],
    ['17С',4.0,2.0,1.1,2.0,102800],
    ['38',3.4,1.8,1.0,1.8,76500],
    ['38',3.8,1.8,1.0,1.8,82600],
    ['38',3.4,2.0,1.0,2.0,80800],
    ['38',3.4,1.8,1.1,1.8,76700],
    ['38',4.0,2.0,1.1,2.0,88500],
    ['9-3',3.8,1.8,0.9,1.8,109400],
];
foreach ($cases as [$article,$gateWidth,$gateHeight,$wicketWidth,$wicketHeight,$expected]) {
    $actual = kd_gate_calculate_product($article,$gateWidth,$gateHeight,$wicketWidth,$wicketHeight,$prices);
    if ($actual !== $expected) {
        $failures++;
        fwrite(STDERR, "CONTROL PHP FAIL {$article}: expected {$expected}, got {$actual}\n");
    }
}

$rejected = false;
try { kd_gate_calculate_product('39',3.4,1.8,1.0,1.8,$prices); }
catch (Throwable) { $rejected = true; }
if (!$rejected) {
    $failures++;
    fwrite(STDERR, "EXCLUDED PHP FAIL: Арт.39 всё ещё рассчитывается\n");
}

fwrite(STDOUT, "PHP gate standards checked: {$checkedStandards}; controls: " . count($cases) . "; failures: {$failures}\n");
exit($failures ? 1 : 0);
