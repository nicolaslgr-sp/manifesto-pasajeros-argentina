import { describe, it, expect } from 'vitest';
import { extractMRZFromText, collectTd3Candidates } from '../src/mrz/parse.js';
import { buildLine1, buildLine2 } from './helpers/build-mrz.js';

const L1 = buildLine1('BRA', 'LOZANO<GOMES', 'NICOLAS');
const L2 = buildLine2('F0962540', 'BRA', '990715', 'M', '201217');

describe('OCR ruidoso MRZ', () => {
  it('tolera O/0 em doc', () => {
    const noisyL2 = L2.replace('F0962540', 'F096254O');
    const best = extractMRZFromText(`${L1}\n${noisyL2}`);
    expect(best).not.toBeNull();
    expect(best.documento).toBe('F0962540');
    expect(best.nacimiento).toBe('1999-07-15');
  });

  it('aceita candidato sem nome legível mas com doc+birth válidos', () => {
    const raw = `P<BRA<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<
${L2}`;
    const list = collectTd3Candidates(raw);
    const hit = list.find(p => p.documento === 'F0962540');
    expect(hit).toBeTruthy();
    expect(hit.nacimiento).toBe('1999-07-15');
  });

  it('tolera linha MRZ com 43 chars (padding automático)', () => {
    const best = extractMRZFromText(`${L1}\n${L2}`);
    expect(best?.documento).toBe('F0962540');
  });

  it('extrai de blob sem quebras de linha', () => {
    const raw = L1 + L2;
    const list = collectTd3Candidates(raw);
    expect(list.length).toBeGreaterThan(0);
    expect(list[0].documento).toBe('F0962540');
  });
});
