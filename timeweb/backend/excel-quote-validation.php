<?php
declare(strict_types=1);

require_once __DIR__ . '/gate-quote.php';

function kd_gate_normalize_price_inputs(mixed $input, bool $strict = false): array
{
    $source = is_array($input) ? $input : [];
    $defaults = kd_defaults()['gateCalcPrices'] ?? [];
    if (!is_array($defaults) || !$defaults) throw new RuntimeException('Базовые цены расчёта ворот недоступны');
    $result = [];
    foreach ($defaults as $ref => $fallback) {
        if ($strict && !array_key_exists($ref, $source)) throw new RuntimeException("В Excel отсутствует обязательное значение {$ref}");
        $raw = $source[$ref] ?? $fallback;
        $value = is_array($raw) ? ($raw['value'] ?? null) : $raw;
        $fallbackValue = is_array($fallback) ? ($fallback['value'] ?? null) : $fallback;
        if ($value === null || $value === '') $value = $fallbackValue;
        if (!is_numeric($value)) throw new RuntimeException("Некорректное значение {$ref}");
        $number = (float)$value;
        if (!is_finite($number) || $number < 0 || $number > 10000000) throw new RuntimeException("Некорректное значение {$ref}");
        $result[$ref] = [
            'value' => $number,
            'label' => mb_substr((string)(is_array($fallback) ? ($fallback['label'] ?? $ref) : $ref), 0, 160),
        ];
    }
    return $result;
}

function kd_gate_standard_prices(array $priceInputs): array
{
    $models = kd_defaults()['gateCalcModels']['models'] ?? [];
    if (!is_array($models) || count($models) !== 38) throw new RuntimeException('Набор расчётных моделей ворот неполный');
    $result = [];
    foreach ($models as $article => $model) {
        $standard = is_array($model['standard'] ?? null) ? $model['standard'] : [];
        if (!$standard) throw new RuntimeException("Нет стандартных размеров для Арт.{$article}");
        $total = kd_gate_calculate_product(
            (string)$article,
            (float)($standard['gate_width_m'] ?? 3.4),
            (float)($standard['gate_height_m'] ?? 1.8),
            (float)($standard['wicket_width_m'] ?? 1.0),
            (float)($standard['wicket_height_m'] ?? 1.8),
            $priceInputs
        );
        if ($total < 0 || $total > 10000000) throw new RuntimeException("Не удалось проверить расчёт Арт.{$article}");
        $result[(string)$article] = $total;
    }
    return $result;
}

function kd_gate_validate_excel_payload(array $body): array
{
    $prices = kd_gate_normalize_price_inputs($body['prices'] ?? [], true);
    $standards = kd_gate_standard_prices($prices);
    $clientStandards = is_array($body['standardPrices'] ?? null) ? $body['standardPrices'] : [];
    foreach ($clientStandards as $article => $clientValue) {
        if (!array_key_exists((string)$article, $standards)) continue;
        if (!is_numeric($clientValue) || (int)round((float)$clientValue) !== (int)$standards[(string)$article]) {
            throw new RuntimeException("Проверка Excel не пройдена для Арт.{$article}. Обновление отменено.");
        }
    }
    return ['prices'=>$prices, 'standardPrices'=>$standards];
}
