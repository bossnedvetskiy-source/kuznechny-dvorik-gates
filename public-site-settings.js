(() => {
  const site = window.SITE_SETTINGS || {};

  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element && value) element.textContent = value;
  };

  const yearWord = value => {
    const n = Math.abs(Number(value)) % 100;
    const n10 = n % 10;
    if (n > 10 && n < 20) return 'лет';
    if (n10 === 1) return 'год';
    if (n10 >= 2 && n10 <= 4) return 'года';
    return 'лет';
  };

  const setBoldLine = (element, boldText, tailText) => {
    if (!element) return;
    const bold = document.createElement('b');
    bold.textContent = boldText;
    element.replaceChildren(bold, document.createTextNode(` ${tailText}`));
  };

  const phoneDigits = String(site.phoneDigits || '').replace(/\D/g, '');
  const phoneDisplay = site.phoneDisplay || '';
  if (phoneDigits) {
    document.querySelectorAll('a[href^="tel:"]').forEach(link => {
      link.href = `tel:+${phoneDigits}`;
      if (link.classList.contains('phone') || link.closest('footer')) link.textContent = phoneDisplay || `+${phoneDigits}`;
    });
  }

  const rangePill = document.querySelector('.private-pill');
  if (rangePill && Number.isFinite(Number(site.serviceAreaKm))) {
    const dot = document.createElement('i');
    rangePill.replaceChildren(dot, document.createTextNode(` Мелеуз · выезд до ${site.serviceAreaKm} км`));
  }

  setText('.hero .eyebrow', site.heroEyebrow);
  setText('.hero h1 span', site.heroTitleMain);
  setText('.hero h1 em', site.heroTitleAccent);
  setText('.hero > p', site.heroText);

  const heroPoints = document.querySelectorAll('.hero-points > span');
  if (heroPoints[0] && site.warrantyYears) setBoldLine(heroPoints[0], `${site.warrantyYears} ${yearWord(site.warrantyYears)}`, 'гарантии на конструкцию');
  if (heroPoints[1] && site.productionDays) setBoldLine(heroPoints[1], `до ${site.productionDays} раб. дней`, 'срок изготовления');

  const productionText = document.querySelector('.package-grid article[data-package="production"] p');
  if (productionText && site.productionDays) productionText.textContent = `По размерам вашего проёма, до ${site.productionDays} рабочих дней.`;

  const trustCopy = document.querySelector('.trust-copy > p');
  if (trustCopy && site.trustText) trustCopy.textContent = `${site.trustText} Гарантия на конструкцию — ${site.warrantyYears} ${yearWord(site.warrantyYears)}.`;
  const trustWarranty = document.querySelector('.trust-points > div:nth-child(3) b');
  if (trustWarranty && site.warrantyYears) trustWarranty.textContent = `Гарантия — ${site.warrantyYears} ${yearWord(site.warrantyYears)}`;

  setText('.final-cta h2', site.finalCtaTitle);
  setText('.final-cta p', site.finalCtaText);

  const footer = document.querySelector('footer');
  if (footer && site.businessHours) {
    let hours = footer.querySelector('[data-runtime-hours]');
    if (!hours) {
      hours = document.createElement('span');
      hours.dataset.runtimeHours = 'true';
      const phoneLink = footer.querySelector('a[href^="tel:"]');
      if (phoneLink) footer.insertBefore(hours, phoneLink);
      else footer.append(hours);
    }
    hours.textContent = site.businessHours;
  }
})();
