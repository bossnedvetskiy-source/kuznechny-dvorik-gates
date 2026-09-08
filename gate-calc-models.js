/* Generated loader for Excel-derived article formulas. */
window.GATE_CALC_MODELS_READY=(async()=>{
  const b64=window.__GATE_CALC_B64||'';
  if(!b64) throw new Error('Не загружены данные расчётных моделей');
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  if(!('DecompressionStream' in window)) throw new Error('Браузер не поддерживает распаковку модели расчёта');
  const text=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  (0,eval)(text);
  delete window.__GATE_CALC_B64;
  return window.GATE_CALC_MODELS;
})();
