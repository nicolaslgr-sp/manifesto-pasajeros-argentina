#!/usr/bin/env node
/**
 * Gate OCR no browser: Playwright Chromium desktop + Pixel 7.
 * Upload tests/fixtures/real/nicolas-bra.jpg → espera F0962540 + 1999-07-15.
 */
import { spawn } from 'child_process';
import { createServer } from 'net';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { chromium, devices } from 'playwright';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dir, '..');
const fixtureJpg = resolve(root, 'tests/fixtures/real/nicolas-bra.jpg');
const BASE = '/manifesto-pasajeros-argentina/';

function freePort() {
  return new Promise((resolvePort, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address();
      s.close(() => resolvePort(port));
    });
    s.on('error', reject);
  });
}

function waitHttp(url, ms = 60_000) {
  const t0 = Date.now();
  return (async () => {
    while (Date.now() - t0 < ms) {
      try {
        const r = await fetch(url, { redirect: 'follow' });
        if (r.status >= 200 && r.status < 500) return;
      } catch {
        /* retry */
      }
      await new Promise(r => setTimeout(r, 400));
    }
    throw new Error(`Preview não subiu: ${url}`);
  })();
}

async function runProfile(browser, name, contextOptions, appUrl) {
  console.log(`\n=== ${name} ===`);
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();
  page.setDefaultTimeout(180_000);

  await page.addInitScript(() => { window.__OCR_DEBUG = true; });

  const errors = [];
  const vizLogs = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', msg => {
    const t = msg.text();
    if (msg.type() === 'error') errors.push(t);
    if (t.startsWith('VIZ_DEBUG')) vizLogs.push(t.slice(0, 900));
  });

  await page.goto(appUrl, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.click('#btn-gallery');
  await page.waitForSelector('#scan-panel:not([hidden])');

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#scan-gallery')
  ]);
  await fileChooser.setFiles(fixtureJpg);

  // Auto-apply fecha o painel; parcial abre #scan-confirm
  await Promise.race([
    page.waitForSelector('#scan-panel[hidden], #scan-panel.hidden', { timeout: 180_000 }).catch(() => null),
    page.waitForSelector('#scan-confirm:not([hidden])', { timeout: 180_000 })
  ]);

  // Dar tempo ao applyParsed / render
  await page.waitForTimeout(800);

  const data = await page.evaluate(() => {
    const confirm = document.getElementById('scan-confirm');
    const confirmVisible = confirm && !confirm.hidden && !confirm.classList.contains('hidden');
    if (confirmVisible) {
      return {
        source: 'confirm',
        nombre: document.getElementById('cf-nombre')?.value
          || document.getElementById('cf-nombre')?.textContent || '',
        nacim: document.getElementById('cf-nacim')?.value || '',
        doc: document.getElementById('cf-doc')?.value
          || document.getElementById('cf-doc')?.textContent || '',
        nacio: document.getElementById('cf-nacio')?.value
          || document.getElementById('cf-nacio')?.textContent || ''
      };
    }
    const inputs = [...document.querySelectorAll('[data-field="apellidoNombre"]')];
    const pax = inputs.map(el => {
      const id = el.getAttribute('data-pax');
      const root = el.closest('article') || document;
      return {
        nombre: el.value,
        nacim: root.querySelector(`[data-pax="${id}"][data-field="nacimiento"]`)?.value || '',
        doc: root.querySelector(`[data-pax="${id}"][data-field="documento"]`)?.value || '',
        nacio: root.querySelector(`[data-pax="${id}"][data-field="nacionalidad"]`)?.value || ''
      };
    });
    return { source: 'list', pax, status: document.getElementById('scan-status')?.textContent || '' };
  });

  await context.close();

  let nombre = '';
  let nacim = '';
  let doc = '';
  let nacio = '';

  if (data.source === 'confirm') {
    ({ nombre, nacim, doc, nacio } = data);
  } else {
    const hit = (data.pax || []).find(p =>
      /F0962540/i.test(p.doc) || /LOZANO/i.test(p.nombre)
    ) || data.pax?.[0];
    if (!hit) {
      console.error('FALHOU: nenhum passageiro nem confirmação.', data, errors.slice(0, 5));
      return false;
    }
    ({ nombre, nacim, doc, nacio } = hit);
  }

  const nameOk = /LOZANO/i.test(nombre) && /NICOLAS/i.test(nombre);
  const docOk = /F0962540/i.test(doc);
  const birthOk = nacim === '1999-07-15';
  const natOk = /BRASILE|BRA/i.test(nacio);

  const checks = [
    ['documento', docOk, doc, 'F0962540'],
    ['nacimiento', birthOk, nacim, '1999-07-15'],
    ['nacionalidad', natOk, nacio, 'BRASILEÑA'],
    ['apellidoNombre', nameOk, nombre, 'LOZANO GOMES NICOLAS']
  ];

  let ok = 0;
  for (const [field, pass, got, want] of checks) {
    console.log(`${pass ? '✓' : '✗'} ${field}: ${got}${pass ? '' : ` (esperado: ${want})`}`);
    if (pass) ok++;
  }
  if (errors.length) console.log('  console errors:', errors.slice(0, 3).join(' | '));
  if (ok < 4 && vizLogs.length) {
    console.log('  --- VIZ OCR (browser) ---');
    console.log(vizLogs[vizLogs.length - 1].slice(0, 700));
  }
  return ok === 4;
}

async function main() {
  if (!existsSync(fixtureJpg)) {
    console.error('Fixture ausente:', fixtureJpg);
    process.exit(1);
  }

  const distDev = resolve(root, 'dist/index.dev.html');
  const distIndex = resolve(root, 'dist/index.html');
  if (!existsSync(distDev) && !existsSync(distIndex)) {
    console.error('Rode npm run build antes de test:ocr-browser');
    process.exit(1);
  }
  // Vite entry is index.dev.html — preview precisa de index.html na raiz do base
  if (existsSync(distDev) && !existsSync(distIndex)) {
    const { copyFileSync } = await import('fs');
    copyFileSync(distDev, distIndex);
  }

  const port = await freePort();
  const preview = spawn(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: root, stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
  );

  let previewLog = '';
  preview.stdout.on('data', d => { previewLog += d.toString(); });
  preview.stderr.on('data', d => { previewLog += d.toString(); });

  const appUrl = `http://127.0.0.1:${port}${BASE}`;
  try {
    await waitHttp(appUrl);
  } catch (e) {
    console.error(e.message);
    console.error(previewLog.slice(-800));
    preview.kill();
    process.exit(1);
  }

  console.log('Preview:', appUrl);
  console.log('Fixture:', fixtureJpg);

  const browser = await chromium.launch({ headless: true });
  let allOk = true;

  try {
    const desktopOk = await runProfile(browser, 'Chromium desktop (Chrome Mac/Windows)', {
      viewport: { width: 1280, height: 800 }
    }, appUrl);
    allOk = allOk && desktopOk;

    const pixel = devices['Pixel 7'];
    const mobileOk = await runProfile(browser, 'Chromium Pixel 7 (Chrome Android)', {
      ...pixel
    }, appUrl);
    allOk = allOk && mobileOk;
  } finally {
    await browser.close();
    preview.kill('SIGTERM');
  }

  if (!allOk) {
    console.error('\nGate browser FALHOU');
    process.exit(1);
  }
  console.log('\nGate browser OK — desktop + Pixel 7 (4/4)');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
