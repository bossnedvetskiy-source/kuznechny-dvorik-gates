from pathlib import Path

# Remove hidden manual crop controls from admin HTML. The editor always shows original proportions.
p = Path('admin.html')
s = p.read_text(encoding='utf-8')
start = s.find('              <div class="crop-help" id="cropHelp" hidden>')
end = s.find('              </div>\n            </section>', start)
if start < 0:
    if 'id="cropHelp"' in s or 'name="fitMode"' in s:
        raise SystemExit('unexpected crop HTML layout')
else:
    if end < 0:
        raise SystemExit('crop HTML end not found')
    # End points after fit-options closing div; keep section closing.
    s = s[:start] + s[end + len('              </div>\n'):]
p.write_text(s, encoding='utf-8')

# Remove inactive crop/zoom/drag code from admin JS while preserving the gallery data shape.
p = Path('admin.js')
s = p.read_text(encoding='utf-8')
for line in [
    "const cropHelp = document.getElementById('cropHelp');\n",
    "const centerPhotoButton = document.getElementById('centerPhotoButton');\n",
    "const bottomPhotoButton = document.getElementById('bottomPhotoButton');\n",
    "const fitPhotoButton = document.getElementById('fitPhotoButton');\n",
    "const fillPhotoButton = document.getElementById('fillPhotoButton');\n",
    "const cropZoom = document.getElementById('cropZoom');\n",
    "const cropZoomValue = document.getElementById('cropZoomValue');\n",
    "const cropZoomMinus = document.getElementById('cropZoomMinus');\n",
    "const cropZoomPlus = document.getElementById('cropZoomPlus');\n",
    "const DRAG_RESERVE = .08;\n",
]:
    s = s.replace(line, '')

zoom_fn = "function displayZoom(zoom) {\n  return zoom >= 1 ? zoom + DRAG_RESERVE : zoom;\n}\n\n"
s = s.replace(zoom_fn, '')
s = s.replace("    thumb.title = `Настроить область показа фотографии ${index + 1}`;", "    thumb.title = `Показать фотографию ${index + 1} в предпросмотре`;", 1)
s = s.replace("    const position = draft.positions[url] || {x: 50, y: 50};\n    const zoom = draft.zooms[url] || 1;\n", '', 1)
s = s.replace("  const selectedPosition = draft.positions[selectedUrl] || {x: 50, y: 50};\n  const selectedZoom = draft.zooms[selectedUrl] || 1;\n", '', 1)
s = s.replace("  cropHelp.hidden = true;\n  cropZoom.value = String(Math.round(selectedZoom * 100));\n  cropZoomValue.value = `${Math.round(selectedZoom * 100)}%`;\n  cropZoomValue.textContent = cropZoomValue.value;\n  document.querySelectorAll('input[name=\"fitMode\"]').forEach(input => { input.checked = input.value === draft.fitMode; });\n", '', 1)

start = s.find('function setSelectedPosition(x, y) {')
end = s.find('function movePhoto(index, direction) {', start)
if start >= 0:
    if end < 0:
        raise SystemExit('admin crop JS end not found')
    s = s[:start] + s[end:]
elif 'setSelectedZoom(' in s or 'dragState' in s:
    raise SystemExit('unexpected remaining crop JS')

fit_listener = "document.querySelectorAll('input[name=\"fitMode\"]').forEach(input => input.addEventListener('change', () => {\n  draft.fitMode = 'contain';\n  setDirty();\n  render();\n}));\n\n"
s = s.replace(fit_listener, '')

# Build-time patch anchors must remain stable.
for anchor in [
    "if (response.status === 401) {\n    showLogin();\n    throw new Error('Сеанс завершён. Войдите снова.');\n  }",
    "galleries = data.galleries;\n    const articles = Object.keys(galleries);",
    "showEditor();\n    selectArticle(articles[0]);",
    'async function optimizeImage(file) {',
    '\nasync function uploadFiles(files) {'
]:
    if anchor not in s:
        raise SystemExit(f'build anchor missing after admin cleanup: {anchor[:45]}')
p.write_text(s, encoding='utf-8')

# Remove obsolete crop-only CSS blocks/rules. Keep normal preview/photo styles.
p = Path('admin.css')
s = p.read_text(encoding='utf-8')
# Individual fit options rule near the top.
start = s.find('.fit-options{display:grid;')
end = s.find('\n.upload-button{', start)
if start >= 0 and end >= 0:
    s = s[:start] + s[end+1:]
# Entire appended manual-crop section through the old force-contain override.
marker = '\n/* Визуальный выбор области показа фотографии. */'
start = s.find(marker)
if start >= 0:
    s = s[:start].rstrip() + '\n\n/* Фотографии в редакторе всегда показываются целиком, без обрезки и искажения. */\n.card-preview img,.photo-thumb img{object-fit:contain!important;object-position:center!important;transform:none!important}\n'
p.write_text(s, encoding='utf-8')

# Add a permanent regression check for dead crop controls/code.
p = Path('scripts/test-gate-page.mjs')
s = p.read_text(encoding='utf-8')
old = "const [html, app, runtime, ui, build, delivery, customer, leads, workerLeads, adminLeads] = await Promise.all(["
new = "const [html, app, runtime, ui, build, delivery, customer, leads, workerLeads, adminLeads, adminHtml, adminJs] = await Promise.all(["
if old in s:
    s = s.replace(old, new, 1)
    old_tail = "  readFile('worker/leads-d1.js','utf8'),\n  readFile('admin-leads.js','utf8')\n]);"
    new_tail = "  readFile('worker/leads-d1.js','utf8'),\n  readFile('admin-leads.js','utf8'),\n  readFile('admin.html','utf8'),\n  readFile('admin.js','utf8')\n]);"
    if old_tail not in s:
        raise SystemExit('test Promise tail not found')
    s = s.replace(old_tail, new_tail, 1)
marker = "assert(ui.includes('Указать место установки'), 'Mobile CTA must work for cities, villages and settlements');"
addition = marker + "\nassert(!adminHtml.includes('cropHelp') && !adminHtml.includes('name=\"fitMode\"'), 'Admin must not contain hidden crop UI');\nassert(!adminJs.includes('setSelectedZoom') && !adminJs.includes('dragState'), 'Admin must not contain inactive crop/drag logic');"
if addition not in s:
    if marker not in s:
        raise SystemExit('admin test marker not found')
    s = s.replace(marker, addition, 1)
p.write_text(s, encoding='utf-8')

print('Admin photo editor dead crop code removed')
