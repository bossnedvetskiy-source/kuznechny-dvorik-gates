from pathlib import Path


def replace(path, old, new, label):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    if old in s:
        p.write_text(s.replace(old,new),encoding='utf-8')
        return
    if new not in s:
        raise SystemExit(f'{label}: pattern not found in {path}')

# Explicit delivery table entries are manual business prices. Do not infer distance from price.
replace('shared/delivery.js', """    const fixedDistanceEstimate = known => {
      if (normalize(known?.name) === normalize('Мелеуз')) return 0;
      const price = Math.max(0, Number(known?.price) || 0);
      return Math.ceil(price / Math.max(1, data.referenceRatePerKm));
    };

    const resolveFixed = known => {
      const city = String(known.name || '').trim();
      const price = Number(known.price) || 0;
      const distanceKm = fixedDistanceEstimate(known);
      const outOfArea = distanceKm > data.serviceAreaKm;
      if (input) input.value = city;
      state = outOfArea
        ? {kind:'out-of-area', name:city, resolvedName:city, shortName:city, price:null, distanceKm, serviceAreaKm:data.serviceAreaKm, outOfArea:true}
        : {kind:'fixed', name:city, resolvedName:city, shortName:city, price, distanceKm, serviceAreaKm:data.serviceAreaKm, outOfArea:false};
      editingOther = false;
      setResult(outOfArea
        ? `Место установки дальше стандартной зоны выезда ${data.serviceAreaKm} км. Стоимость доставки рассчитаем индивидуально.`
        : normalize(city) === normalize('Мелеуз')
          ? 'Доставка по Мелеузу — бесплатно'
          : `${city} · доставка учтена в итоговой сумме`, outOfArea ? 'pending' : 'success');
      saveSelected(state);
      emit();
    };
""", """    const resolveFixed = known => {
      const city = String(known.name || '').trim();
      const price = Number(known.price) || 0;
      if (input) input.value = city;
      // A listed destination is an explicit business tariff and may be a deliberate exception
      // to the normal service radius. Never try to derive kilometres from its price.
      state = {kind:'fixed', name:city, resolvedName:city, shortName:city, price, distanceKm:null, serviceAreaKm:data.serviceAreaKm, outOfArea:false};
      editingOther = false;
      setResult(normalize(city) === normalize('Мелеуз')
        ? 'Доставка по Мелеузу — бесплатно'
        : `${city} · доставка учтена в итоговой сумме`, 'success');
      saveSelected(state);
      emit();
    };
""", 'client fixed delivery business rule')

replace('worker/gate-quote-d1.js', """function fixedDeliveryForCity(city, site) {
  const destinations = Array.isArray(DEFAULT_DELIVERY_PRICES?.destinations) ? DEFAULT_DELIVERY_PRICES.destinations : [];
  const known = destinations.find(item => normalizeDeliveryServer(item.name) === normalizeDeliveryServer(city));
  if (!known) return null;
  const price = Math.max(0, Math.round(Number(known.price) || 0));
  const referenceRate = Math.max(1, Number(DEFAULT_DELIVERY_PRICES?.fallbackRatePerKm) || 90);
  const distanceKm = normalizeDeliveryServer(known.name) === normalizeDeliveryServer(DEFAULT_DELIVERY_PRICES?.origin?.name || 'Мелеуз') ? 0 : Math.ceil(price / referenceRate);
  const serviceAreaKm = Math.max(0, Number(site?.serviceAreaKm) || 150);
  const outOfArea = distanceKm > serviceAreaKm;
  return {
    kind: outOfArea ? 'out-of-area' : 'fixed',
    city: String(known.name || city),
    price: outOfArea ? null : price,
    distanceKm,
    serviceAreaKm,
    outOfArea,
    resolved: !outOfArea
  };
}
""", """function fixedDeliveryForCity(city, site) {
  const destinations = Array.isArray(DEFAULT_DELIVERY_PRICES?.destinations) ? DEFAULT_DELIVERY_PRICES.destinations : [];
  const known = destinations.find(item => normalizeDeliveryServer(item.name) === normalizeDeliveryServer(city));
  if (!known) return null;
  // Listed destinations are explicit business tariffs. Some may intentionally be outside
  // the normal radius, so price must never be used as a proxy for distance.
  return {
    kind:'fixed',
    city:String(known.name || city),
    price:Math.max(0, Math.round(Number(known.price) || 0)),
    distanceKm:null,
    serviceAreaKm:Math.max(0, Number(site?.serviceAreaKm) || 150),
    outOfArea:false,
    resolved:true
  };
}
""", 'server fixed delivery business rule')

