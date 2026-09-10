from pathlib import Path
p=Path('scripts/test-gate-page.mjs')
s=p.read_text(encoding='utf-8')
old="assert(app.includes(\"['fixed','calculated','error'].includes(deliveryState.kind)\"), 'Lead submission must require a resolved delivery state');"
new="assert(app.includes(\"['fixed','calculated','out-of-area','error'].includes(deliveryState.kind)\"), 'Lead submission must require a resolved or intentionally manual delivery state');"
if old in s:
    s=s.replace(old,new,1)
elif new not in s:
    raise SystemExit('delivery state assertion not found')
p.write_text(s,encoding='utf-8')
