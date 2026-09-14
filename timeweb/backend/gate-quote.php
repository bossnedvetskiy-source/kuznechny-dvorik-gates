<?php
declare(strict_types=1);

final class KdGateExpression
{
    private array $tokens;
    private int $index = 0;
    private static array $cache = [];

    private function __construct(string $source)
    {
        $this->tokens = self::tokenize($source);
    }

    public static function ast(string $source): array
    {
        if (isset(self::$cache[$source])) return self::$cache[$source];
        $parser = new self($source);
        $ast = $parser->parseConditional();
        $parser->expect('eof');
        if (count(self::$cache) > 4000) self::$cache = [];
        return self::$cache[$source] = $ast;
    }

    private static function tokenize(string $source): array
    {
        $tokens = [];
        $length = strlen($source);
        $i = 0;
        $operators = ['===','!==','<=','>=','==','!=','&&','||','**','??','+','-','*','/','%','<','>','!','?',':','(',')','[',']',','];
        while ($i < $length) {
            $ch = $source[$i];
            if (ctype_space($ch)) { $i++; continue; }

            if ($ch === '"' || $ch === "'") {
                $quote = $ch;
                $i++;
                $value = '';
                $closed = false;
                while ($i < $length) {
                    $c = $source[$i++];
                    if ($c === $quote) { $closed = true; break; }
                    if ($c !== '\\') { $value .= $c; continue; }
                    if ($i >= $length) throw new RuntimeException('Некорректная строка в формуле');
                    $esc = $source[$i++];
                    $value .= match ($esc) {
                        'n' => "\n", 'r' => "\r", 't' => "\t", 'b' => "\x08", 'f' => "\x0c",
                        '\\' => '\\', '"' => '"', "'" => "'", '/' => '/',
                        default => $esc,
                    };
                }
                if (!$closed) throw new RuntimeException('Незакрытая строка в формуле');
                $tokens[] = ['type'=>'string','value'=>$value];
                continue;
            }

            $rest = substr($source, $i);
            if (preg_match('/\A(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/', $rest, $m)) {
                $tokens[] = ['type'=>'number','value'=>(float)$m[0]];
                $i += strlen($m[0]);
                continue;
            }
            if (preg_match('/\A[A-Za-z_$][A-Za-z0-9_$.]*/', $rest, $m)) {
                $tokens[] = ['type'=>'identifier','value'=>$m[0]];
                $i += strlen($m[0]);
                continue;
            }

            $matched = false;
            foreach ($operators as $operator) {
                if (substr($source, $i, strlen($operator)) === $operator) {
                    $tokens[] = ['type'=>'operator','value'=>$operator];
                    $i += strlen($operator);
                    $matched = true;
                    break;
                }
            }
            if ($matched) continue;
            throw new RuntimeException('Неподдерживаемый символ в формуле: ' . $ch);
        }
        $tokens[] = ['type'=>'eof','value'=>''];
        return $tokens;
    }

    private function current(): array { return $this->tokens[$this->index] ?? ['type'=>'eof','value'=>'']; }
    private function advance(): array { return $this->tokens[$this->index++] ?? ['type'=>'eof','value'=>'']; }
    private function is(string $type, ?string $value = null): bool
    {
        $token = $this->current();
        return $token['type'] === $type && ($value === null || $token['value'] === $value);
    }
    private function match(string $value): bool
    {
        if ($this->is('operator', $value)) { $this->advance(); return true; }
        return false;
    }
    private function expect(string $type, ?string $value = null): array
    {
        if (!$this->is($type, $value)) {
            $token = $this->current();
            throw new RuntimeException('Некорректная формула рядом с ' . ($token['value'] ?: $token['type']));
        }
        return $this->advance();
    }

    private function parseConditional(): array
    {
        $condition = $this->parseNullish();
        if (!$this->match('?')) return $condition;
        $yes = $this->parseConditional();
        $this->expect('operator', ':');
        $no = $this->parseConditional();
        return ['type'=>'ternary','condition'=>$condition,'yes'=>$yes,'no'=>$no];
    }

