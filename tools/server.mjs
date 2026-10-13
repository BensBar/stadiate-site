import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const types = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.json': 'application/json',
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
      const headers = {
        'Content-Type': types[extname(file)] || 'application/octet-stream',
        'Content-Length': content.length,
        'Accept-Ranges': 'bytes',
      };
      if (request.headers.range) {
        const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
        const start = range?.[1] ? Number(range[1]) : Math.max(0, content.length - Number(range?.[2]));
        const end = range?.[1] && range[2] ? Math.min(Number(range[2]), content.length - 1) : content.length - 1;
        if (!range || (!range[1] && !range[2]) || !Number.isSafeInteger(start) || !Number.isSafeInteger(end)
          || start > end || start >= content.length) {
          response.writeHead(416, { 'Content-Range': `bytes */${content.length}` }).end();
          return;
        }
        response.writeHead(206, {
          ...headers, 'Content-Length': end - start + 1,
          'Content-Range': `bytes ${start}-${end}/${content.length}`,
        });
        response.end(request.method === 'HEAD' ? undefined : content.subarray(start, end + 1));
        return;
      }
      response.writeHead(200, headers);
      response.end(request.method === 'HEAD' ? undefined : content);
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
