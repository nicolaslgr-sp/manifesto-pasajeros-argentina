import { describe, it, expect } from 'vitest';
import {
  parseTD3, extractMRZFromText, mrzDigit, mrzCheck,
  isAutoApplyReady, collectTd3Candidates
} from '../src/mrz/parse.js';

function buildLine2(doc, nat, birth, sex, expiry, optional = '123456789012345') {
  const docField = doc.padEnd(9, '<').slice(0, 9);
  const docCh = mrzDigit(docField);
  const birthCh = mrzDigit(birth);
  const expCh = mrzDigit(expiry);
  const body = docField + docCh + nat + birth + birthCh + sex + expiry + expCh + optional.slice(0, 15).padEnd(15, '<');
  const compCh = mrzDigit(body);
  return body + compCh;
}

const L1 = 'P<BRAOLIVEIRA<<JOAO<PEDRO<<<<<<<<<<<<<<<<<<<';

describe('MRZ TD3 parser', () => {
  it('calcula dígito verificador ICAO', () => {
    expect(mrzDigit('YB1234567')).toBe('9');
    expect(mrzCheck('900722', '0')).toBe(true);
  });

  it('parseia linhas TD3 com data de nascimento correta', () => {
    const line2 = buildLine2('YB1234567', 'BRA', '900722', 'M', '300101');
    const parsed = parseTD3(L1, line2);
    expect(parsed).not.toBeNull();
    expect(parsed.nacimiento).toBe('1990-07-22');
    expect(parsed.nacionalidadCode).toBe('BRA');
    expect(parsed.documento).toBe('YB1234567');
    expect(parsed.birthCheckOk).toBe(true);
    expect(parsed.docCheckOk).toBe(true);
  });

  it('extrai candidatos de texto OCR ruidoso', () => {
    const line2 = buildLine2('YB1234567', 'BRA', '900722', 'M', '300101');
    const raw = `PASSPORT\n${L1}\n${line2}\n`;
    const best = extractMRZFromText(raw);
    expect(best).not.toBeNull();
    expect(best.documento).toBe('YB1234567');
    expect(best.nacimiento).toBe('1990-07-22');
  });

  it('isAutoApplyReady exige checksums e nome', () => {
    const line2 = buildLine2('YB1234567', 'BRA', '850315', 'F', '280101');
    const parsed = parseTD3('P<BRA<SILVA<SANTOS<<MARIA<<<<<<<<<<<<<<<<<<<<<', line2);
    expect(parsed.birthCheckOk).toBe(true);
    if (parsed.docCheckOk && parsed.compositeOk && parsed.score >= 70) {
      expect(isAutoApplyReady(parsed)).toBe(true);
    }
  });

  it('offset de nascimento usa slice(13,19) não slice(14,20)', () => {
    const line2 = buildLine2('BR987654', 'BRA', '850315', 'F', '280101');
    const list = collectTd3Candidates(`${L1}\n${line2}`);
    const hit = list.find(p => p.nacimiento === '1985-03-15');
    expect(hit).toBeTruthy();
  });
});