    private function parseNullish(): array
    {
        $node = $this->parseOr();
        while ($this->match('??')) $node = ['type'=>'binary','op'=>'??','left'=>$node,'right'=>$this->parseOr()];
        return $node;
    }

    private function parseOr(): array
    {
        $node = $this->parseAnd();
        while ($this->match('||')) $node = ['type'=>'binary','op'=>'||','left'=>$node,'right'=>$this->parseAnd()];
        return $node;
    }

    private function parseAnd(): array
    {
        $node = $this->parseEquality();
        while ($this->match('&&')) $node = ['type'=>'binary','op'=>'&&','left'=>$node,'right'=>$this->parseEquality()];
        return $node;
    }

    private function parseEquality(): array
    {
        $node = $this->parseComparison();
        while ($this->is('operator') && in_array($this->current()['value'], ['==','===','!=','!=='], true)) {
            $op = $this->advance()['value'];
            $node = ['type'=>'binary','op'=>$op,'left'=>$node,'right'=>$this->parseComparison()];
        }
        return $node;
    }

    private function parseComparison(): array
    {
        $node = $this->parseAdditive();
        while ($this->is('operator') && in_array($this->current()['value'], ['<','<=','>','>='], true)) {
            $op = $this->advance()['value'];
            $node = ['type'=>'binary','op'=>$op,'left'=>$node,'right'=>$this->parseAdditive()];
        }
        return $node;
    }

    private function parseAdditive(): array
    {
        $node = $this->parseMultiplicative();
        while ($this->is('operator') && in_array($this->current()['value'], ['+','-'], true)) {
            $op = $this->advance()['value'];
            $node = ['type'=>'binary','op'=>$op,'left'=>$node,'right'=>$this->parseMultiplicative()];
        }
        return $node;
    }

    private function parseMultiplicative(): array
    {
        $node = $this->parseExponent();
        while ($this->is('operator') && in_array($this->current()['value'], ['*','/','%'], true)) {
            $op = $this->advance()['value'];
            $node = ['type'=>'binary','op'=>$op,'left'=>$node,'right'=>$this->parseExponent()];
        }
        return $node;
    }

    private function parseExponent(): array
    {
        $node = $this->parseUnary();
        if ($this->match('**')) $node = ['type'=>'binary','op'=>'**','left'=>$node,'right'=>$this->parseExponent()];
        return $node;
    }

    private function parseUnary(): array
    {
        if ($this->is('operator') && in_array($this->current()['value'], ['+','-','!'], true)) {
            $op = $this->advance()['value'];
            return ['type'=>'unary','op'=>$op,'value'=>$this->parseUnary()];
        }
        return $this->parsePrimary();
    }

    private function parsePrimary(): array
    {
        if ($this->is('number')) return ['type'=>'literal','value'=>$this->advance()['value']];
        if ($this->is('string')) return ['type'=>'literal','value'=>$this->advance()['value']];
        if ($this->is('identifier')) {
            $name = $this->advance()['value'];
            if ($name === 'true') return ['type'=>'literal','value'=>true];
            if ($name === 'false') return ['type'=>'literal','value'=>false];
            if ($name === 'null' || $name === 'undefined') return ['type'=>'literal','value'=>null];
            if ($this->match('(')) {
                $args = [];
                if (!$this->match(')')) {
                    do { $args[] = $this->parseConditional(); } while ($this->match(','));
                    $this->expect('operator', ')');
                }
                return ['type'=>'call','name'=>$name,'args'=>$args];
            }
            return ['type'=>'variable','name'=>$name];
        }
        if ($this->match('(')) {
            $node = $this->parseConditional();
            $this->expect('operator', ')');
            return $node;
        }
        if ($this->match('[')) {
            $items = [];
            if (!$this->match(']')) {
                do { $items[] = $this->parseConditional(); } while ($this->match(','));
                $this->expect('operator', ']');
            }
            return ['type'=>'array','items'=>$items];
        }
        throw new RuntimeException('Неподдерживаемое выражение в формуле');
    }
}

function kd_gate_truthy(mixed $value): bool
{
    if ($value === null || $value === false) return false;
    if (is_int($value) || is_float($value)) return $value != 0 && !is_nan((float)$value);
    if (is_string($value)) return $value !== '';
    return true;
}

