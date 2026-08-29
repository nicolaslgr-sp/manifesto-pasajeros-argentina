import { createWorker } from 'tesseract.js';
import { MRZ_CHARS } from '../mrz/parse.js';

let worker = null;
let workerPromise = null;

export function ensureWorker(onStatus) {
  if (worker) return Promise.resolve(worker);
  if (workerPromise) return workerPromise;
  onStatus?.('Carregando motor de leitura (só na primeira vez)…');
  // Browser: defaults do Tesseract. Node (test script): também defaults via worker/node.
  workerPromise = createWorker('eng', 1, {
    logger: () => {}
  }).then(async w => {
    worker = w;
    await w.setParameters({
      user_defined_dpi: '300',
      preserve_interword_spaces: '0',
      tessedit_write_images: '0'
    });
    return w;
  });
  return workerPromise;
}

export async function ocrCanvas(canvas, psm, whitelist = MRZ_CHARS) {
  const w = await ensureWorker();
  await w.setParameters({
    tessedit_pageseg_mode: String(psm),
    tessedit_char_whitelist: whitelist
  });
  // node-canvas: Tesseract precisa de Buffer/PNG
  let input = canvas;
  if (typeof canvas.toBuffer === 'function') {
    input = canvas.toBuffer('image/png');
  }
  const res = await w.recognize(input);
  return (res?.data?.text) || '';
}

export async function terminateWorker() {
  if (worker) {
    await worker.terminate();
    worker = null;
    workerPromise = null;
  }
}
