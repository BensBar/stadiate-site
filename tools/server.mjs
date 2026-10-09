import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
};

export async function startServer(port = 0) {
  const server = createServer(async (request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const path = pathname === '/' ? 'index.html' : pathname === '/privacy' ? 'privacy.html' : pathname.slice(1);
    const file = resolve(root, path);
    if (!file.startsWith(root.endsWith(sep) ? root : root + sep)
      || !(path === 'index.html' || path === 'privacy.html' || path.startsWith('assets/'))) {
      response.writeHead(404).end('Not found');
      return;
    }
    try {
      const content = await readFile(file);
      response.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' });
      response.end(content);
    } catch (error) {
      if (error.code !== 'ENOENT' && error.code !== 'EISDIR') {
        console.error('Static server read failed:', error);
        response.writeHead(500).end('Unable to read file');
        return;
      }
      response.writeHead(404).end('Not found');
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', resolve);
  });
  return server;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const server = await startServer(Number(process.env.PORT || 4173));
  console.log(`Stadiate preview: http://127.0.0.1:${server.address().port}`);
}