function kd_gate_number(mixed $value): float
{
    if ($value === null || $value === false || $value === '') return 0.0;
    if ($value === true) return 1.0;
    if (!is_numeric($value)) throw new RuntimeException('Формула вернула нечисловое значение');
    return (float)$value;
}

function kd_gate_round_excel(float $value, int $digits = 0): float
{
    $factor = 10 ** abs($digits);
    $scaled = $digits >= 0 ? $value * $factor : $value / $factor;
    $rounded = $scaled >= 0 ? floor($scaled + 0.5) : ceil($scaled - 0.5);
    return $digits >= 0 ? $rounded / $factor : $rounded * $factor;
}

function kd_gate_round_up(float $value, int $digits = 0): float
{
    $factor = 10 ** abs($digits);
    if ($digits >= 0) return ($value >= 0 ? ceil($value * $factor) : floor($value * $factor)) / $factor;
    return ($value >= 0 ? ceil($value / $factor) : floor($value / $factor)) * $factor;
}

function kd_gate_eval_ast(array $node, array $ctx, Closure $price, Closure $cell): mixed
{
    $type = $node['type'] ?? '';
    if ($type === 'literal') return $node['value'] ?? null;
    if ($type === 'array') return array_map(fn($item) => kd_gate_eval_ast($item, $ctx, $price, $cell), $node['items'] ?? []);
    if ($type === 'variable') {
        $name = (string)($node['name'] ?? '');
        if (str_starts_with($name, 'ctx.')) {
            $key = substr($name, 4);
            if (!array_key_exists($key, $ctx)) throw new RuntimeException('Неизвестный параметр формулы: ' . $name);
            return $ctx[$key];
        }
        if ($name === 'Math.PI') return M_PI;
        if ($name === 'Infinity') return INF;
        if ($name === 'NaN') return NAN;
        throw new RuntimeException('Неизвестная переменная формулы: ' . $name);
    }
    if ($type === 'unary') {
        $value = kd_gate_eval_ast($node['value'], $ctx, $price, $cell);
        return match ($node['op']) {
            '+' => kd_gate_number($value),
            '-' => -kd_gate_number($value),
            '!' => !kd_gate_truthy($value),
            default => throw new RuntimeException('Неподдерживаемый унарный оператор'),
        };
    }
    if ($type === 'binary') {
        $op = (string)$node['op'];
        $left = kd_gate_eval_ast($node['left'], $ctx, $price, $cell);
        if ($op === '&&') return kd_gate_truthy($left) ? kd_gate_eval_ast($node['right'], $ctx, $price, $cell) : $left;
        if ($op === '||') return kd_gate_truthy($left) ? $left : kd_gate_eval_ast($node['right'], $ctx, $price, $cell);
        if ($op === '??') return $left !== null ? $left : kd_gate_eval_ast($node['right'], $ctx, $price, $cell);
        $right = kd_gate_eval_ast($node['right'], $ctx, $price, $cell);
        return match ($op) {
            '+' => kd_gate_number($left) + kd_gate_number($right),
            '-' => kd_gate_number($left) - kd_gate_number($right),
            '*' => kd_gate_number($left) * kd_gate_number($right),
            '/' => kd_gate_number($right) == 0.0 ? NAN : kd_gate_number($left) / kd_gate_number($right),
            '%' => kd_gate_number($right) == 0.0 ? NAN : fmod(kd_gate_number($left), kd_gate_number($right)),
            '**' => kd_gate_number($left) ** kd_gate_number($right),
            '<' => kd_gate_number($left) < kd_gate_number($right),
            '<=' => kd_gate_number($left) <= kd_gate_number($right),
            '>' => kd_gate_number($left) > kd_gate_number($right),
            '>=' => kd_gate_number($left) >= kd_gate_number($right),
            '==','===' => $left == $right,
            '!=','!==' => $left != $right,
            default => throw new RuntimeException('Неподдерживаемый бинарный оператор: ' . $op),
        };
    }
    if ($type === 'ternary') {
        return kd_gate_truthy(kd_gate_eval_ast($node['condition'], $ctx, $price, $cell))
            ? kd_gate_eval_ast($node['yes'], $ctx, $price, $cell)
            : kd_gate_eval_ast($node['no'], $ctx, $price, $cell);
    }
    if ($type === 'call') {
        $name = (string)($node['name'] ?? '');
        $args = array_map(fn($item) => kd_gate_eval_ast($item, $ctx, $price, $cell), $node['args'] ?? []);
        return match ($name) {
            'p' => $price((string)($args[0] ?? '')),
            'v' => $cell((string)($args[0] ?? '')),
            'sum' => is_array($args[0] ?? null) ? array_sum(array_map('kd_gate_number', $args[0])) : kd_gate_number($args[0] ?? 0),
            'roundExcel' => kd_gate_round_excel(kd_gate_number($args[0] ?? 0), (int)kd_gate_number($args[1] ?? 0)),
            'roundUp' => kd_gate_round_up(kd_gate_number($args[0] ?? 0), (int)kd_gate_number($args[1] ?? 0)),
            'Number','parseFloat' => kd_gate_number($args[0] ?? 0),
            'Math.abs' => abs(kd_gate_number($args[0] ?? 0)),
            'Math.ceil' => ceil(kd_gate_number($args[0] ?? 0)),
            'Math.floor' => floor(kd_gate_number($args[0] ?? 0)),
            'Math.round' => kd_gate_round_excel(kd_gate_number($args[0] ?? 0), 0),
            'Math.trunc' => trunc(kd_gate_number($args[0] ?? 0)),
            'Math.min' => min(array_map('kd_gate_number', $args)),
            'Math.max' => max(array_map('kd_gate_number', $args)),
            'Math.pow' => kd_gate_number($args[0] ?? 0) ** kd_gate_number($args[1] ?? 0),
            default => throw new RuntimeException('Неподдерживаемая функция формулы: ' . $name),
        };
    }
    throw new RuntimeException('Некорректное дерево формулы');
}

