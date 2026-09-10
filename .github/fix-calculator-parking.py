from pathlib import Path

# Keep the calculator in the document when it is closed. This prevents a real race
# between "choose another design" and asynchronous catalog re-renders.
p = Path('index.html')
s = p.read_text(encoding='utf-8')
old = '    <section class="calculator inline-calculator" id="calculator" hidden>'
new = '    <div id="calculatorParking" hidden></div>\n    <section class="calculator inline-calculator" id="calculator" hidden>'
if old in s:
    s = s.replace(old, new, 1)
elif 'id="calculatorParking"' not in s:
    raise SystemExit('calculator insertion anchor missing')
p.write_text(s, encoding='utf-8')

p = Path('app.js')
s = p.read_text(encoding='utf-8')
old = "const calculatorPanel = document.getElementById('calculator');"
new = "const calculatorPanel = document.getElementById('calculator');\nconst calculatorParking = document.getElementById('calculatorParking');"
if old in s:
    s = s.replace(old, new, 1)
elif 'const calculatorParking' not in s:
    raise SystemExit('calculator variable anchor missing')
old = "function closeCalculator() {\n  if (calculatorPanel.parentElement===grid) calculatorPanel.remove();\n  calculatorPanel.hidden=true;\n  document.body.classList.remove('calculator-open');\n  grid.querySelectorAll('.select-product').forEach(button=>button.setAttribute('aria-expanded','false'));\n}"
new = "function closeCalculator() {\n  calculatorPanel.hidden=true;\n  if (calculatorParking && calculatorPanel.parentElement !== calculatorParking) calculatorParking.append(calculatorPanel);\n  document.body.classList.remove('calculator-open');\n  grid.querySelectorAll('.select-product').forEach(button=>button.setAttribute('aria-expanded','false'));\n}"
if old in s:
    s = s.replace(old, new, 1)
elif 'calculatorParking.append(calculatorPanel)' not in s:
    raise SystemExit('close calculator anchor missing')
p.write_text(s, encoding='utf-8')

p = Path('scripts/test-gate-page.mjs')
s = p.read_text(encoding='utf-8')
marker = "assert(html.includes('class=\"skip-link\"'), 'Gate page must include a keyboard skip link');"
addition = marker + "\nassert(html.includes('id=\"calculatorParking\"') && app.includes('calculatorParking.append(calculatorPanel)'), 'Closed calculator must remain parked in the DOM for reliable model switching');"
if addition not in s:
    if marker not in s:
        raise SystemExit('test marker missing')
    s = s.replace(marker, addition, 1)
p.write_text(s, encoding='utf-8')

print('Calculator lifecycle race fixed')
