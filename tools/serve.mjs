// Tiny local server for the game (Node.js only, no packages): `node tools/serve.mjs [--open] [--port N]`
//
// Why: YouTube's embedded player will not play in a page opened as a file (error 153: no http origin),
// and websites like www.iitg.ac.in forbid being shown inside a frame (X-Frame-Options: DENY). Served
// from http://localhost the auditorium and Conference Centre screens play their films, and the
// Computer Centre's in-game browser shows real web pages through /p/<scheme>/<host>/<path>: every
// page, stylesheet, script, font and data request of the site goes through here, so the page works
// as if it were on its own site.
//
// Safety: listens on 127.0.0.1 only; the proxy needs a random per-run key (a cookie set by the page
// this server sends), only fetches http(s) pages on public hosts (checked again at every redirect and
// when the connection is made, so a site cannot aim the proxy at your own machine or network), and
// never forwards your cookies.
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import zlib from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import { isIP } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const TOKEN = randomBytes(18).toString('hex');
const args = process.argv.slice(2);
let port = +(args[args.indexOf('--port') + 1] || 0) || 8871;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.ico': 'image/x-icon' };
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36';

function privateHost(ip) {
  if (isIP(ip) === 6) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip) || (ip.startsWith('::ffff:') && privateHost(ip.slice(7)));
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}
const cookieOk = (req) => (req.headers.cookie || '').split(/;\s*/).includes(`iitg3d=${TOKEN}`);

/** Name lookups made for the proxy are checked at connection time, so a name that points (or is rebound) to a private address is refused. */
function guardedLookup(host, opts, cb) {
  dns.lookup(host, opts, (err, address, family) => {
    const list = Array.isArray(address) ? address.map((a) => a.address) : [address];
    if (!err && list.some((a) => privateHost(a))) return cb(Object.assign(new Error('private address'), { code: 'PRIVATE' }));
    cb(err, address, family);
  });
}

