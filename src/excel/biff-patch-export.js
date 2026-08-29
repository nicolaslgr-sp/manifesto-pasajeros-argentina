import * as XLSXModule from 'xlsx';

const XLSX = XLSXModule.default || XLSXModule;

const RT = { CONT: 0x003c, EOF: 0x000a, SST: 0x00fc, LABELSST: 0x00fd };

function r16(b, o) { return b[o] | (b[o + 1] << 8); }
function r32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
function w16(b, o, v) { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; }
function w32(b, o, v) {
  b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = (v >> 24) & 255;
}

function readUniStr(data, o) {
  let cch = r16(data, o); o += 2;
  const flags = data[o]; o += 1;
  if (flags & 8) o += 2;
  if (flags & 4) o += 4;
  const wide = flags & 1;
  let s = '';
  if (wide) {
    for (let i = 0; i < cch; i++) { s += String.fromCharCode(r16(data, o)); o += 2; }
  } else {
    for (let j = 0; j < cch; j++) s += String.fromCharCode(data[o + j]);
    o += cch;
  }
  return { s, o };
}

function writeUniStr(str) {
  const out = new Uint8Array(3 + str.length * 2);
  w16(out, 0, str.length);
  out[2] = 1;
  for (let i = 0; i < str.length; i++) w16(out, 3 + i * 2, str.charCodeAt(i));
  return out;
}

function mergeRecords(bytes, start, end) {
  const list = [];
  let pos = start;
  let cur = null;
  end = end == null ? bytes.length : end;
  while (pos + 4 <= end) {
    const rt = r16(bytes, pos);
    const rl = r16(bytes, pos + 2);
    const slice = bytes.subarray(pos + 4, pos + 4 + rl);
    pos += 4 + rl;
    if (rt === RT.CONT && cur) {
      const m = new Uint8Array(cur.data.length + slice.length);
      m.set(cur.data, 0);
      m.set(slice, cur.data.length);
      cur.data = m;
      cur.rl = m.length;
    } else {
      if (cur) list.push(cur);
      cur = { rt, rl, data: slice, pos: pos - 4 - rl, end: pos };
      if (rt === RT.EOF) break;
    }
  }
  if (cur && cur.rt !== RT.EOF) list.push(cur);
  return list;
}

function locateSSTBlock(bytes) {
  const recs = mergeRecords(bytes, 0, bytes.length);
  for (let i = 0; i < recs.length; i++) {
    if (recs[i].rt === RT.SST) {
      let start = recs[i].pos;
      let end = recs[i].end;
      for (let j = i + 1; j < recs.length; j++) {
        if (recs[j].pos === end && recs[j].rt === RT.CONT) end = recs[j].end;
        else break;
      }
      const total = r32(recs[i].data, 0);
      const strings = [];
      let o = 8;
      const unique = r32(recs[i].data, 4);
      for (let u = 0; u < unique; u++) {
        const p = readUniStr(recs[i].data, o);
        strings.push(p.s);
        o = p.o;
      }
      return { start, end, total, strings };
    }
  }
  throw new Error('SST not found');
}

function buildSSTBlock(total, strings) {
  const payloadParts = [new Uint8Array(8)];
  w32(payloadParts[0], 0, total);
  w32(payloadParts[0], 4, strings.length);
  let payLen = 8;
  for (const s of strings) {
    payloadParts.push(writeUniStr(s));
    payLen += payloadParts[payloadParts.length - 1].length;
  }
  const payload = new Uint8Array(payLen);
  let o = 0;
  for (const part of payloadParts) {
    payload.set(part, o);
    o += part.length;
  }
  const MAX = 8224;
  const blocks = [];
  let p = 0;
  let first = true;
  while (p < payload.length) {
    const chunk = payload.subarray(p, p + MAX);
    const rec = new Uint8Array(4 + chunk.length);
    w16(rec, 0, first ? RT.SST : RT.CONT);
    w16(rec, 2, chunk.length);
    rec.set(chunk, 4);
    blocks.push(rec);
    p += chunk.length;
    first = false;
  }
  return blocks;
}

