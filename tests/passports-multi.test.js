import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  parseTD3, extractMRZFromText, isAutoApplyReady,
  isGarbageMrz, isGarbageName, pickBestMrz, collectTd3Candidates
} from '../src/mrz/parse.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(resolve(__dir, 'fixtures/passports.json'), 'utf8'));

describe('Passaportes multi-país TD3', () => {
  for (const fp of fixtures) {
    it(`parseia ${fp.id} (${fp.country})`, () => {
      const parsed = parseTD3(fp.line1, fp.line2);
      if (fp.expected.isGarbageMrz) {
        expect(isGarbageMrz(parsed)).toBe(true);
        return;
      }
      expect(parsed).not.toBeNull();
      expect(parsed.documento).toBe(fp.expected.documento);
      expect(parsed.nacimiento).toBe(fp.expected.nacimiento);
      expect(parsed.nacionalidadCode).toBe(fp.expected.nacionalidadCode);
      expect(parsed.apellidoNombre).toBe(fp.expected.apellidoNombre);
      if (fp.expected.autoApply) {
        expect(isAutoApplyReady(parsed)).toBe(true);
      }
    });
  }

  it('extrai MRZ limpa de texto OCR', () => {
    const fp = fixtures.find(f => f.id === 'bra-nicolas');
    const best = extractMRZFromText(`${fp.line1}\n${fp.line2}`);
    expect(best.documento).toBe('F0962540');
    expect(best.nacimiento).toBe('1999-07-15');
  });

  it('rejeita lixo VIZ como MRZ (caso Nicolas)', () => {
    const fp = fixtures.find(f => f.id === 'garbage-viz-as-mrz');
    const parsed = parseTD3(fp.line1, fp.line2);
    expect(isGarbageMrz(parsed)).toBe(true);
    expect(isGarbageName(parsed.apellidoNombre)).toBe(true);
  });

  it('pickBestMrz prefere checksums válidos', () => {
    const fp = fixtures.find(f => f.id === 'bra-nicolas');
    const good = parseTD3(fp.line1, fp.line2);
    const bad = parseTD3(
      'PREQUBYR<AVT<LUT<GOAGEETUA<CTEORR<R<DATORDAD',
      'E<ATHORTYNECABBEXDECZ2015SCDPE<FIG<PRBC<CL<E'
    );
    expect(pickBestMrz([bad, good]).documento).toBe('F0962540');
  });
});

describe('Nicolas BRA fixture real', () => {
  it('MRZ real do passaporte Nicolas', () => {
    const raw = readFileSync(resolve(__dir, 'fixtures/real/nicolas-bra.json'), 'utf8');
    const fx = JSON.parse(raw);
    const parsed = parseTD3(fx.mrz.line1, fx.mrz.line2);
    expect(parsed.documento).toBe(fx.expected.documento);
    expect(parsed.nacimiento).toBe(fx.expected.nacimiento);
    expect(parsed.nacionalidadCode).toBe(fx.expected.nacionalidadCode);
    expect(parsed.apellidoNombre).toBe(fx.expected.apellidoNombre);
    expect(isAutoApplyReady(parsed)).toBe(true);
  });
});
