#!/usr/bin/env node
/**
 * Gate OCR real: Tesseract na foto Nicolas (BRA F0962540).
 * Sem texto simulado. Critério: 4/4 campos corretos.
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage, Image } from 'canvas';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');

const fixture = JSON.parse(
  readFileSync(resolve(root, 'tests/fixtures/real/nicolas-bra.json'), 'utf8')
);
const imagePath = resolve(root, 'tests/fixtures/real/nicolas-bra.jpg');

// NÃO definir global.document — isso faz o Tesseract achar que é browser.
// Canvas via factory Node:
globalThis.__nodeCreateCanvas = (w, h) => createCanvas(w, h);
globalThis.Image = Image;

const { resizeFrame } = await import('../src/ocr/preprocess.js');
const { readPassportFromStaticImage } = await import('../src/ocr/static-pipeline.js');
const { terminateWorker } = await import('../src/ocr/tesseract-client.js');

async function main() {
  console.log('=== OCR real Tesseract — foto Nicolas BRA ===\n');
  console.log('Imagem:', imagePath);

  const img = await loadImage(imagePath);
  const canvas = createCanvas(img.width, img.height);
  canvas.getContext('2d').drawImage(img, 0, 0);
  const frame = resizeFrame(canvas);
  console.log(`Frame: ${frame.width}x${frame.height}\n`);

  const t0 = Date.now();
  const out = await readPassportFromStaticImage(frame, msg => console.log(' ', msg), { debugDump: true });
  await terminateWorker();
  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\nConcluído em ${elapsed}s\n`);

  const result = out && typeof out === 'object' && 'result' in out ? out.result : out;
  const dumps = out?.dumps || [];

  if (!result) {
    console.error('FALHOU: pipeline retornou null\n');
    console.error('--- Dump OCR (últimas faixas) ---');
    for (const d of dumps.slice(-12)) {
      console.error(`[${d.kind}] y0=${d.y0} ${d.mode} psm=${d.psm || ''}`);
      console.error((d.text || '').replace(/\n/g, ' | ').slice(0, 180));
      console.error('');
    }
    process.exit(1);
  }

  const exp = fixture.expected;
  const nameOk = String(result.apellidoNombre || '').toUpperCase().includes('LOZANO')
    && String(result.apellidoNombre || '').toUpperCase().includes('NICOLAS');
  const checks = [
    ['documento', String(result.documento || '').toUpperCase() === exp.documento, result.documento, exp.documento],
    ['nacimiento', result.nacimiento === exp.nacimiento, result.nacimiento, exp.nacimiento],
    ['nacionalidadCode', result.nacionalidadCode === exp.nacionalidadCode, result.nacionalidadCode, exp.nacionalidadCode],
    ['apellidoNombre', nameOk, result.apellidoNombre, exp.apellidoNombre]
  ];

  let ok = 0;
  for (const [field, pass, got, want] of checks) {
    console.log(`${pass ? '✓' : '✗'} ${field}: ${got}${pass ? '' : ` (esperado: ${want})`}`);
    if (pass) ok++;
  }

  if (result.fromVizOnly) console.log('\n  (via VIZ — MRZ ilegível)');
  if (result.checks?.length) console.log('  Notas:', result.checks.join(' '));

  if (ok < 4) {
    console.error('\n--- Dump OCR ---');
    for (const d of dumps.slice(-10)) {
      console.error(`[${d.kind}] y0=${d.y0} ${d.mode}`);
      console.error((d.text || '').replace(/\n/g, ' | ').slice(0, 200));
    }
  }

  console.log(`\n${ok}/4 campos corretos`);
  if (ok === 4) {
    console.log('SUCESSO: OCR real 4/4');
    process.exit(0);
  }
  console.error('FALHOU: gate 4/4');
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
