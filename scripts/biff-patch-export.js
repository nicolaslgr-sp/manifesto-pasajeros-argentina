/**
 * Minimal BIFF8 patcher: SST splice + in-place LabelSst patch + append new LabelSst before EOF.
 */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory(require('cfb'));
  } else {
    root.BiffPatchExport = factory(root.CFB || (typeof XLSX !== 'undefined' ? XLSX.CFB : null));
  }
})(typeof self !== 'undefined' ? self : this, function (CFB) {
  'use strict';

  var RT = { CONT: 0x003c, EOF: 0x000a, SST: 0x00fc, LABELSST: 0x00fd };

  function r16(b, o) { return b[o] | (b[o + 1] << 8); }
  function r32(b, o) { return (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; }
  function w16(b, o, v) { b[o] = v & 255; b[o + 1] = (v >> 8) & 255; }
  function w32(b, o, v) {
    b[o] = v & 255; b[o + 1] = (v >> 8) & 255; b[o + 2] = (v >> 16) & 255; b[o + 3] = (v >> 24) & 255;
  }

  function readUniStr(data, o) {
    var cch = r16(data, o); o += 2;
    var flags = data[o]; o += 1;
    if (flags & 8) o += 2;
    if (flags & 4) o += 4;
    var wide = flags & 1;
    var s = '';
    if (wide) {
      for (var i = 0; i < cch; i++) { s += String.fromCharCode(r16(data, o)); o += 2; }
    } else {
      for (var j = 0; j < cch; j++) s += String.fromCharCode(data[o + j]);
      o += cch;
    }
    return { s: s, o: o };
  }

  function writeUniStr(str) {
    var out = new Uint8Array(3 + str.length * 2);
    w16(out, 0, str.length);
    out[2] = 1;
    for (var i = 0; i < str.length; i++) w16(out, 3 + i * 2, str.charCodeAt(i));
    return out;
  }

  function mergeRecords(bytes, start, end) {
    var list = [], pos = start, cur = null;
    end = end == null ? bytes.length : end;
    while (pos + 4 <= end) {
      var rt = r16(bytes, pos), rl = r16(bytes, pos + 2);
      var slice = bytes.subarray(pos + 4, pos + 4 + rl);
      pos += 4 + rl;
      if (rt === RT.CONT && cur) {
        var m = new Uint8Array(cur.data.length + slice.length);
        m.set(cur.data, 0); m.set(slice, cur.data.length);
        cur.data = m; cur.rl = m.length;
      } else {
        if (cur) list.push(cur);
        cur = { rt: rt, rl: rl, data: slice, pos: pos - 4 - rl, end: pos };
        if (rt === RT.EOF) break;
      }
    }
    if (cur && cur.rt !== RT.EOF) list.push(cur);
    return list;
  }

  function locateSSTBlock(bytes) {
    var recs = mergeRecords(bytes, 0, bytes.length);
    for (var i = 0; i < recs.length; i++) {
      if (recs[i].rt === RT.SST) {
        var start = recs[i].pos, end = recs[i].end;
        for (var j = i + 1; j < recs.length; j++) {
          if (recs[j].pos === end && recs[j].rt === RT.CONT) end = recs[j].end;
          else break;
        }
        var total = r32(recs[i].data, 0), unique = r32(recs[i].data, 4);
        var strings = [], o = 8;
        for (var u = 0; u < unique; u++) {
          var p = readUniStr(recs[i].data, o);
          strings.push(p.s);
          o = p.o;
        }
        return { start: start, end: end, total: total, strings: strings };
      }
    }
    throw new Error('SST not found');
  }

  function buildSSTBlock(total, strings) {
    var payloadParts = [new Uint8Array(8)];
    w32(payloadParts[0], 0, total);
    w32(payloadParts[0], 4, strings.length);
    var payLen = 8;
    for (var i = 0; i < strings.length; i++) {
      payloadParts.push(writeUniStr(strings[i]));
      payLen += payloadParts[payloadParts.length - 1].length;
    }
    var payload = new Uint8Array(payLen);
    var o = 0;
    for (var j = 0; j < payloadParts.length; j++) {
      payload.set(payloadParts[j], o);
      o += payloadParts[j].length;
    }
    var MAX = 8224, blocks = [], p = 0, first = true;
    while (p < payload.length) {
      var chunk = payload.subarray(p, p + MAX);
      var rec = new Uint8Array(4 + chunk.length);
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
    var len = 0;
    for (var i = 0; i < parts.length; i++) len += parts[i].length;
    var out = new Uint8Array(len);
    var o = 0;
    for (var j = 0; j < parts.length; j++) {
      out.set(parts[j], o);
      o += parts[j].length;
    }
    return out;
  }

  function boundSheetOffsets(bytes) {
    var recs = mergeRecords(bytes, 0, bytes.length);
    var bounds = [];
    for (var i = 0; i < recs.length; i++) {
      if (recs[i].rt === 0x0085 && recs[i].data.length >= 4) {
        bounds.push({ off: r32(recs[i].data, 0), pos: recs[i].pos + 4 });
      }
    }
    bounds.sort(function (a, b) { return a.off - b.off; });
    return bounds;
  }

  function cellTableEnd(bytes, sheetStart, sheetEnd) {
    var recs = mergeRecords(bytes, sheetStart, sheetEnd);
    var end = sheetStart;
    for (var i = 0; i < recs.length; i++) {
      var rt = recs[i].rt;
      if (rt === RT.LABELSST || rt === 0x00be || rt === 0x0201 || rt === 0x0203 || rt === 0x027e || rt === 0x0204) {
        end = recs[i].pos + 4 + recs[i].rl;
      }
    }
    return end;
  }

  function shiftBoundsAfter(bytes, threshold, delta) {
    var bounds = boundSheetOffsets(bytes);
    for (var i = 0; i < bounds.length; i++) {
      if (bounds[i].off >= threshold) w32(bytes, bounds[i].pos, bounds[i].off + delta);
    }
  }

  function encodeLabelSst(row, col, xf, isst) {
    var rec = new Uint8Array(14);
    w16(rec, 0, RT.LABELSST);
    w16(rec, 2, 10);
    w16(rec, 4, row);
    w16(rec, 6, col);
    w16(rec, 8, xf);
    w32(rec, 10, isst);
    return rec;
  }

  function patchTemplateArrayBuffer(templateBuf, assignments) {
    var cfb = CFB.read(templateBuf, { type: 'array' });
    var entry = CFB.find(cfb, '/Workbook');
    if (!entry || !entry.content) throw new Error('Workbook missing');
    var wb = new Uint8Array(entry.content);

    var sstBlock = locateSSTBlock(wb);
    var strings = sstBlock.strings.slice();
    var total = sstBlock.total;
    var isstFor = {};

    Object.keys(assignments).forEach(function (key) {
      var val = assignments[key];
      if (val == null || val === '') return;
      var s = String(val);
      var idx = strings.indexOf(s);
      if (idx < 0) { idx = strings.length; strings.push(s); total += 1; }
      isstFor[key] = idx;
    });

    var parts = [wb.subarray(0, sstBlock.start)];
    var newSST = buildSSTBlock(total, strings);
    for (var si = 0; si < newSST.length; si++) parts.push(newSST[si]);
    parts.push(wb.subarray(sstBlock.end));
    var patched = concatParts(parts);
    var delta = patched.length - wb.length;

    var recs = mergeRecords(patched, 0, patched.length);
    shiftBoundsAfter(patched, sstBlock.end, delta);

    var bounds = boundSheetOffsets(patched);
    var sheetOff = bounds.length ? bounds[0].off : 0;
    var sheetRecs = mergeRecords(patched, sheetOff, patched.length);
    var existing = {};
    var append = [];

    for (var sr = 0; sr < sheetRecs.length; sr++) {
      var rec = sheetRecs[sr];
      if (rec.rt === RT.LABELSST && rec.data.length >= 10) {
        var row = r16(rec.data, 0), col = r16(rec.data, 2);
        existing[row + ',' + col] = { xf: r16(rec.data, 4) };
      }
    }

    Object.keys(isstFor).forEach(function (key) {
      var p = key.split(',');
      var row = +p[0], col = +p[1];
      if (existing[key]) {
        // patch existing LabelSst isst in place
        for (var sr2 = 0; sr2 < sheetRecs.length; sr2++) {
          var r2 = sheetRecs[sr2];
          if (r2.rt !== RT.LABELSST) continue;
          if (r16(r2.data, 0) === row && r16(r2.data, 2) === col) {
            w32(patched, r2.pos + 10, isstFor[key]);
          }
        }
      } else {
        append.push(encodeLabelSst(row, col, 167, isstFor[key]));
      }
    });

    if (!append.length) {
      CFB.utils.cfb_add(cfb, '/Workbook', patched);
      return CFB.write(cfb, { type: 'array', compression: true });
    }

    var bounds2 = boundSheetOffsets(patched);
    var sheetEnd = bounds2.length > 1 ? bounds2[1].off : patched.length;
    var insertAt = cellTableEnd(patched, sheetOff, sheetEnd);
    var finalParts = [patched.subarray(0, insertAt)];
    for (var ai = 0; ai < append.length; ai++) finalParts.push(append[ai]);
    finalParts.push(patched.subarray(insertAt));
    var finalWb = concatParts(finalParts);
    var appendDelta = 0;
    for (var ad = 0; ad < append.length; ad++) appendDelta += append[ad].length;
    shiftBoundsAfter(finalWb, insertAt, appendDelta);

    CFB.utils.cfb_add(cfb, '/Workbook', finalWb);
    return CFB.write(cfb, { type: 'array', compression: true });
  }

  return { patchTemplateArrayBuffer: patchTemplateArrayBuffer };
});
