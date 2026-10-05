import { describe, it, expect } from 'vitest';
import { parseVIZ, buildResultFromViz } from '../src/viz/parse-visual.js';
import { nationalityFromViz, resolveNatPhrase } from '../src/mrz/nationality.js';
import { NAT } from '../src/lib/constants.js';

describe('Rótulos VIZ multilíngues', () => {
  it('inglês: SURNAME + GIVEN NAMES + NATIONALITY + DATE OF BIRTH', () => {
    const viz = parseVIZ(
      'PASSPORT NO AB1234567\nSURNAME SMITH\nGIVEN NAMES JOHN\nNATIONALITY UNITED STATES OF AMERICA\nDATE OF BIRTH 12 JAN 1988',
      null
    );
    expect(viz.apellidoNombre).toMatch(/SMITH/);
    expect(viz.apellidoNombre).toMatch(/JOHN/);
    expect(viz.documento).toBe('AB1234567');
    expect(viz.nacionalidadCode).toBe('USA');
    expect(viz.nacimiento).toBe('1988-01-12');
  });

  it('francês: NOM / PRENOM / NATIONALITE / DATE DE NAISSANCE', () => {
    const viz = parseVIZ(
      'PASSEPORT N 12AB34567\nNOM DE FAMILLE DUPONT\nPRENOM MARIE\nNATIONALITE FRANCAISE\nDATE DE NAISSANCE 03/05/1992',
      null
    );
    expect(viz.apellidoNombre).toMatch(/DUPONT|MARIE/);
    expect(viz.nacionalidadCode).toBe('FRA');
    expect(viz.nacimiento).toBe('1992-05-03');
  });

  it('alemão: NACHNAME + VORNAME + STAATSANGEHORIGKEIT', () => {
    const viz = parseVIZ(
      'NACHNAME MUELLER\nVORNAME ANNA\nSTAATSANGEHORIGKEIT DEUTSCH\nGEBURTSDATUM 01.02.1980\nPASS NR C01X00T47',
      null
    );
    expect(viz.apellidoNombre).toMatch(/MUELLER|ANNA/);
    expect(viz.nacionalidadCode).toBe('DEU');
    expect(viz.nacimiento).toBe('1980-02-01');
  });

  it('espanhol: APELLIDOS + NOMBRES + NACIONALIDAD', () => {
    const viz = parseVIZ(
      'PASAPORTE Nº AAA123456\nAPELLIDOS GARCIA LOPEZ\nNOMBRES MARIA\nNACIONALIDAD ESPANOLA\nFECHA DE NACIMIENTO 20/11/1975',
      null
    );
    expect(viz.apellidoNombre).toMatch(/GARCIA/);
    expect(viz.nacionalidadCode).toBe('ESP');
    expect(viz.nacimiento).toBe('1975-11-20');
  });

  it('italiano: COGNOME + NAZIONALITA', () => {
    const r = nationalityFromViz('NAZIONALITA ITALIANA');
    expect(r.code).toBe('ITA');
    expect(r.word).toBe(NAT.ITA);
  });

  it('resolve demônimos em vários idiomas → forma espanhola NAT', () => {
    expect(resolveNatPhrase('BRAZILIAN').word).toBe('BRASILEÑA');
    expect(resolveNatPhrase('DEUTSCHLAND').code).toBe('DEU');
    expect(resolveNatPhrase('JAPANESE').word).toBe('JAPONESA');
    expect(resolveNatPhrase('ARGENTINO').code).toBe('ARG');
  });

  it('buildResultFromViz usa nacionalidad espanhola do manifesto', () => {
    const viz = parseVIZ(
      'SURNAME SILVA\nGIVEN NAMES JOAO\nNATIONALITY BRAZILIAN\nDATE OF BIRTH 15 MAR 1985\nPASSPORT NO BR9876543',
      null
    );
    const result = buildResultFromViz(viz);
    expect(result).not.toBeNull();
    expect(result.nacionalidad).toBe('BRASILEÑA');
  });
});
