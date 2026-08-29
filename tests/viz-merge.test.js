import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parseTD3 } from '../src/mrz/parse.js';
import { parseVIZ, mergeMrzAndViz, buildResultFromViz } from '../src/viz/parse-visual.js';
import { NAT } from '../src/lib/constants.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const fixtures = JSON.parse(readFileSync(resolve(__dir, 'fixtures/passports.json'), 'utf8'));

describe('VIZ parse + merge MRZ', () => {
  for (const fp of fixtures.filter(f => f.vizText && !f.expected.isGarbageMrz)) {
    it(`merge ${fp.id}`, () => {
      const mrz = parseTD3(fp.line1, fp.line2);
      const viz = parseVIZ(fp.vizText, mrz);
      const merged = mergeMrzAndViz(mrz, viz);
      expect(merged.documento).toBe(fp.expected.documento);
      expect(merged.nacimiento).toBe(fp.expected.nacimiento);
      expect(merged.nacionalidadCode).toBe(fp.expected.nacionalidadCode);
    });
  }

  it('VIZ-only fallback para lixo MRZ (caso Nicolas)', () => {
    const fp = fixtures.find(f => f.id === 'garbage-viz-as-mrz');
    const viz = parseVIZ(fp.vizText, null);
    expect(viz.documento).toBe('F0962540');
    expect(viz.nacimiento).toBe('1999-07-15');
    expect(viz.nacionalidadCode).toBe('BRA');
    expect(viz.apellidoNombre).toContain('LOZANO');
    const result = buildResultFromViz(viz);
    expect(result).not.toBeNull();
    expect(result.fromVizOnly).toBe(true);
    expect(result.documento).toBe('F0962540');
    expect(result.nacionalidad).toBe(NAT.BRA);
  });

  it('parseVIZ lê BRASILEIRO(A)', () => {
    const viz = parseVIZ('NACIONALIDADE BRASILEIRO(A)\nSOBRENOME SILVA\nNOME JOAO', null);
    expect(viz.nacionalidadCode).toBe('BRA');
  });

  it('parseVIZ lê data JUL/JUL', () => {
    const viz = parseVIZ('DATA DO NASCIMENTO 15 JUL/JUL 1999\nSOBRENOME LOZANO GOMES\nNOME NICOLAS', null);
    expect(viz.nacimiento).toBe('1999-07-15');
  });

  it('parseVIZ lê PASSAPORTE N com FO→F0', () => {
    const viz = parseVIZ('PASSAPORTE N FO962540\nSOBRENOME LOZANO GOMES\nNOME NICOLAS', null);
    expect(viz.documento).toBe('F0962540');
  });
});
