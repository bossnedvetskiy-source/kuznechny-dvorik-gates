<?php
declare(strict_types=1);

$dist = $argv[1] ?? (__DIR__ . '/../timeweb-dist');
$dist = rtrim($dist, '/');
require $dist . '/backend/bootstrap.php';
require $dist . '/backend/excel-quote-validation.php';

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

$serverStandards = kd_gate_standard_prices(kd_gate_normalize_price_inputs($prices, true));
try {
    $validated = kd_gate_validate_excel_payload(['prices'=>$prices, 'standardPrices'=>$serverStandards]);
    if (count($validated['standardPrices'] ?? []) !== 38 || (int)($validated['standardPrices']['6'] ?? 0) !== 56600) {
        $failures++;
        fwrite(STDERR, "EXCEL PHP FAIL: сервер не пересчитал все стандартные цены\n");
    }
} catch (Throwable $e) {
    $failures++;
    fwrite(STDERR, 'EXCEL PHP FAIL: ' . $e->getMessage() . "\n");
}

$missingRejected = false;
try {
    $missing = $prices;
    unset($missing[array_key_first($missing)]);
    kd_gate_validate_excel_payload(['prices'=>$missing, 'standardPrices'=>$serverStandards]);
} catch (Throwable) {
    $missingRejected = true;
}
if (!$missingRejected) {
    $failures++;
    fwrite(STDERR, "EXCEL PHP FAIL: неполный набор входных цен был принят\n");
}

$missingStandardsRejected = false;
try {
    $incompleteStandards = $serverStandards;
    unset($incompleteStandards[array_key_first($incompleteStandards)]);
    kd_gate_validate_excel_payload(['prices'=>$prices, 'standardPrices'=>$incompleteStandards]);
} catch (Throwable) {
    $missingStandardsRejected = true;
}
if (!$missingStandardsRejected) {
    $failures++;
    fwrite(STDERR, "EXCEL PHP FAIL: неполная проверка 38 моделей была принята\n");
}

$mismatchRejected = false;
try {
    $wrongStandards = $serverStandards;
    $wrongStandards['6'] = 1;
    kd_gate_validate_excel_payload(['prices'=>$prices, 'standardPrices'=>$wrongStandards]);
} catch (Throwable) {
    $mismatchRejected = true;
}
if (!$mismatchRejected) {
    $failures++;
    fwrite(STDERR, "EXCEL PHP FAIL: подменённая стандартная цена была принята\n");
}


require_once $dist . '/backend/surveyor.php';
$catalog=$defaults['prices'] ?? null;
if (!is_array($catalog) || count($catalog['catalog']??[])!==38) {
    // The test's independent catalog uses only the active model identities.
    $catalog=['catalog'=>array_map(static fn($a)=>['art'=>'Арт.'.$a],array_keys($models)),'catalogInstallation'=>8000,'catalogPosts'=>25000];
}
$catalog['catalogInstallation']=8000;
$catalog['catalogPosts']=25000;
$staffChecked=0;
foreach ($models as $article=>$model) {
    $request=['article'=>'Арт.'.$article,'gateWidthMm'=>3800,'gateHeightMm'=>2000,'wicketWidthMm'=>1100,'wicketHeightMm'=>2000,'installation'=>true,'posts'=>true,'total'=>1,'privateCost'=>1];
    $reply=kd_surveyor_art_quote_data($request,$catalog,$prices);
    $expected=kd_gate_calculate_product((string)$article,3.8,2,1.1,2,$prices);
    if ($reply['prices']!==['product'=>$expected,'installation'=>8000,'posts'=>25000,'total'=>$expected+33000] || $reply['deliveryPending']!==true || isset($reply['configuration']['privateCost'])) throw new RuntimeException('Staff quote mismatch: '.$article);
    $staffChecked++;
}
$request=['article'=>'Арт.6','gateWidthMm'=>3800,'gateHeightMm'=>1800,'wicketWidthMm'=>1000,'wicketHeightMm'=>1800,'installation'=>false,'posts'=>false];
$reply=kd_surveyor_art_quote_data($request,$catalog,$prices);
if ($reply['prices']['total']!==61300) throw new RuntimeException('Staff quote known control failed');
foreach ([['gateWidthMm'=>799],['gateWidthMm'=>'3800'],['article'=>'Арт.39'],['posts'=>1]] as $invalid) {
    $rejected=false;
    try { kd_surveyor_art_quote_data(array_replace($request,$invalid),$catalog,$prices); }
    catch (InvalidArgumentException) { $rejected=true; }
    if (!$rejected) throw new RuntimeException('Invalid staff quote accepted');
}
fwrite(STDOUT,"Staff quote: {$staffChecked} custom models + known control + 4 invalid requests passed\n");


$stored=['version'=>2,'prices'=>$prices,'standardPrices'=>$serverStandards,'meta'=>['importedAt'=>'2026-11-20T00:00:00+00:00']];
$items=['items'=>[
 ['id'=>'art-1','kind'=>'artGates','draft'=>['article'=>'Арт.6','dimensions'=>['gateWidthMm'=>3800,'gateHeightMm'=>1800,'wicketWidthMm'=>1000,'wicketHeightMm'=>1800],'options'=>['installation'=>true,'posts'=>true]],'total'=>1],
 ['id'=>'fence-1','kind'=>'pickets','draft'=>[],'total'=>1]
]];
$services=['catalogInstallation'=>8000,'catalogPosts'=>25000];
$result=kd_surveyor_estimate_readonly_data($items,$catalog,$stored,$services);
if ($result['rows'][0]['quote']['prices']['total']!==94300 || $result['rows'][0]['status']!=='calculated' || $result['rows'][1]['reason']!=='pricing_not_connected' || $result['totalRub']!==null || $result['canIssue'] || $result['canReleaseProduction']) throw new RuntimeException('Estimate pricing boundary failed');
if (kd_surveyor_estimate_readonly_data($items,$catalog,$stored,[])['rows'][0]['reason']!=='service_rate_missing') throw new RuntimeException('Missing service fallback accepted');
foreach (['missing','null','wrong-standard','no-date','wrong-version'] as $case) {
    $bad=$stored;
    if ($case==='missing') unset($bad['prices'][array_key_first($prices)]);
    if ($case==='null') $bad['prices'][array_key_first($prices)]=['value'=>null];
    if ($case==='wrong-standard') $bad['standardPrices']['6']=1;
    if ($case==='no-date') unset($bad['meta']);
    if ($case==='wrong-version') $bad['version']=1;
    $reply=kd_surveyor_estimate_readonly_data($items,$catalog,$bad,$services);
    if ($reply['rows'][0]['reason']!=='excel_not_verified'||$reply['rows'][0]['quote']!==null)throw new RuntimeException('Invalid Excel source accepted: '.$case);
}
$duplicate=$items;$duplicate['items'][]=$items['items'][0];$rejected=false;
try {kd_surveyor_estimate_readonly_data($duplicate,$catalog,$stored,$services);}catch(InvalidArgumentException){$rejected=true;}
if (!$rejected)throw new RuntimeException('Duplicate estimate item accepted');
fwrite(STDOUT,"Estimate source: verified import, explicit services, 5 rejected imports, missing provider and duplicate rejection passed\n");

fwrite(STDOUT, "PHP gate standards checked: {$checkedStandards}; controls: " . count($cases) . "; Excel validation: 4; failures: {$failures}\n");
exit($failures ? 1 : 0);