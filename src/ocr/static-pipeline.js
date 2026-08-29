import { makeMrzBand, makeVizBand } from './preprocess.js';
import { ocrCanvas, ensureWorker } from './tesseract-client.js';
import {
  collectTd3Candidates, pickBestMrz, MRZ_CHARS
} from '../mrz/parse.js';
import { parseVIZ, mergeMrzAndViz, natLabel } from '../viz/parse-visual.js';
import { NAT } from '../lib/constants.js';
import { looksLikeName } from '../lib/dates.js';

// Mesmos 7 jobs do monólito que funcionava (MRZ_JOBS_GALLERY)
const STATIC_MRZ_JOBS = [
  { y0: 0.55, y1: 0.99, mode: 'sharp', psms: ['6', '13'], wide: true },
  { y0: 0.68, y1: 0.99, mode: 'contrast', psms: ['6', '11'], wide: true },
  { y0: 0.73, y1: 0.93, mode: 'sharp', psms: ['6', '13'], wide: true },
  { y0: 0.70, y1: 0.96, mode: 'otsu', psms: ['6', '7'], wide: true },
  { y0: 0.62, y1: 1.0, mode: 'invert', psms: ['7', '13'], wide: true },
  { y0: 0.73, y1: 0.93, mode: 'adaptive', psms: ['6'], wide: true },
  { y0: 0.50, y1: 1.0, mode: 'stretch_otsu', psms: ['13'], wide: true }
];

function considerText(text, pool) {
  const list = collectTd3Candidates(text);
  pool.push(...list);
  return pool;
}

function hasUsableMrz(mrz) {
  if (!mrz) return false;
  return !!(
    (mrz.apellidoNombre && mrz.apellidoNombre.trim()) ||
    (mrz.documento && mrz.documento.length >= 5)
  );
}

async function readMrzFromStatic(frame, onStatus) {
  await ensureWorker(onStatus);
  const jobs = STATIC_MRZ_JOBS;
  const pool = [];

  for (let ji = 0; ji < jobs.length; ji++) {
    const job = jobs[ji];
    onStatus?.(`Lendo MRZ (${ji + 1}/${jobs.length}, ${job.mode})…`);
    const best = pickBestMrz(pool);
    if (best?.score >= 82 && best.docCheckOk && best.birthCheckOk && best.compositeOk && looksLikeName(best.apellidoNombre)) {
      return best;
    }
    for (const psm of job.psms) {
      const band = makeMrzBand(frame, job.y0, job.y1, job.mode, job.wide);
      const text = await ocrCanvas(band, psm, MRZ_CHARS);
      considerText(text, pool);
      const candidate = pickBestMrz(pool);
      if (candidate?.docCheckOk && candidate?.birthCheckOk && candidate?.compositeOk) {
        return candidate;
      }
    }
  }
  return pickBestMrz(pool);
}

async function readVizFromStatic(frame, onStatus) {
  const vizChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789ÑñÁÉÍÓÚáéíóúÃÕãõÇç /.-:';
  onStatus?.('Lendo nome, data e nacionalidade impressos na página…');
  let band = makeVizBand(frame, 0.02, 0.82, 'contrast');
  let text = await ocrCanvas(band, '4', vizChars);
  if (!text || text.replace(/\s/g, '').length <= 20) {
    onStatus?.('Tentando outro contraste na zona visual…');
    band = makeVizBand(frame, 0.02, 0.86, 'otsu');
    text = await ocrCanvas(band, '6', vizChars);
  }
  return text || '';
}

export async function readPassportFromStaticImage(frame, onStatus) {
  onStatus?.('Analisando foto completa do passaporte…');
  const mrz = await readMrzFromStatic(frame, onStatus);
  if (!hasUsableMrz(mrz)) return null;

  if ((mrz.score || 0) < 40) {
    mrz.checks = mrz.checks || [];
    mrz.checks.unshift('Leitura parcial — confira todos os campos no passaporte.');
  }

  onStatus?.(`MRZ: ${natLabel(mrz.nacionalidadCode, mrz.nacionalidad) || 'nacionalidad pendente'}. Conferindo texto impresso…`);

  try {
    const vizText = await readVizFromStatic(frame, onStatus);
    const viz = parseVIZ(vizText, mrz);
    const merged = mergeMrzAndViz(mrz, viz);
    if (merged) {
      onStatus?.(`Nacionalidad: ${natLabel(merged.nacionalidadCode, merged.nacionalidad) || 'confira no passaporte'}`);
    }
    return merged;
  } catch {
    mrz.nacionalidad = NAT[mrz.nacionalidadCode] || mrz.nacionalidad || '';
    mrz.checks = mrz.checks || [];
    mrz.checks.push(`A página não pôde ser lida; nacionalidad veio da MRZ: ${natLabel(mrz.nacionalidadCode, mrz.nacionalidad) || '—'}.`);
    return mrz;
  }
}

export async function readMrzFromText(raw) {
  const list = collectTd3Candidates(raw);
  return list.length ? list[0] : null;
}