function kd_gate_eval_expression(string $expression, array $ctx, Closure $price, Closure $cell): float
{
    $value = kd_gate_eval_ast(KdGateExpression::ast($expression), $ctx, $price, $cell);
    $number = kd_gate_number($value);
    if (!is_finite($number)) throw new RuntimeException('Формула вернула некорректное число');
    return $number;
}

function kd_gate_normalize_article(string $value): string
{
    $value = preg_replace('/^\s*арт\.?\s*/iu', '', $value) ?? $value;
    $value = preg_replace('/c/iu', 'с', $value) ?? $value;
    return mb_strtoupper(trim($value), 'UTF-8');
}

function kd_gate_runtime_price_inputs(): array
{
    $defaults = kd_defaults()['gateCalcPrices'] ?? [];
    $source = [];
    try {
        $saved = kd_setting_get('gate_excel_prices', []);
        if (is_array($saved)) $source = is_array($saved['prices'] ?? null) ? $saved['prices'] : $saved;
    } catch (Throwable $e) {
        error_log('Kuzdvor gate prices fallback: ' . $e->getMessage());
    }
    $result = [];
    foreach ($defaults as $ref => $fallback) {
        $raw = $source[$ref] ?? $fallback;
        $value = is_array($raw) ? ($raw['value'] ?? null) : $raw;
        $fallbackValue = is_array($fallback) ? ($fallback['value'] ?? 0) : $fallback;
        $number = is_numeric($value) ? (float)$value : (float)$fallbackValue;
        if (!is_finite($number) || $number < 0 || $number > 10000000) $number = (float)$fallbackValue;
        $result[$ref] = ['value'=>$number, 'label'=>(string)(is_array($fallback) ? ($fallback['label'] ?? $ref) : $ref)];
    }
    return $result;
}

