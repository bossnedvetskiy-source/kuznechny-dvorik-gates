/* Generated loader for Excel-derived article formulas. */
window.GATE_CALC_MODELS_READY=(async()=>{
  const b64=window.__GATE_CALC_B64||'';
  if(!b64) throw new Error('Не загружены данные расчётных моделей');
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  if(!('DecompressionStream' in window)) throw new Error('Браузер не поддерживает распаковку модели расчёта');
  const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  (0,eval)(text);
  if (window.GATE_CALC_MODELS?.models) {
    for (const article of ['39','40']) delete window.GATE_CALC_MODELS.models[article];
  }
  delete window.__GATE_CALC_B64;
  return window.GATE_CALC_MODELS;
})();

/* Mobile UX: selecting a gate must continue the catalog flow instead of opening
   a full-screen pseudo-modal. app.js already places the calculator immediately
   after the selected catalog row, so keep that natural inline placement. */
(() => {
  if (document.getElementById('kuzdvorInlineCalculatorOverride')) return;
  const style=document.createElement('style');
  style.id='kuzdvorInlineCalculatorOverride';
  style.textContent=`
    @media(max-width:620px){
      html body.calculator-open{overflow-x:hidden!important;overflow-y:auto!important}
      .calculator.inline-calculator:not([hidden]).inline-calculator{
        position:relative!important;inset:auto!important;z-index:1!important;
        width:calc(100% - 20px)!important;height:auto!important;max-width:620px!important;
        margin:16px auto 26px!important;padding:10px 10px 82px!important;
        overflow:visible!important;overscroll-behavior:auto!important;-webkit-overflow-scrolling:auto!important;
        background:#0c0d0f!important;border-radius:18px!important;box-sizing:border-box!important;
        scroll-margin-top:10px!important;
      }
      .calculator.inline-calculator:not([hidden]).inline-calculator>.section-head{display:none!important}
      .calculator.inline-calculator:not([hidden]).inline-calculator .calculator-layout{
        display:block!important;width:100%!important;max-width:620px!important;margin:0 auto!important
      }
      .calculator.inline-calculator:not([hidden]).inline-calculator .calc-form{
        margin:0!important;padding:10px!important;border-radius:16px!important
      }
      .calculator.inline-calculator:not([hidden]).inline-calculator .selected-product-preview{
        position:relative!important;top:auto!important;z-index:auto!important;
        margin:0 0 12px!important;box-shadow:none!important
      }
    }
  `;
  document.head.append(style);
})();