# Keep every repeated warranty label tied to one runtime setting.
p=Path('public-site-settings.js')
s=p.read_text(encoding='utf-8')
needle="""  const trustWarranty = document.querySelector('.trust-points > div:nth-child(3) b');
  if (trustWarranty && site.warrantyYears) trustWarranty.textContent = `Гарантия — ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;
"""
replacement=needle+"""  const catalogWarranty = document.querySelector('.catalog-trust-strip > span:last-child');
  if (catalogWarranty && site.warrantyYears) catalogWarranty.textContent = `Гарантия ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;
"""
if replacement not in s:
    if needle not in s: raise SystemExit('runtime warranty anchor not found')
    s=s.replace(needle,replacement,1)
p.write_text(s,encoding='utf-8')

# Make delivery exclusion visible right where scan-only users look at the prices.
p=Path('app.js')
s=p.read_text(encoding='utf-8')
old="""        <div class=\"price-row turnkey\"><small>С новыми усиленными столбами</small><strong>${money(product.price+product.install+product.posts)}</strong></div>
      </div><button class=\"select-product\" data-product=\"${product.id}\" type=\"button\" aria-expanded=\"false\">Рассчитать стоимость</button></div>
"""
new="""        <div class=\"price-row turnkey\"><small>С новыми усиленными столбами</small><strong>${money(product.price+product.install+product.posts)}</strong></div>
        <div class=\"price-delivery-note\">Доставка рассчитывается после выбора места установки</div>
      </div><button class=\"select-product\" data-product=\"${product.id}\" type=\"button\" aria-expanded=\"false\">Рассчитать стоимость</button></div>
"""
if new not in s:
    if old not in s: raise SystemExit('card delivery note anchor not found')
    s=s.replace(old,new,1)
p.write_text(s,encoding='utf-8')

p=Path('gate-page.css')
s=p.read_text(encoding='utf-8')
rule='\n.price-delivery-note{margin-top:5px;color:#7f786f;font-size:9px;line-height:1.35;font-weight:600}\n'
if '.price-delivery-note{' not in s:
    s=s.rstrip()+rule
p.write_text(s,encoding='utf-8')

# Permanent regression checks for these business rules.
p=Path('scripts/test-gate-page.mjs')
s=p.read_text(encoding='utf-8')
marker="assert(html.includes('class=\"skip-link\"'), 'Gate page must include a keyboard skip link');"
addition=marker+"\nassert(app.includes('price-delivery-note'), 'Catalog cards must explain that delivery is calculated after selecting the installation place');\nassert(!delivery.includes('fixedDistanceEstimate'), 'Explicit delivery tariffs must not infer distance from price');\nassert(delivery.includes('A listed destination is an explicit business tariff'), 'Client delivery module must preserve explicit tariff exceptions');"
if addition not in s:
    if marker not in s: raise SystemExit('foundation test marker not found')
    s=s.replace(marker,addition,1)
p.write_text(s,encoding='utf-8')

# Ensure server quote regression suite is part of the main deployment gate.
p=Path('.github/workflows/deploy-preview.yml')
s=p.read_text(encoding='utf-8')
needle="""      - name: Verify gate calculator
        run: node scripts/test-gate-calculator.mjs

      - name: Verify production build
"""
replacement="""      - name: Verify gate calculator
        run: node scripts/test-gate-calculator.mjs

      - name: Verify server gate quote
        run: node scripts/test-server-gate-quote.mjs

      - name: Verify production build
"""
if replacement not in s:
    if needle not in s: raise SystemExit('deploy workflow test anchor not found')
    s=s.replace(needle,replacement,1)
p.write_text(s,encoding='utf-8')

print('Final hardening pass applied')
