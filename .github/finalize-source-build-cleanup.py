from pathlib import Path


def replace_once(text, old, new, label):
    if old in text:
        return text.replace(old, new, 1)
    if new in text:
        return text
    raise SystemExit(f'{label}: expected source not found')

# 1) Make admin.js itself production-ready so build.mjs no longer patches its behavior.
p = Path('admin.js')
s = p.read_text(encoding='utf-8')
s = replace_once(
    s,
    """  if (response.status === 401) {\n    showLogin();\n    throw new Error('Сеанс завершён. Войдите снова.');\n  }""",
    """  if (response.status === 401 && path !== '/api/admin/login') {\n    showLogin();\n    throw new Error('Сеанс завершён. Войдите снова.');\n  }""",
    'admin login 401 handling'
)

if 'let photoUploadEnabled = true;' not in s:
    s = s.replace('let selectedPhotoIndex = 0;\nlet toastTimer;', 'let selectedPhotoIndex = 0;\nlet photoUploadEnabled = true;\nlet toastTimer;', 1)

old_optimize = """async function optimizeImage(file) {\n  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: выбран не файл фотографии`);\n  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: исходный файл превышает 25 МБ`);\n  const image = await loadImage(file);\n  const ratio = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));\n  const width = Math.max(1, Math.round(image.naturalWidth * ratio));\n  const height = Math.max(1, Math.round(image.naturalHeight * ratio));\n  const canvas = document.createElement('canvas');\n  canvas.width = width;\n  canvas.height = height;\n  const context = canvas.getContext('2d', {alpha: false});\n  context.fillStyle = '#ffffff';\n  context.fillRect(0, 0, width, height);\n  context.drawImage(image, 0, 0, width, height);\n  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));\n  if (!blob) throw new Error(`${file.name}: не удалось подготовить фотографию`);\n  return blob;\n}"""
new_optimize = """async function optimizeImage(file) {\n  if (!file.type.startsWith('image/')) throw new Error(`${file.name}: выбран не файл фотографии`);\n  if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name}: исходный файл превышает 25 МБ`);\n  const image = await loadImage(file);\n  const targetBytes = 1350000;\n  let maxSide = 1800;\n  let quality = .86;\n\n  for (let attempt = 0; attempt < 10; attempt += 1) {\n    const ratio = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));\n    const width = Math.max(1, Math.round(image.naturalWidth * ratio));\n    const height = Math.max(1, Math.round(image.naturalHeight * ratio));\n    const canvas = document.createElement('canvas');\n    canvas.width = width;\n    canvas.height = height;\n    const context = canvas.getContext('2d', {alpha: false});\n    context.fillStyle = '#ffffff';\n    context.fillRect(0, 0, width, height);\n    context.drawImage(image, 0, 0, width, height);\n    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));\n    if (!blob) throw new Error(`${file.name}: не удалось подготовить фотографию`);\n    if (blob.size <= targetBytes) return blob;\n    if (quality > .62) quality -= .08;\n    else {\n      maxSide = Math.max(1100, Math.round(maxSide * .84));\n      quality = .76;\n    }\n  }\n  throw new Error(`${file.name}: фотография слишком большая после оптимизации`);\n}"""
s = replace_once(s, old_optimize, new_optimize, 'admin image optimization')

if "if (!photoUploadEnabled) return showToast('Загрузка фотографий временно недоступна', true);" not in s:
    s = s.replace("async function uploadFiles(files) {\n  const available = 12 - draft.photos.length;", "async function uploadFiles(files) {\n  if (!photoUploadEnabled) return showToast('Загрузка фотографий временно недоступна', true);\n  const available = 12 - draft.photos.length;", 1)