function kd_gate_calculate_product(string $article, float $gateWidth, float $gateHeight, float $wicketWidth, float $wicketHeight, ?array $priceInputs = null): int
{
    $models = kd_defaults()['gateCalcModels']['models'] ?? [];
    $key = kd_gate_normalize_article($article);
    $model = $models[$key] ?? null;
    if (!is_array($model)) throw new RuntimeException('Нет расчётной модели для выбранного артикула');
    $ctx = compact('gateWidth','gateHeight','wicketWidth','wicketHeight');
    $cache = is_array($model['literals'] ?? null) ? $model['literals'] : [];
    $formulas = is_array($model['formulas'] ?? null) ? $model['formulas'] : [];
    $prices = $priceInputs ?? kd_gate_runtime_price_inputs();
    $defaultPrices = kd_defaults()['gateCalcPrices'] ?? [];
    $visiting = [];
    $price = function(string $ref) use ($prices, $defaultPrices): float {
        $raw = $prices[$ref] ?? $defaultPrices[$ref] ?? ['value'=>0];
        $value = is_array($raw) ? ($raw['value'] ?? 0) : $raw;
        return kd_gate_number($value);
    };
    $cell = null;
    $cell = function(string $ref) use (&$cell, &$cache, &$visiting, $formulas, $ctx, $price): float {
        if (array_key_exists($ref, $cache)) return kd_gate_number($cache[$ref]);
        if (isset($visiting[$ref])) throw new RuntimeException('Циклическая ссылка в расчётной модели');
        $expression = $formulas[$ref] ?? null;
        if (!is_string($expression) || $expression === '') throw new RuntimeException('Не найдена формула ' . $ref);
        $visiting[$ref] = true;
        try { $value = kd_gate_eval_expression($expression, $ctx, $price, $cell); }
        finally { unset($visiting[$ref]); }
        $cache[$ref] = $value;
        return $value;
    };
    $gateRef = (string)($model['gateRef'] ?? '');
    $wicketRef = (string)($model['wicketRef'] ?? '');
    if ($gateRef === '' || $wicketRef === '') throw new RuntimeException('Расчётная модель неполная');
    return (int)kd_gate_round_excel($cell($gateRef) + $cell($wicketRef), -2);
}

function kd_gate_dimensions(array $body): array
{
    $values = [
        'gateWidth'=>(float)($body['width'] ?? 0),
        'gateHeight'=>(float)($body['height'] ?? 0),
        'wicketWidth'=>(float)($body['wicketWidth'] ?? 0),
        'wicketHeight'=>(float)($body['wicketHeight'] ?? 0),
    ];
    $limits = ['gateWidth'=>[0.8,8.0], 'gateHeight'=>[1.0,3.0], 'wicketWidth'=>[0.7,2.5], 'wicketHeight'=>[1.0,3.0]];
    foreach ($values as $key => $value) {
        [$min,$max] = $limits[$key];
        if (!is_finite($value) || $value < $min || $value > $max) throw new RuntimeException('Проверьте размеры ворот и калитки');
    }
    return $values;
}

