import { describe, it, expect } from 'vitest';
import { resolveNatPhrase, nationalityFromViz, natLabel } from '../src/mrz/nationality.js';
import { NAT } from '../src/lib/constants.js';

describe('Nacionalidade MRZ + VIZ', () => {
  it('resolve frase BRASILEIRA para BRA', () => {
    const r = resolveNatPhrase('BRASILEIRA');
    expect(r).not.toBeNull();
    expect(r.code).toBe('BRA');
    expect(r.word).toBe(NAT.BRA);
  });

  it('lê nacionalidade após label NATIONALITY', () => {
    const text = 'PASSPORT\nNATIONALITY\nBRAZILIAN\nSURNAME\nSILVA';
    const r = nationalityFromViz(text);
    expect(r).not.toBeNull();
    expect(r.code).toBe('BRA');
  });

  it('natLabel combina código e palavra espanhola', () => {
    expect(natLabel('BRA', NAT.BRA)).toBe('BRA · BRASILEÑA');
  });
});
