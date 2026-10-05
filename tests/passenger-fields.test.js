import { describe, it, expect } from 'vitest';
import {
  hasAnyPassportField, toConfirmFields, toPassengerPayload
} from '../src/lib/passenger-fields.js';

describe('passenger-fields mapping', () => {
  it('mapeia OCR → 4 campos de confirmação', () => {
    const f = toConfirmFields({
      apellidoNombre: 'Silva Santos',
      nacimiento: '1985-03-15',
      nacionalidadCode: 'BRA',
      documento: 'F0962540'
    });
    expect(f).toEqual({
      apellidoNombre: 'Silva Santos',
      nacimiento: '1985-03-15',
      nacionalidad: 'BRASILEÑA',
      documento: 'F0962540'
    });
  });

  it('confirmação → payload lista/Excel com PASAPORTE', () => {
    const p = toPassengerPayload({
      apellidoNombre: 'silva santos',
      nacimiento: '1985-03-15',
      nacionalidad: 'BRASILEÑA',
      documento: 'F0962540'
    });
    expect(p.apellidoNombre).toBe('SILVA SANTOS');
    expect(p.nacimiento).toBe('1985-03-15');
    expect(p.nacionalidad).toBe('BRASILEÑA');
    expect(p.documento).toBe('PASAPORTE F0962540');
  });

  it('hasAnyPassportField aceita leitura parcial', () => {
    expect(hasAnyPassportField({ documento: 'F0962540' })).toBe(true);
    expect(hasAnyPassportField({ apellidoNombre: '' })).toBe(false);
    expect(hasAnyPassportField(null)).toBe(false);
  });

  it('remove prefixo PASAPORTE duplicado no doc', () => {
    const f = toConfirmFields({ documento: 'PASAPORTE F0962540' });
    expect(f.documento).toBe('F0962540');
    const p = toPassengerPayload({ documento: 'PASAPORTE F0962540', apellidoNombre: 'A' });
    expect(p.documento).toBe('PASAPORTE F0962540');
  });
});
