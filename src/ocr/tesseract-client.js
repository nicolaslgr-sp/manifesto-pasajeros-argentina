import { createWorker } from 'tesseract.js';
import { MRZ_CHARS } from '../mrz/parse.js';

const TESS_VERSION = '5.1.1';
const CORE_VERSION = '5.1.1';
const WORKER_TIMEOUT_MS = 90_000;

let worker = null;
let workerPromise = null;

function isBrowser() {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/** Paths absolutos via CDN — não dependem do Vite `base` (GitHub Pages). */
function browserWorkerOptions(onStatus) {
  return {
    workerPath: `https://cdn.jsdelivr.net/npm/tesseract.js@${TESS_VERSION}/dist/worker.min.js`,
    // Non-SIMD: mais compatível em Android mid-range / Safari
    corePath: `https://cdn.jsdelivr.net/npm/tesseract.js-core@${CORE_VERSION}/tesseract-core.wasm.js`,
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    logger: m => {
      if (m?.status === 'loading tesseract core') {
        onStatus?.('Baixando motor OCR…');
      } else if (m?.status === 'initializing tesseract' || m?.status === 'loading language traineddata') {
        onStatus?.('Preparando motor de leitura…');
      }
    }
  };
}

export function ensureWorker(onStatus) {
  if (worker) return Promise.resolve(worker);
  if (workerPromise) return workerPromise;

  onStatus?.('Carregando motor de leitura (só na primeira vez)…');

  const create = isBrowser()
    ? createWorker('eng', 1, browserWorkerOptions(onStatus))
    : createWorker('eng', 1, { logger: () => {} });

  const withTimeout = Promise.race([
    create.then(async w => {
      worker = w;
      await w.setParameters({
        user_defined_dpi: '300',
        preserve_interword_spaces: '0',
        tessedit_write_images: '0'
      });
      return w;
    }),
    new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(
          'Motor OCR não carregou (timeout). Verifique a conexão, recarregue a página e tente de novo.'
        ));
      }, WORKER_TIMEOUT_MS);
    })
  ]);

  workerPromise = withTimeout.catch(err => {
    worker = null;
    workerPromise = null;
    throw err;
  });

  return workerPromise;
}

export async function ocrCanvas(canvas, psm, whitelist = MRZ_CHARS) {
  const w = await ensureWorker();
  await w.setParameters({
    tessedit_pageseg_mode: String(psm),
    tessedit_char_whitelist: whitelist
  });
  // node-canvas: Buffer PNG. Browser: canvas element (Tesseract.js HTMLCanvas path).
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
  } else if (workerPromise) {
    try {
      const w = await workerPromise;
      await w.terminate();
    } catch {
      /* ignore */
    }
    worker = null;
    workerPromise = null;
  }
}
