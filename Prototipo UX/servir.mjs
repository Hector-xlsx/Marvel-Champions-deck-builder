import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const dist = fileURLToPath(new URL('./dist/', import.meta.url));
const assets = fileURLToPath(new URL('../dist/assets/', import.meta.url));
const mime = {'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.webp':'image/webp'};
const port = 4191;

http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const image = pathname.startsWith('/assets/');
    const root = path.resolve(image ? assets : dist);
    const relative = image ? pathname.slice('/assets/'.length) : pathname === '/' ? 'index.html' : pathname.slice(1);
    const file = path.resolve(root, relative);
    const extension = path.extname(file);
    if (!file.startsWith(root + path.sep) || !mime[extension] || (image && extension !== '.webp') || !(await stat(file)).isFile()) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, {'Content-Type': mime[extension], 'Cache-Control': 'no-cache'});
    createReadStream(file).on('error', () => response.destroy()).pipe(response);
  } catch {
    response.writeHead(404).end();
  }
}).listen(port, '127.0.0.1', () => console.log('Prototipo UX en http://127.0.0.1:'+port));