function kd_gate_safe_delivery(string $city): array
{
    $city = preg_replace('/\s+/u', ' ', trim($city)) ?? '';
    $settings = kd_delivery_settings();
    $site = kd_site_profile();
    $rate = max(0, (int)($site['deliveryRate'] ?? $settings['fallbackRatePerKm'] ?? 90));
    $serviceArea = max(0, (int)($site['serviceAreaKm'] ?? 150));
    foreach (($settings['destinations'] ?? []) as $item) {
        if (kd_normalize_name((string)($item['name'] ?? '')) === kd_normalize_name($city)) {
            return ['kind'=>'fixed','city'=>(string)($item['name'] ?? $city),'price'=>max(0,(int)($item['price'] ?? 0)),'distanceKm'=>null,'serviceAreaKm'=>$serviceArea,'outOfArea'=>false,'resolved'=>true];
        }
    }
    if ($city === '') return ['kind'=>'error','city'=>$city,'price'=>null,'distanceKm'=>null,'serviceAreaKm'=>$serviceArea,'outOfArea'=>false,'resolved'=>false];
    try {
        $origin = $settings['origin'] ?? ['lat'=>52.96328,'lon'=>55.928612,'name'=>'Мелеуз'];
        $searchUrl = 'https://nominatim.openstreetmap.org/search?' . http_build_query(['q'=>$city . ', Россия','format'=>'jsonv2','addressdetails'=>'1','accept-language'=>'ru','countrycodes'=>'ru','limit'=>'5']);
        $results = kd_http_json($searchUrl, ['User-Agent: KuznechnyDvorikDeliveryCalculator/2.0 (https://kuzdvor.tw1.ru)']);
        if (!is_array($results) || !$results) throw new RuntimeException('Населённый пункт не найден');
        $best = null; $bestDistance = INF;
        foreach ($results as $candidate) {
            $lat = (float)($candidate['lat'] ?? 0); $lon = (float)($candidate['lon'] ?? 0);
            if (!$lat || !$lon) continue;
            $distance = kd_haversine((float)($origin['lat'] ?? 52.96328),(float)($origin['lon'] ?? 55.928612),$lat,$lon);
            if ($distance < $bestDistance) { $bestDistance = $distance; $best = $candidate; }
        }
        if (!$best) throw new RuntimeException('Населённый пункт не найден');
        $lat=(float)$best['lat']; $lon=(float)$best['lon'];
        $routeUrl=sprintf('https://router.project-osrm.org/route/v1/driving/%F,%F;%F,%F?overview=false&alternatives=false&steps=false',(float)($origin['lon']??55.928612),(float)($origin['lat']??52.96328),$lon,$lat);
        $route=kd_http_json($routeUrl,['User-Agent: KuznechnyDvorikDeliveryCalculator/2.0 (https://kuzdvor.tw1.ru)']);
        $meters=(float)($route['routes'][0]['distance']??0); if($meters<=0) throw new RuntimeException('Маршрут не построен');
        $distanceKm=(int)ceil($meters/1000); $outOfArea=$serviceArea>0&&$distanceKm>$serviceArea;
        $address=is_array($best['address']??null)?$best['address']:[]; $short=(string)($best['name']??$address['city']??$address['town']??$address['village']??$city);
        return ['kind'=>$outOfArea?'out-of-area':'calculated','city'=>$short,'price'=>$outOfArea?null:$distanceKm*$rate,'distanceKm'=>$distanceKm,'serviceAreaKm'=>$serviceArea,'outOfArea'=>$outOfArea,'resolved'=>!$outOfArea];
    } catch (Throwable $e) {
        error_log('Kuzdvor delivery verification: ' . $e->getMessage());
        return ['kind'=>'error','city'=>$city,'price'=>null,'distanceKm'=>null,'serviceAreaKm'=>$serviceArea,'outOfArea'=>false,'resolved'=>false];
    }
}

function kd_gate_authoritative_quote(array $body): array
{
    $dimensions = kd_gate_dimensions($body);
    $articleKey = kd_gate_normalize_article((string)($body['article'] ?? ''));
    $prices = kd_prices();
    $catalogItem = null;
    foreach (($prices['catalog'] ?? []) as $item) {
        if (kd_gate_normalize_article((string)($item['art'] ?? '')) === $articleKey && ($item['visible'] ?? true) !== false) { $catalogItem = $item; break; }
    }
    if (!$catalogItem) throw new RuntimeException('Выбранная модель ворот недоступна');
    $productPrice = kd_gate_calculate_product((string)($body['article'] ?? ''), $dimensions['gateWidth'], $dimensions['gateHeight'], $dimensions['wicketWidth'], $dimensions['wicketHeight']);
    $installationPrice = max(0, (int)round((float)($prices['catalogInstallation'] ?? 0)));
    $posts = !empty($body['posts']);
    $postsPrice = $posts ? max(0, (int)round((float)($prices['catalogPosts'] ?? 0))) : 0;
    $delivery = kd_gate_safe_delivery((string)($body['city'] ?? ''));
    $total = $productPrice + $installationPrice + $postsPrice + (($delivery['resolved'] ?? false) ? (int)($delivery['price'] ?? 0) : 0);
    return [
        'article'=>(string)($catalogItem['art'] ?? $body['article'] ?? ''),
        'productPrice'=>$productPrice,
        'installationPrice'=>$installationPrice,
        'postsPrice'=>$postsPrice,
        'posts'=>$posts,
        'color'=>mb_substr(trim((string)($body['color'] ?? '')),0,100),
        'delivery'=>$delivery,
        'total'=>(int)round($total),
        'deliveryPending'=>!($delivery['resolved'] ?? false),
        'quoteVerified'=>true,
        'dimensions'=>$dimensions,
    ];
}