/** One GET, no redirects followed, the body decoded and capped at 25 MB. */
function getOnce(target, headers) {
  return new Promise((resolve, reject) => {
    const req = (target.protocol === 'https:' ? https : http).request(target, { method: 'GET', headers, lookup: guardedLookup, timeout: 15000 }, (res) => {
      const enc = String(res.headers['content-encoding'] || '').toLowerCase();
      const src = enc === 'gzip' ? res.pipe(zlib.createGunzip()) : enc === 'deflate' ? res.pipe(zlib.createInflate()) : enc === 'br' ? res.pipe(zlib.createBrotliDecompress()) : res;
      const chunks = []; let size = 0;
      src.on('data', (c) => { size += c.length; if (size > 25e6) req.destroy(new Error('response too large')); else chunks.push(c); });
      src.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      src.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    req.end();
  });
}

/** GET a public web page. Every hop of a redirect is checked again: a site cannot send the proxy to a private address. */
async function fetchPublic(start, headers) {
  let target = new URL(start);
  for (let hop = 0; hop < 8; hop++) {
    if (!/^https?:$/.test(target.protocol)) throw Object.assign(new Error('only http(s)'), { code: 'PRIVATE' });
    const host = target.hostname.replace(/^\[|\]$/g, '');
    if (/^localhost$/i.test(host) || (isIP(host) && privateHost(host))) throw Object.assign(new Error('private address'), { code: 'PRIVATE' });
    const r = await getOnce(target, headers);
    const loc = r.headers.location;
    if (r.status >= 300 && r.status < 400 && loc) { target = new URL(loc, target); continue; }
    return { ...r, url: target.href };
  }
  throw new Error('too many redirects');
}

/** YouTube search for the PC's YouTube app: the video results of youtube.com's own search page (a
 *  search you would make in a browser), else DuckDuckGo's results for youtube.com. Titles, channels,
 *  lengths; the video itself always plays in YouTube's embedded player. */
async function ytSearch(q) {
  const out = [];
  try {
    const r = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=en&gl=IN`, { headers: { 'user-agent': UA, 'accept-language': 'en-IN,en;q=0.9', cookie: 'CONSENT=YES+1; SOCS=CAI' } });
    const html = await r.text();
    const m = html.match(/var ytInitialData = (\{.*?\});\s*<\/script>/s);
    if (m) {
      const walk = (o) => {
        if (!o || typeof o !== 'object' || out.length >= 24) return;
        const v = o.videoRenderer;
        if (v && v.videoId) { out.push({ id: v.videoId, title: (v.title?.runs || []).map((x) => x.text).join('') || 'Video', by: v.ownerText?.runs?.[0]?.text || '', dur: v.lengthText?.simpleText || '', views: v.shortViewCountText?.simpleText || v.viewCountText?.simpleText || '' }); return; }
        for (const k in o) walk(o[k]);
      };
      walk(JSON.parse(m[1]));
    }
  } catch { /* fall back below */ }
  if (out.length) return out;
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(`site:youtube.com/watch ${q}`)}`, { headers: { 'user-agent': UA, 'accept-language': 'en-IN,en;q=0.9' } });
  const html = await r.text();
  for (const mm of html.matchAll(/<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/gs)) {
    let href = mm[1].replace(/&amp;/g, '&'); const u = href.match(/uddg=([^&]+)/); if (u) href = decodeURIComponent(u[1]);
    const id = (href.match(/[?&]v=([\w-]{11})/) || [])[1];
    if (id && !out.some((x) => x.id === id)) out.push({ id, title: mm[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#x27;/g, "'").trim() || 'Video', by: '', dur: '', views: '' });
    if (out.length >= 20) break;
  }
  return out;
}
/** https://www.iitg.ac.in/acad/x?y  <->  /p/https/www.iitg.ac.in/acad/x?y */
const toLocal = (u) => { const x = new URL(u); return `/p/${x.protocol.slice(0, -1)}/${x.host}${x.pathname}${x.search}`; };
const fromLocal = (p) => { const m = p.match(/^\/p\/(https?)\/([^/]+)(\/.*)?$/); return m ? `${m[1]}://${m[2]}${m[3] || '/'}` : null; };

// injected into every proxied page: links, forms and the title go back to the in-game browser
const NAV = `<script>(function(){
  var real=function(h){ var m=String(h).match(/\\/p\\/(https?)\\/([^\\/]+)(\\/.*)?$/); return m ? m[1]+'://'+m[2]+(m[3]||'/') : h; };
  var post=function(m){ try{ parent.postMessage(Object.assign({src:'iitg-browser'},m),'*'); }catch(e){} };
  addEventListener('click',function(e){ var a=e.target.closest&&e.target.closest('a[href]'); if(!a||e.defaultPrevented||e.button!==0) return;
    var h=a.getAttribute('href'); if(!h||h.charAt(0)==='#'||/^(javascript|mailto|tel):/i.test(h)) return; e.preventDefault(); post({type:'nav',url:real(a.href)}); }, true);
  addEventListener('submit',function(e){ var f=e.target; if((f.method||'get').toLowerCase()!=='get') return; e.preventDefault();
    var u=new URL(real(f.action||location.href)); new FormData(f).forEach(function(v,k){ u.searchParams.append(k,v); }); post({type:'nav',url:u.href}); }, true);
  var t=function(){ post({type:'title',title:document.title,url:real(location.href)}); }; if(document.readyState!=='loading') t(); else addEventListener('DOMContentLoaded',t);
})();<\/script>`;

async function proxy(req, res, real) {
  if (!cookieOk(req)) { res.writeHead(403); return res.end('forbidden'); }
  let target;
  try { target = new URL(real); } catch { res.writeHead(400); return res.end('bad url'); }
  if (!/^https?:$/.test(target.protocol)) { res.writeHead(400); return res.end('only http(s)'); }
  try {
    const r = await fetchPublic(target, { 'user-agent': UA, 'accept-language': 'en-IN,en;q=0.9', accept: req.headers.accept || '*/*', 'accept-encoding': 'gzip, deflate, br' });
    const type = r.headers['content-type'] || 'application/octet-stream';
    let body = r.body;
    const fin = new URL(r.url), origin = `${fin.protocol}//${fin.host}`, local = `/p/${fin.protocol.slice(0, -1)}/${fin.host}`;
    if (/text\/(html|css)/i.test(type)) {
      let text = body.toString('utf8');
      // this site's own absolute links / assets stay on the local path too (same origin: no CORS trouble)
      text = text.split(`${origin}/`).join(`${local}/`).split(`//${fin.host}/`).join(`${local}/`);
      if (/html/i.test(type)) {
        const base = `<base href="${toLocal(r.url).replace(/"/g, '&quot;')}">`;
        text = /<head[^>]*>/i.test(text) ? text.replace(/<head[^>]*>/i, (m) => `${m}${base}${NAV}`) : base + NAV + text;
      }
      body = Buffer.from(text, 'utf8');
    }
    res.writeHead(r.status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  } catch (e) {
    if (e.code === 'PRIVATE') { res.writeHead(403); return res.end('private address'); }
    res.writeHead(502, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<body style="font:15px Segoe UI,sans-serif;padding:60px;color:#3c4043"><h2 style="font-weight:500">This site can't be reached</h2><p>${target.hostname} did not answer (${String(e.message).replace(/</g, '&lt;')}). Check your internet connection.</p></body>`);
  }
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  if (u.pathname === '/__ping') { res.writeHead(200, { 'content-type': 'text/plain', 'access-control-allow-origin': '*', 'cache-control': 'no-store' }); return res.end('iitg3d'); }
  if (u.pathname === '/api/yt/search') {
    if (!cookieOk(req)) { res.writeHead(403); return res.end('forbidden'); }
    const q = (u.searchParams.get('q') || '').slice(0, 120);
    try { const items = await ytSearch(q); res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); return res.end(JSON.stringify({ items })); }
    catch (e) { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify({ items: [], error: String(e.message || e).slice(0, 80) })); }
  }
  if (u.pathname.startsWith('/p/')) return proxy(req, res, fromLocal(u.pathname) + u.search);
  if (u.pathname === '/favicon.ico') { res.writeHead(204); return res.end(); }
  const p = u.pathname === '/' ? '/IITG_Campus_3D.html' : decodeURIComponent(u.pathname);
  const file = path.join(ROOT, path.normalize(p).replace(/^([/\\])+/, ''));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  try {
    let data = await readFile(file);
    const ext = path.extname(file).toLowerCase();
    const head = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': 'no-cache' };
    if (ext === '.html') {
      data = Buffer.from(data.toString('utf8').replace('<head>', "<head><script>window.__PROXY__={path:'/p/'};</script>"), 'utf8');
      head['set-cookie'] = `iitg3d=${TOKEN}; Path=/; HttpOnly; SameSite=Strict`;
    }
    res.writeHead(200, head);
    res.end(data);
  } catch { res.writeHead(404); res.end('not found'); }
});

server.on('error', (e) => { if (e.code === 'EADDRINUSE' && port < 8890) { port++; server.listen(port, '127.0.0.1'); } else { console.error(e.message); process.exit(1); } });
server.listen(port, '127.0.0.1', () => {
  // "localhost", not 127.0.0.1: some YouTube videos only allow embedding on named hosts (error 150)
  const url = `http://localhost:${port}/`;
  console.log(`IIT Guwahati 3D is running at ${url}\nKeep this window open while you play; close it to stop the game server.`);
  if (args.includes('--open')) exec(process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`);
});
