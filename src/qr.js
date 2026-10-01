// A small QR Code (model 2) encoder, written for the game: byte mode (UTF-8), error correction level
// M, versions 1-10 (up to 213 bytes), and the mask with the lowest penalty, as the standard asks.
// The gate machines show real codes: a phone camera reads them.

const ECC_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26];   // error-correction codewords per block
const BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];           // blocks

function rawModules(v) {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
const dataCodewords = (v) => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLOCKS_M[v];

// Reed-Solomon over GF(256), primitive polynomial x^8 + x^4 + x^3 + x^2 + 1
function mul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; }
  return z & 0xff;
}
function rsDivisor(deg) {
  const r = new Array(deg).fill(0); r[deg - 1] = 1;
  let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < r.length; j++) { r[j] = mul(r[j], root); if (j + 1 < r.length) r[j] ^= r[j + 1]; }
    root = mul(root, 0x02);
  }
  return r;
}
function rsRemainder(data, div) {
  const r = div.map(() => 0);
  for (const b of data) { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= mul(c, f); }); }
  return r;
}
function alignPositions(v, size) {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, step = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2, out = [6];
  for (let pos = size - 7; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

/** the QR modules for `text`: {size, dark(x, y)} */
export function qrEncode(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let ver = 1;
  for (; ver <= 10; ver++) if (4 + (ver < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(ver) * 8) break;
  if (ver > 10) throw new Error('QR: text too long');
  // the bit stream: byte mode, the length, the bytes, terminator and padding
  const bits = [], put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(4, 4); put(bytes.length, ver < 10 ? 8 : 16); for (const b of bytes) put(b, 8);
  const cap = dataCodewords(ver) * 8;
  put(0, Math.min(4, cap - bits.length));
  put(0, (8 - (bits.length % 8)) % 8);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) put(p, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  // error correction per block, then the blocks interleaved
  const nb = BLOCKS_M[ver], ecl = ECC_M[ver], raw = Math.floor(rawModules(ver) / 8);
  const nShort = nb - (raw % nb), shortLen = Math.floor(raw / nb), div = rsDivisor(ecl), blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dat = data.slice(k, k + shortLen - ecl + (i < nShort ? 0 : 1)); k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < nShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const cw = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== shortLen - ecl || j >= nShort) cw.push(b[i]); });

  // the symbol: function patterns, then the data in its zigzag
  const size = ver * 4 + 17;
  const M = Array.from({ length: size }, () => new Array(size).fill(false));
  const F = Array.from({ length: size }, () => new Array(size).fill(false));
  const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy, d = Math.max(Math.abs(dx), Math.abs(dy));
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const al = alignPositions(ver, size), na = al.length;
  for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  const bit = (v, i) => ((v >>> i) & 1) !== 0;
  const drawFormat = (mask) => {
    const d = (0 << 3) | mask;                         // level M = 00
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const b = ((d << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) set(8, i, bit(b, i));
    set(8, 7, bit(b, 6)); set(8, 8, bit(b, 7)); set(7, 8, bit(b, 8));
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(b, i));
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(b, i));
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(b, i));
    set(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const b = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) { const a = size - 11 + (i % 3), c = Math.floor(i / 3); set(a, c, bit(b, i)); set(c, a, bit(b, i)); }
  }
  let bi = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!F[y][x] && bi < cw.length * 8) { M[y][x] = bit(cw[bi >>> 3], 7 - (bi & 7)); bi++; }
    }
  }
  const MASKS = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ];
  const applyMask = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
  // the standard's penalty: long runs, 2x2 blocks, finder-like patterns, dark/light balance
  const penalty = () => {
    let s = 0;
    const hist = (h, len) => { if (h[0] === 0) len += size; h.pop(); h.unshift(len); };
    const count = (h) => { const n = h[1], core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n; return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0); };
    const line = (get) => {
      let col = false, run = 0; const h = [0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < size; i++) {
        if (get(i) === col) { run++; if (run === 5) s += 3; else if (run > 5) s++; } else { hist(h, run); if (!col) s += count(h) * 40; col = get(i); run = 1; }
      }
      if (col) { hist(h, run); run = 0; }
      run += size; hist(h, run); s += count(h) * 40;
    };
    for (let y = 0; y < size; y++) line((x) => M[y][x]);
    for (let x = 0; x < size; x++) line((y) => M[y][x]);
    let dark = 0;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (M[y][x]) dark++;
      if (x < size - 1 && y < size - 1) { const c = M[y][x]; if (c === M[y][x + 1] && c === M[y + 1][x] && c === M[y + 1][x + 1]) s += 3; }
    }
    const total = size * size;
    return s + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  };
  let best = 0, bs = Infinity;
  for (let m = 0; m < 8; m++) { applyMask(m); drawFormat(m); const p = penalty(); if (p < bs) { bs = p; best = m; } applyMask(m); }
  applyMask(best); drawFormat(best);
  return { size, version: ver, mask: best, dark: (x, y) => M[y][x] };
}

/** draw `text` as a QR code at (x, y), `w` pixels wide including the 4-module quiet zone */
export function drawQR(g, text, x, y, w, { dark = '#111', light = '#fff' } = {}) {
  const q = qrEncode(text), n = q.size + 8, px = w / n;
  g.fillStyle = light; g.fillRect(x, y, w, w);
  g.fillStyle = dark;
  for (let r = 0; r < q.size; r++) for (let c = 0; c < q.size; c++) if (q.dark(c, r)) g.fillRect(Math.floor(x + (c + 4) * px), Math.floor(y + (r + 4) * px), Math.ceil(px), Math.ceil(px));
  return q;
}