function kd_gate_money(int|float $value): string { return number_format((float)$value, 0, ',', ' ') . ' ₽'; }

function kd_gate_authoritative_message(array $body, array $quote): string
{
    $d=$quote['dimensions']; $delivery=$quote['delivery'];
    $deliveryText=($delivery['outOfArea']??false)
        ? 'Доставка: за пределами стандартной зоны '.(int)($delivery['serviceAreaKm']??150).' км — индивидуальный расчёт.'
        : (($delivery['resolved']??false) ? 'Доставка учтена в итоговой сумме.' : 'Доставка требует уточнения при подтверждении заявки.');
    $lines=[
        'Заявка на бесплатный замер.',
        trim((string)($body['name']??''))!==''?'Имя: '.trim((string)$body['name']):'',
        trim((string)($body['phone']??''))!==''?'Телефон: '.trim((string)$body['phone']):'',
        trim((string)($body['city']??''))!==''?'Место установки: '.trim((string)$body['city']):'',
        'Изделие: Ворота с калиткой, '.$quote['article'],
        $quote['color']!==''?'Предпочитаемый цвет: '.$quote['color']:'',
        'Размер ворот: '.$d['gateWidth'].' × '.$d['gateHeight'].' м',
        'Размер калитки: '.$d['wicketWidth'].' × '.$d['wicketHeight'].' м',
        'Ворота с калиткой + установка: '.kd_gate_money($quote['productPrice']+$quote['installationPrice']),
        $quote['posts']?'Новые усиленные столбы: '.kd_gate_money($quote['postsPrice']):'',
        (($delivery['resolved']??false)?'Предварительно с доставкой':'Ориентир без доставки').': '.kd_gate_money($quote['total']),
        $deliveryText,
        trim((string)($body['comment']??''))!==''?'Комментарий: '.trim((string)$body['comment']):'',
    ];
    return implode("\n", array_values(array_filter($lines, fn($line)=>$line!=='')));
}

