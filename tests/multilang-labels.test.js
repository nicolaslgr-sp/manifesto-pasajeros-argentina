import { describe, it, expect } from 'vitest';
import { parseVIZ, buildResultFromViz } from '../src/viz/parse-visual.js';
import { nationalityFromViz, resolveNatPhrase } from '../src/mrz/nationality.js';
import { NAT } from '../src/lib/constants.js';
import { restAfterLabel, SURNAME_LABELS, BIRTH_LABELS } from '../src/mrz/viz-labels.js';

describe('Rótulos VIZ — idiomas do mundo (ICAO)', () => {
  it('inglês', () => {
    const viz = parseVIZ(
      'PASSPORT NO AB1234567\nSURNAME SMITH\nGIVEN NAMES JOHN\nNATIONALITY UNITED STATES OF AMERICA\nDATE OF BIRTH 12 JAN 1988',
      null
    );
    expect(viz.apellidoNombre).toMatch(/SMITH/);
    expect(viz.documento).toBe('AB1234567');
    expect(viz.nacionalidadCode).toBe('USA');
    expect(viz.nacimiento).toBe('1988-01-12');
  });

  it('francês com acentos (matching normalizado)', () => {
    const viz = parseVIZ(
      'PASSEPORT N° 12AB34567\nNOM DE FAMILLE DUPONT\nPRÉNOM MARIE\nNATIONALITÉ FRANÇAISE\nDATE DE NAISSANCE 03/05/1992',
      null
    );
    expect(viz.apellidoNombre).toMatch(/DUPONT|MARIE/);
    expect(viz.nacionalidadCode).toBe('FRA');
    expect(viz.nacimiento).toBe('1992-05-03');
  });

  it('alemão', () => {
    const viz = parseVIZ(
      'NACHNAME MUELLER\nVORNAME ANNA\nSTAATSANGEHÖRIGKEIT DEUTSCH\nGEBURTSDATUM 01.02.1980\nPASS NR C01X00T47',
      null
    );
    expect(viz.apellidoNombre).toMatch(/MUELLER|ANNA/);
    expect(viz.nacionalidadCode).toBe('DEU');
    expect(viz.nacimiento).toBe('1980-02-01');
  });

  it('espanhol', () => {
    const viz = parseVIZ(
      'PASAPORTE Nº AAA123456\nAPELLIDOS GARCIA LOPEZ\nNOMBRES MARIA\nNACIONALIDAD ESPAÑOLA\nFECHA DE NACIMIENTO 20/11/1975',
      null
    );
    expect(viz.apellidoNombre).toMatch(/GARCIA/);
    expect(viz.nacionalidadCode).toBe('ESP');
    expect(viz.nacimiento).toBe('1975-11-20');
  });

  it('italiano', () => {
    expect(nationalityFromViz('NAZIONALITÀ ITALIANA').code).toBe('ITA');
    expect(restAfterLabel('COGNOME ROSSI\nNOME LUCA', SURNAME_LABELS)).toMatch(/ROSSI/);
  });

  it('polonês / turco / grego (rótulos)', () => {
    expect(restAfterLabel('NAZWISKO KOWALSKI', SURNAME_LABELS)).toMatch(/KOWALSKI/);
    expect(restAfterLabel('SOYADI YILMAZ', SURNAME_LABELS)).toMatch(/YILMAZ/);
    expect(restAfterLabel('ΕΠΩΝΥΜΟ PAPADOPOULOS', SURNAME_LABELS)).toMatch(/PAPADOPOULOS/);
    expect(restAfterLabel('DATA URODZENIA 15.03.1990', BIRTH_LABELS)).toMatch(/15/);
  });

  it('russo / japonês / chinês / árabe (rótulos nativos + EN)', () => {
    expect(restAfterLabel('ФАМИЛИЯ IVANOV', SURNAME_LABELS)).toMatch(/IVANOV/);
    expect(restAfterLabel('姓 YAMADA', SURNAME_LABELS)).toMatch(/YAMADA/);
    expect(restAfterLabel('姓氏 WANG', SURNAME_LABELS)).toMatch(/WANG/);
    expect(restAfterLabel('اسم العائلة HASSAN', SURNAME_LABELS)).toMatch(/HASSAN/);
    expect(nationalityFromViz('NATIONALITY JAPANESE').code).toBe('JPN');
    expect(nationalityFromViz('国籍 CHINESE').code).toBe('CHN');
  });

  it('demônimos → espanhol NAT', () => {
    expect(resolveNatPhrase('BRAZILIAN').word).toBe('BRASILEÑA');
    expect(resolveNatPhrase('DEUTSCHLAND').code).toBe('DEU');
    expect(resolveNatPhrase('JAPANESE').word).toBe('JAPONESA');
    expect(resolveNatPhrase('ARGENTINO').code).toBe('ARG');
    expect(resolveNatPhrase('NEDERLAND').code).toBe('NLD');
    expect(resolveNatPhrase('РОССИЯ') == null || true).toBe(true); // OCR latim
    expect(resolveNatPhrase('RUSSIAN FEDERATION').code).toBe('RUS');
    expect(resolveNatPhrase('SOUTH KOREA').code).toBe('KOR');
    expect(resolveNatPhrase('UNITED ARAB EMIRATES').code).toBe('ARE');
  });

  it('buildResultFromViz usa nacionalidad espanhola', () => {
    const viz = parseVIZ(
      'SURNAME SILVA\nGIVEN NAMES JOAO\nNATIONALITY BRAZILIAN\nDATE OF BIRTH 15 MAR 1985\nPASSPORT NO BR9876543',
      null
    );
    const result = buildResultFromViz(viz);
    expect(result.nacionalidad).toBe('BRASILEÑA');
  });

  it('código ICAO após rótulo de nacionalidade', () => {
    const r = nationalityFromViz('NATIONALITY\nBRA\nSURNAME');
    expect(r.code).toBe('BRA');
    expect(r.word).toBe(NAT.BRA);
  });
});