s = replace_once(
    s,
    """    photoInput.value = '';\n    photoInput.disabled = false;\n    uploadNote.classList.remove('loading');\n    uploadNote.textContent = 'Можно загрузить до 12 фотографий. Большие файлы автоматически уменьшаются без изменения пропорций.';""",
    """    photoInput.value = '';\n    photoInput.disabled = !photoUploadEnabled;\n    uploadNote.classList.remove('loading');\n    uploadNote.textContent = photoUploadEnabled\n      ? 'Можно загрузить до 12 фотографий. Фото автоматически уменьшаются без обрезки и искажения.'\n      : 'Загрузка фотографий временно недоступна. Порядок и обложку существующих фото можно менять.';""",
    'admin upload finally'
)

s = replace_once(
    s,
    """    galleries = data.galleries;\n    const articles = Object.keys(galleries);\n    articleSelect.innerHTML = articles.map(article => `<option value=\"${article}\">${article}</option>`).join('');\n    showEditor();\n    selectArticle(articles[0]);""",
    """    galleries = data.galleries;\n    photoUploadEnabled = data.photoUploadEnabled !== false;\n    photoInput.disabled = !photoUploadEnabled;\n    document.querySelector('.upload-button')?.classList.toggle('disabled', !photoUploadEnabled);\n    uploadNote.textContent = photoUploadEnabled\n      ? 'Можно загрузить до 12 фотографий. Фото автоматически уменьшаются без обрезки и искажения.'\n      : 'Загрузка фотографий временно недоступна. Порядок и обложку существующих фото можно менять.';\n    const articles = Object.keys(galleries);\n    articleSelect.innerHTML = articles.map(article => `<option value=\"${article}\">${article}</option>`).join('');\n    showEditor();\n    selectArticle(articles[0]);\n    window.dispatchEvent(new CustomEvent('admin:ready'));""",
    'admin catalog readiness'
)
p.write_text(s, encoding='utf-8')

# 2) Build must embed the source admin JS as-is; no behavioral string surgery.
p = Path('scripts/build.mjs')
s = p.read_text(encoding='utf-8')
start = s.find('let adminJs = adminJsSource')
end = s.find('const adminHtml = adminHtmlSource', start)
if start >= 0:
    if end < 0:
        raise SystemExit('build admin patch block end missing')
    s = s[:start] + 'const adminJs = adminJsSource;\n\n' + s[end:]
elif 'const adminJs = adminJsSource;' not in s:
    raise SystemExit('build admin source assignment missing')
p.write_text(s, encoding='utf-8')

# 3) Wording consistency in shared lead validation.
p = Path('shared/leads.js')
s = p.read_text(encoding='utf-8')
s = s.replace('Подтвердите согласие на обработку данных', 'Подтвердите согласие на обработку персональных данных')
p.write_text(s, encoding='utf-8')

# 4) Add regression assertions so build cannot silently reintroduce patching.
p = Path('scripts/test-gate-page.mjs')
s = p.read_text(encoding='utf-8')
marker = "assert(html.includes('class=\"skip-link\"'), 'Gate page must include a keyboard skip link');"
addition = marker + "\nassert(adminJs.includes(\"path !== '/api/admin/login'\"), 'Admin source must handle login 401 without production patching');\nassert(adminJs.includes('targetBytes = 1350000') && adminJs.includes('photoUploadEnabled'), 'Admin source must contain production photo handling');\nassert(adminJs.includes(\"new CustomEvent('admin:ready')\"), 'Admin source must emit readiness event itself');\nassert(build.includes('const adminJs = adminJsSource;'), 'Build must embed admin source directly');\nassert(!build.includes('optimizeStart = adminJs.indexOf') && !build.includes(\"galleries = data.galleries;\\n    const articles\"), 'Build must not rewrite admin behavior by source-string surgery');\nassert(leads.includes('обработку персональных данных'), 'Shared lead validation must use consistent consent wording');"
if addition not in s:
    if marker not in s:
        raise SystemExit('test marker missing')
    s = s.replace(marker, addition, 1)
p.write_text(s, encoding='utf-8')

print('Source/build cleanup applied')