function kd_create_authoritative_lead(): never
{
    $body=kd_json_body(32768);
    if(!empty($body['website'])||!empty($body['companyWebsite']))kd_json(['ok'=>true,'id'=>null],201);
    $phone=trim((string)($body['phone']??''));$digits=preg_replace('/\D/','',$phone)??'';$city=trim((string)($body['city']??''));$clientMessage=trim((string)($body['message']??''));$consent=($body['consent']??false)===true;
    if(strlen($digits)<10||strlen($digits)>11)kd_json(['error'=>'Укажите корректный номер телефона'],400);
    if(!$consent)kd_json(['error'=>'Подтвердите согласие на обработку персональных данных'],400);
    if($city===''||$clientMessage==='')kd_json(['error'=>'В заявке не хватает обязательных данных'],400);
    $category=(string)($body['category']??'gates');if(!in_array($category,['gates','canopy','forged-fence','profsheet-fence','picket-fence'],true))$category='gates';
    $clientTotal=max(0,min(10000000,(int)round((float)($body['total']??0))));
    $quote=null;$quoteError='';
    if($category==='gates'){
        try{$quote=kd_gate_authoritative_quote($body);}catch(Throwable $e){$quoteError=$e->getMessage();error_log('Kuzdvor authoritative quote: '.$quoteError);}
    }
    $delivery=$quote['delivery']??kd_gate_safe_delivery($city);
    $verified=is_array($quote)&&($quote['quoteVerified']??false)===true;
    $serverTotal=$verified?(int)$quote['total']:$clientTotal;
    $deliveryPending=$verified?(bool)$quote['deliveryPending']:!($delivery['resolved']??false);
    $config=is_array($body['configuration']??null)?$body['configuration']:[];
    foreach(['article','width','height','wicketWidth','wicketHeight','install','posts','color']as$key)if(array_key_exists($key,$body))$config[$key]=$body[$key];
    if($verified)$config['serverQuote']=['productPrice'=>$quote['productPrice'],'installationPrice'=>$quote['installationPrice'],'postsPrice'=>$quote['postsPrice'],'deliveryPrice'=>($delivery['resolved']??false)?($delivery['price']??0):null,'verifiedAt'=>gmdate('c')];
    $configJson=json_encode($config,JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)?:'{}';if(strlen($configJson)>8000)kd_json(['error'=>'Слишком много параметров в заявке'],413);
    $comment=mb_substr(trim((string)($body['comment']??'')),0,1000);
    if($verified&&$serverTotal!==$clientTotal){$note='⚠️ Сервер пересчитал предварительную сумму: браузер передал '.kd_gate_money($clientTotal).', проверенная сумма '.kd_gate_money($serverTotal).'.';$comment=$note.($comment!==''?"\n".$comment:'');}
    elseif($category==='gates'&&!$verified){$note='⚠️ Цена требует ручной проверки: сервер не смог подтвердить расчёт.';$comment=$note.($comment!==''?"\n".$comment:'');}
    $message=$verified?kd_gate_authoritative_message($body,$quote):(($category==='gates'?'⚠️ Цена ниже не проверена сервером.\n\n':'').$clientMessage);
    $article=$verified?(string)$quote['article']:mb_substr(trim((string)($body['article']??'')),0,50);
    $install=$verified?1:(!empty($body['install'])?1:0);$posts=$verified&&($quote['posts']??false)?1:(!empty($body['posts'])?1:0);
    $dimensions=$verified?$quote['dimensions']:['gateWidth'=>kd_nullable_number($body['width']??null),'gateHeight'=>kd_nullable_number($body['height']??null),'wicketWidth'=>kd_nullable_number($body['wicketWidth']??null),'wicketHeight'=>kd_nullable_number($body['wicketHeight']??null)];
    $sql='INSERT INTO site_leads (created_at,updated_at,status,name,phone,city,category,source,article,product_title,configuration_json,width,wicket_width,wicket_height,height,install,posts,color,total,client_total,quote_verified,delivery_pending,delivery_out_of_area,delivery_distance_km,consent,consent_at,policy_version,comment,message) VALUES (UTC_TIMESTAMP(),UTC_TIMESTAMP(),\'new\',:name,:phone,:city,:category,:source,:article,:product_title,:configuration_json,:width,:wicket_width,:wicket_height,:height,:install,:posts,:color,:total,:client_total,:quote_verified,:delivery_pending,:delivery_out_of_area,:delivery_distance_km,1,UTC_TIMESTAMP(),:policy_version,:comment,:message)';
    $stmt=kd_db()->prepare($sql);
    $stmt->execute([
        ':name'=>mb_substr(trim((string)($body['name']??'')),0,100),':phone'=>$phone,':city'=>mb_substr($city,0,150),':category'=>$category,':source'=>mb_substr(trim((string)($body['source']??'')),0,100),':article'=>$article,
        ':product_title'=>mb_substr(trim((string)($body['productTitle']??($category==='gates'?'Ворота с калиткой':''))),0,120),':configuration_json'=>$configJson,':width'=>$dimensions['gateWidth'],':wicket_width'=>$dimensions['wicketWidth'],':wicket_height'=>$dimensions['wicketHeight'],':height'=>$dimensions['gateHeight'],
        ':install'=>$install,':posts'=>$posts,':color'=>mb_substr(trim((string)($body['color']??'')),0,100),':total'=>$serverTotal,':client_total'=>$clientTotal,':quote_verified'=>$verified?1:0,':delivery_pending'=>$deliveryPending?1:0,':delivery_out_of_area'=>!empty($delivery['outOfArea'])?1:0,':delivery_distance_km'=>$delivery['distanceKm']??null,
        ':policy_version'=>mb_substr(trim((string)($body['policyVersion']??'')),0,64),':comment'=>mb_substr($comment,0,1000),':message'=>mb_substr($message,0,8000),
    ]);
    kd_json(['ok'=>true,'id'=>(int)kd_db()->lastInsertId(),'quote'=>['total'=>$serverTotal,'clientTotal'=>$clientTotal,'verified'=>$verified,'deliveryPending'=>$deliveryPending,'corrected'=>$verified&&$serverTotal!==$clientTotal]],201);
}