function concatParts(parts) {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function boundSheetOffsets(bytes) {
  const recs = mergeRecords(bytes, 0, bytes.length);
  const bounds = [];
  for (const rec of recs) {
    if (rec.rt === 0x0085 && rec.data.length >= 4) {
      bounds.push({ off: r32(rec.data, 0), pos: rec.pos + 4 });
    }
  }
  bounds.sort((a, b) => a.off - b.off);
  return bounds;
}

function cellTableEnd(bytes, sheetStart, sheetEnd) {
  const recs = mergeRecords(bytes, sheetStart, sheetEnd);
  let end = sheetStart;
  for (const rec of recs) {
    const rt = rec.rt;
    if (rt === RT.LABELSST || rt === 0x00be || rt === 0x0201 || rt === 0x0203 || rt === 0x027e || rt === 0x0204) {
      end = rec.pos + 4 + rec.rl;
    }
  }
  return end;
}

function shiftBoundsAfter(bytes, threshold, delta) {
  for (const b of boundSheetOffsets(bytes)) {
    if (b.off >= threshold) w32(bytes, b.pos, b.off + delta);
  }
}

function encodeLabelSst(row, col, xf, isst) {
  const rec = new Uint8Array(14);
  w16(rec, 0, RT.LABELSST);
  w16(rec, 2, 10);
  w16(rec, 4, row);
  w16(rec, 6, col);
  w16(rec, 8, xf);
  w32(rec, 10, isst);
  return rec;
}

export function patchTemplateArrayBuffer(templateBuf, assignments) {
  const CFB = XLSX.CFB;
  const cfb = CFB.read(templateBuf, { type: 'array' });
  const entry = CFB.find(cfb, '/Workbook');
  if (!entry?.content) throw new Error('Workbook missing');
  const wb = new Uint8Array(entry.content);

  const sstBlock = locateSSTBlock(wb);
  const strings = sstBlock.strings.slice();
  let total = sstBlock.total;
  const isstFor = {};

  for (const [key, val] of Object.entries(assignments)) {
    if (val == null || val === '') continue;
    const s = String(val);
    let idx = strings.indexOf(s);
    if (idx < 0) { idx = strings.length; strings.push(s); total += 1; }
    isstFor[key] = idx;
  }

  const parts = [wb.subarray(0, sstBlock.start)];
  for (const block of buildSSTBlock(total, strings)) parts.push(block);
  parts.push(wb.subarray(sstBlock.end));
  const patched = concatParts(parts);
  const delta = patched.length - wb.length;
  shiftBoundsAfter(patched, sstBlock.end, delta);

  const bounds = boundSheetOffsets(patched);
  const sheetOff = bounds.length ? bounds[0].off : 0;
  const sheetRecs = mergeRecords(patched, sheetOff, patched.length);
  const existing = {};
  const append = [];

  for (const rec of sheetRecs) {
    if (rec.rt === RT.LABELSST && rec.data.length >= 10) {
      const row = r16(rec.data, 0);
      const col = r16(rec.data, 2);
      existing[`${row},${col}`] = { xf: r16(rec.data, 4) };
    }
  }

  for (const [key, isst] of Object.entries(isstFor)) {
    const [row, col] = key.split(',').map(Number);
    if (existing[key]) {
      for (const r2 of sheetRecs) {
        if (r2.rt !== RT.LABELSST) continue;
        if (r16(r2.data, 0) === row && r16(r2.data, 2) === col) {
          w32(patched, r2.pos + 10, isst);
        }
      }
    } else {
      append.push(encodeLabelSst(row, col, 167, isst));
    }
  }

  if (!append.length) {
    CFB.utils.cfb_add(cfb, '/Workbook', patched);
    return CFB.write(cfb, { type: 'array', compression: true });
  }

  const bounds2 = boundSheetOffsets(patched);
  const sheetEnd = bounds2.length > 1 ? bounds2[1].off : patched.length;
  const insertAt = cellTableEnd(patched, sheetOff, sheetEnd);
  const finalParts = [patched.subarray(0, insertAt), ...append, patched.subarray(insertAt)];
  const finalWb = concatParts(finalParts);
  const appendDelta = append.reduce((a, r) => a + r.length, 0);
  shiftBoundsAfter(finalWb, insertAt, appendDelta);

  CFB.utils.cfb_add(cfb, '/Workbook', finalWb);
  return CFB.write(cfb, { type: 'array', compression: true });
}

export default { patchTemplateArrayBuffer };
