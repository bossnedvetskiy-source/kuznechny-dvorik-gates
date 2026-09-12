import http from 'node:http';
import {readFile, stat} from 'node:fs/promises';
import {extname, join, normalize} from 'node:path';

const root = process.cwd();
const port = Number(process.env.PORT || 4173);
const delivery = await readFile(join(root, 'delivery-prices.json'), 'utf8');
const mime = {
  '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webp':'image/webp', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml'
};

function send(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {'content-type':type, 'cache-control':'no-store'});
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);
  if (url.pathname === '/api/catalog-images') return send(res, 200, JSON.stringify({galleries:{}}), mime['.json']);
  if (url.pathname === '/api/leads') {
    if (req.method !== 'POST') return send(res, 405, JSON.stringify({error:'Метод не поддерживается'}), mime['.json']);
    let raw='';
    for await (const chunk of req) raw += chunk;
    let payload={};
    try { payload=JSON.parse(raw || '{}'); } catch {}
    return send(res, 201, JSON.stringify({ok:true,id:1,quote:{verified:true,total:Number(payload.total)||0}}), mime['.json']);
  }
  if (url.pathname === '/api/delivery') return send(res, 502, JSON.stringify({error:'Маршрут не настроен в тестовом сервере'}), mime['.json']);

  try {
    if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/vorota' || url.pathname === '/vorota/') {
      let html = await readFile(join(root, 'index.html'), 'utf8');
      html = html.replace('<script id="deliveryData" type="application/json">{}</script>', `<script id="deliveryData" type="application/json">${delivery.replace(/</g,'\\u003c')}</script>`);
      html = html.replace('<script src="gate-page-ui.js"></script>', '<script src="gate-page-ui.js"></script>\n  <script src="color-photo-site.js"></script>');
      return send(res, 200, html, mime['.html']);
    }
    const relative = normalize(decodeURIComponent(url.pathname)).replace(/^[/\\]+/, '');
    const path = join(root, relative);
    if (!path.startsWith(root)) return send(res, 403, 'Forbidden');
    const info = await stat(path);
    if (!info.isFile()) return send(res, 404, 'Not found');
    return send(res, 200, await readFile(path), mime[extname(path).toLowerCase()] || 'application/octet-stream');
  } catch {
    return send(res, 404, 'Not found');
  }
});

server.listen(port, '127.0.0.1', () => console.log(`E2E server listening on http://127.0.0.1:${port}`));
