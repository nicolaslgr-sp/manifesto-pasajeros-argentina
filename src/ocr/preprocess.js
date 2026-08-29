export function otsuThreshold(hist, total) {
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];
  let sumB = 0, wB = 0, max = 0, thresh = 140;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) { max = between; thresh = t; }
  }
  return thresh;
}

export function grayFromImageData(d, n) {
  const gray = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    gray[i] = Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]);
  }
  return gray;
}

export function stretchGrayContrast(gray, n) {
  let min = 255, max = 0;
  for (let i = 0; i < n; i++) {
    if (gray[i] < min) min = gray[i];
    if (gray[i] > max) max = gray[i];
  }
  const span = Math.max(1, max - min);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.round((gray[i] - min) * 255 / span);
  return out;
}

export function sharpenGray(gray, w, h) {
  const out = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      let v = gray[idx] * 5 - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
      out[idx] = v < 0 ? 0 : (v > 255 ? 255 : v);
    }
  }
  for (let x = 0; x < w; x++) {
    out[x] = gray[x];
    out[(h - 1) * w + x] = gray[(h - 1) * w + x];
  }
  for (let y = 0; y < h; y++) {
    out[y * w] = gray[y * w];
    out[y * w + w - 1] = gray[y * w + w - 1];
  }
  return out;
}

export function adaptiveMeanThreshold(gray, w, h, block = 31, C = 10) {
  const out = new Uint8Array(w * h);
  const half = Math.floor(block / 2);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, count = 0;
      for (let dy = -half; dy <= half; dy += 5) {
        for (let dx = -half; dx <= half; dx += 5) {
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            sum += gray[ny * w + nx];
            count++;
          }
        }
      }
      const mean = sum / Math.max(1, count);
      out[y * w + x] = gray[y * w + x] > (mean - C) ? 255 : 0;
    }
  }
  return out;
}

function writeGrayToCanvas(ctx, gray, w, h, binary, invert) {
  const img = ctx.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < gray.length; i++) {
    let g = gray[i];
    if (binary) g = g > 127 ? 255 : 0;
    if (invert) g = 255 - g;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = g;
    d[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
}

export function analyzeImageContrast(frame) {
  const w = frame.width, h = frame.height;
  const ctx = frame.getContext('2d');
  const sample = ctx.getImageData(0, 0, w, h);
  const gray = grayFromImageData(sample.data, w * h);
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const mean = sum / gray.length;
  let variance = 0;
  for (let i = 0; i < gray.length; i++) variance += (gray[i] - mean) ** 2;
  return { mean, std: Math.sqrt(variance / gray.length) };
}

export function makeMrzBand(frame, y0, y1, mode, wide = true) {
  const w = frame.width, h = frame.height;
  const side = wide ? 0.02 : 0.07;
  const sx = Math.floor(w * side);
  const sw = Math.floor(w * (1 - side * 2));
  const sy = Math.floor(h * y0);
  const sh = Math.max(12, Math.floor(h * (y1 - y0)));
  const scale = Math.min(3.0, Math.max(2.0, 2400 / sw));
  const cw = Math.floor(sw * scale);
  const ch = Math.floor(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, cw, ch);

  const img = ctx.getImageData(0, 0, cw, ch);
  const d = img.data, n = cw * ch;
  const gray = grayFromImageData(d, n);
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) hist[gray[i]]++;
  const thr = otsuThreshold(hist, n);

  if (mode === 'contrast') {
    writeGrayToCanvas(ctx, stretchGrayContrast(gray, n), cw, ch, false, false);
  } else if (mode === 'sharp') {
    writeGrayToCanvas(ctx, stretchGrayContrast(sharpenGray(gray, cw, ch), n), cw, ch, false, false);
  } else if (mode === 'adaptive') {
    writeGrayToCanvas(ctx, adaptiveMeanThreshold(stretchGrayContrast(gray, n), cw, ch, 31, 12), cw, ch, false, false);
  } else if (mode === 'stretch_otsu') {
    const stretched = stretchGrayContrast(gray, n);
    for (let i = 0; i < n; i++) stretched[i] = stretched[i] > thr ? 255 : 0;
    writeGrayToCanvas(ctx, stretched, cw, ch, false, false);
  } else {
    const bin = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin[i] = gray[i] > thr ? 255 : 0;
    writeGrayToCanvas(ctx, bin, cw, ch, false, mode === 'invert');
  }
  return canvas;
}

export function makeVizBand(frame, y0, y1, mode = 'contrast') {
  const w = frame.width, h = frame.height;
  const sx = Math.floor(w * 0.03);
  const sy = Math.floor(h * y0);
  const sw = Math.floor(w * 0.94);
  const sh = Math.max(8, Math.floor(h * (y1 - y0)));
  const scale = Math.min(2.4, Math.max(1.3, 1280 / sw));
  const cw = Math.floor(sw * scale);
  const ch = Math.floor(sh * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(frame, sx, sy, sw, sh, 0, 0, cw, ch);

  const img = ctx.getImageData(0, 0, cw, ch);
  const n = cw * ch;
  const gray = grayFromImageData(img.data, n);
  if (mode === 'contrast') {
    writeGrayToCanvas(ctx, stretchGrayContrast(gray, n), cw, ch, false, false);
  } else {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < n; i++) hist[gray[i]]++;
    const thr = otsuThreshold(hist, n);
    const bin = new Uint8Array(n);
    for (let i = 0; i < n; i++) bin[i] = gray[i] > thr ? 255 : 0;
    writeGrayToCanvas(ctx, bin, cw, ch, false, false);
  }
  return canvas;
}

export function resizeFrame(frame, maxWidth = 2400) {
  if (frame.width <= maxWidth) return frame;
  const scale = maxWidth / frame.width;
  const c = document.createElement('canvas');
  c.width = maxWidth;
  c.height = Math.floor(frame.height * scale);
  c.getContext('2d').drawImage(frame, 0, 0, c.width, c.height);
  return c;
}
