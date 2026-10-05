/**
 * Rótulos da zona visual (VIZ) — cobrindo as línguas usadas em
 * passaportes ICAO Doc 9303 (quase sempre bilíngues: local + EN/FR).
 * A MRZ já é universal; estes labels localizam os campos na página.
 */

/** Letras de scripts usados em passaportes (além do latim ASCII). */
const SCRIPT =
  '\\u0370-\\u03FF' + // grego
  '\\u0400-\\u04FF' + // cirílico
  '\\u0590-\\u05FF' + // hebraico
  '\\u0600-\\u06FF' + // árabe
  '\\u4E00-\\u9FFF' + // CJK
  '\\u3040-\\u30FF' + // hiragana/katakana
  '\\uAC00-\\uD7AF';  // hangul

const KEEP_CHARS = new RegExp(`[^A-Z0-9${SCRIPT}]`, 'g');
const KEEP_SEARCH = new RegExp(`[^A-Z0-9${SCRIPT}\\n]+`, 'g');

/** Sobrenome / apellido / family name */
export const SURNAME_LABELS = [
  // EN / ES / PT / FR / IT / DE / NL
  'SURNAME', 'FAMILY NAME', 'LAST NAME', 'FAMILYNAME',
  'APELLIDOS', 'APELLIDO', 'SOBRENOME', 'APELIDO',
  'NOM DE FAMILLE', 'NOM/', 'NOM DE FAMILIA',
  'COGNOME', 'NACHNAME', 'FAMILIENNAME', 'ACHTERNAAM',
  // Nordics / Baltics
  'EFTERNAVN', 'EFTERNAMN', 'ETTERNAVN', 'SUKUNIMI', 'AETTERNÖFN',
  'PAVARDE', 'UZVARDS', 'PEREKONNANIMI',
  // Slavic
  'NAZWISKO', 'PRIJMENI', 'PRIEZVISKO', 'PREZIME', 'PREZIME/IME',
  'FAMILIYA', 'ФАМИЛИЯ', 'ПРИЗВИЩЕ', 'ПРЕЗИМЕ', 'ПРЕЗИМЕ/ИМЕ',
  'ФАМИЛИЯ/ИМЕ', 'RODOVE MENO',
  // SE Europe / Turkic / Greek / Hungarian / Romanian
  'SOYADI', 'SOY ADI', 'ΕΠΩΝΥΜΟ', 'EPONYMO', 'CSALADI NEV', 'CSALÁDNÉV',
  'NUME', 'NUME DE FAMILIE',
  // East Asia (native + romanized)
  'KOKUSEKI', 'SEI', 'MYOJI', '姓', '氏', '성', '姓氏', '氏名',
  // Arabic / Hebrew (common on bilingual passports)
  'اسم العائلة', 'اللقب', 'שם משפחה',
  // Other
  'APELYIDO', 'PANGALAN NG PAMILYA', 'HO', 'HỌ', 'NAMA KELUARGA',
  'NACHNAME/VORNAME', 'APELLIDO/S'
];

/** Nome(s) / given names */
export const GIVEN_LABELS = [
  'GIVEN NAMES', 'GIVEN NAME', 'GIVENNAMES', 'FIRST NAME', 'FIRST NAMES',
  'FORENAMES', 'FORENAME', 'NAMES', 'OTHER NAMES',
  'NOMES', 'NOME/', 'NOME ', 'NOME:', 'NOME\n', 'NOME PROPRIO', 'NOME E COGNOME',
  'PRENOM', 'PRENOMS', 'PRÉNOM', 'PRÉNOMS',
  'NOMBRES', 'NOMBRE',
  'VORNAME', 'VORNAMEN', 'VOORNAMEN', 'VOORNAAM',
  'FORNAVNE', 'FORNAMN', 'FORNAVN', 'ETUNIMET', 'ETUNIMI',
  'IMIONA', 'IMIE', 'JMENA', 'JMENO', 'MENA', 'IME', 'IMENA',
  'ИМЯ', 'ИМЕНА', 'ІМʼЯ', 'ІМЯ', 'ИМЕ',
  'ADI', 'ADLARI', 'ΟΝΟΜΑ', 'ONOMA', 'KERESZTNEV', 'KERESZTNÉV',
  'PRENUME', 'NOMEI', 'PANGALAN', 'TEN', 'TÊN', 'NAMA DEPAN',
  '名', '이름', 'الاسم الشخصي', 'الاسم', 'שם פרטי'
];

/** Nome completo numa linha */
export const FULL_NAME_LABELS = [
  'APELLIDO Y NOMBRE', 'APELLIDOS Y NOMBRES', 'APELLIDOS Y NOMBRE',
  'NOME COMPLETO', 'FULL NAME', 'NOM COMPLET', 'NOMBRE COMPLETO',
  'NAME', 'HOLDER', 'TITULAR', 'PORTEUR', 'INHABER',
  'ФИО', 'ПІБ', 'NOME E COGNOME'
];

/** Nacionalidade / citizenship */
export const NATIONALITY_LABELS = [
  'NACIONALIDADE', 'NACIONALIDAD', 'NATIONALITY', 'NATIONALITE', 'NATIONALITÉ',
  'NAZIONALITA', 'NAZIONALITÀ', 'STAATSANGEHORIGKEIT', 'STAATSANGEHÖRIGKEIT',
  'NATIONALITEIT', 'NARODOWOSC', 'NARODOWOŚĆ', 'NARODNOST', 'NÁRODNOST',
  'DRZAVLJANSTVO', 'DRŽAVLJANSTVO', 'GRAJDANSTVO', 'ГРАЖДАНСТВО',
  'ГРОМАДЯНСТВО', 'ДРЖАВЉАНСТВО', 'ДРУЖАВЈАНСТВО',
  'UYRUK', 'UYRUĞU', 'CITIZENSHIP', 'CITOYENNETE', 'CITOYENNETÉ',
  'NACIONALITAT', 'HYPPYYS', 'KANSALAISUUS', 'PILSONIBA', 'PILSONĪBA',
  'PILIETYBE', 'PILIEČIŲ', 'ΚΥΑΡΥΟΤΗΤΑ', 'ITHAGENEIA', 'ΙΘΑΓΕΝΕΙΑ',
  'ALLAMPOLGARSAG', 'ÁLLAMPOLGÁRSÁG', 'CETATENIE', 'CETĂȚENIE',
  'KOKUSEKI', '國籍', '国籍', '국적', 'الجنسية', 'אזרחות',
  'KABANSAAN', 'QUOCTICH', 'QUỐC TỊCH', 'KEWARGANEGARAAN', 'BANGSA'
];

/** Data de nascimento */
export const BIRTH_LABELS = [
  'DATE OF BIRTH', 'DATE/PLACE OF BIRTH', 'DATE / PLACE OF BIRTH',
  'PLACE AND DATE OF BIRTH', 'DATE AND PLACE OF BIRTH',
  'BIRTH DATE', 'BIRTHDAY', 'BIRTH', 'DOB',
  'FECHA DE NACIMIENTO', 'FECHA NACIMIENTO', 'LUGAR Y FECHA DE NACIMIENTO',
  'DATA DE NASCIMENTO', 'DATA DO NASCIMENTO', 'DATA NASCIMENTO', 'NASCIMENTO',
  'DATE DE NAISSANCE', 'LIEU ET DATE DE NAISSANCE',
  'GEBURTSDATUM', 'GEBURTSORT UND DATUM', 'GEBOORTEDATUM', 'GEBOORTEPLAATS',
  'DATA DI NASCITA', 'LUOGO E DATA DI NASCITA',
  'FODEDATUM', 'FØDSELSDATO', 'FODDATUM', 'FØDSELSDATO', 'FOEDSELSDATO',
  'SYNTIMAAIKA', 'SYNYMÄAIKA', 'DATA URODZENIA', 'DATUM NAROZENI', 'DATUM NAROZENÍ',
  'DATUM NARODENIA', 'DATUM ROJENJA', 'DATUM RODENJA', 'DATUM ROĐENJA',
  'DATA NASTERII', 'DATA NAȘTERII', 'DOGUM TARIHI', 'DOĞUM TARİHİ',
  'ΗΜΕΡΟΜΗΝΙΑ ΓΕΝΝΗΣΗΣ', 'IMEROMINIA GENNISIS',
  'SZULETESI DATUM', 'SZÜLETÉSI DÁTUM',
  'ДАТА РОЖДЕНИЯ', 'ДАТА НАРОДЖЕННЯ', 'ДАТА РОЂЕЊА', 'ДАТА НА РАЖДАНЕ',
  '生年月日', '出生日期', '출생일', 'تاريخ الميلاد', 'תאריך לידה',
  'PETSA NG KAPANGANAKAN', 'NGAY SINH', 'TANGGAL LAHIR'
];

/** Número do passaporte / documento */
export const PASSPORT_LABELS = [
  'PASSAPORTE N', 'PASSAPORTE NO', 'PASSAPORTE Nº', 'PASSAPORTE N°', 'PASSAPORTE NUMERO',
  'PASSPORT NO', 'PASSPORT N', 'PASSPORT Nº', 'PASSPORT N°', 'PASSPORT NUMBER', 'PASSPORT NR',
  'PASSAPORT N', 'Nº PASSAPORTE', 'NO PASSAPORTE', 'NUMERO DO PASSAPORTE',
  'NUMERO DE PASAPORTE', 'NÚMERO DE PASAPORTE', 'PASAPORTE N', 'PASAPORTE Nº', 'PASAPORTE N°',
  'PASSEPORT N', 'PASSEPORT NO', 'PASSEPORT Nº', 'NUMERO DE PASSEPORT', 'N° DE PASSEPORT',
  'REISEPASS NR', 'REISEPASS N', 'PASS NR', 'PASS NUMMER',
  'DOCUMENT NO', 'DOCUMENT NUMBER', 'DOCUMENT NR', 'DOC NO', 'DOC. NO',
  'NO DE DOCUMENTO', 'Nº DE DOCUMENTO', 'N° DE DOCUMENTO', 'TIPO Y N',
  'NUMERO DI PASSAPORTO', 'PASSAPORTO N', 'PASSAPORTO NR',
  'PASPOORTNR', 'PASPOORT NR', 'PASPOORTNUMMER',
  'PASSNUMMER', 'PASSENUMMER', 'PASS NUMMER',
  'NUMAR PASAPORT', 'NUMĂR PAȘAPORT', 'PASAPORT NO',
  'PASAPORT NUMARASI', 'PASAPORT NO',
  'ΑΡΙΘΜΟΣ ΔΙΑΒΑΤΗΡΙΟΥ', 'ARITHMOS DIABATIRIOU',
  'НОМЕР ПАСПОРТА', 'НОМЕР ПАСПОРТУ', 'БРОЙ НА ПАСПОРТА',
  '旅券番号', '护照号码', '여권번호', 'رقم الجواز', 'מספר דרכון',
  'PASAPORTE NUMERO', 'BOOKLET NO', 'DOCUMENTO N'
];

/** Palavras que nunca são nome de pessoa (rótulos / lixo OCR) */
export const LABEL_STOP_WORDS = [
  ...SURNAME_LABELS, ...GIVEN_LABELS, ...FULL_NAME_LABELS,
  ...NATIONALITY_LABELS, ...BIRTH_LABELS, ...PASSPORT_LABELS,
  'REPUBLICA', 'REPUBLIC', 'FEDERATIVA', 'FEDERAL', 'FEDERATION',
  'PASSPORT', 'PASSAPORTE', 'PASAPORTE', 'PASSEPORT', 'REISEPASS', 'PASPOORT',
  'AUTHORITY', 'AUTORIDADE', 'AUTHORITE', 'AUTORIDAD', 'BEHORDE',
  'TYPE', 'TIPO', 'SEX', 'SEXO', 'SEXE', 'GESCHLECHT', 'GENDER',
  'PLACE', 'LUGAR', 'LOCAL', 'OF', 'DE', 'DA', 'DO', 'THE', 'AND', 'Y', 'E', 'ET', 'UND',
  'VALID', 'VALIDO', 'VALID UNTIL', 'EXPIRY', 'EXPIRA', 'EXPIRATION',
  'ISSUING', 'EMISSOR', 'ISSUED', 'PERSONAL', 'NO', 'NR', 'NUMBER', 'NUMERO',
  'COUNTRY', 'CODE', 'CODIGO', 'CODE PAYS'
].map(s => normalizeLabelToken(s)).filter(s => s.length >= 3);

/** Normaliza para busca: maiúsculas, sem acentos, só letras/números. */
export function normalizeLabelToken(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(KEEP_CHARS, '');
}

function isAsciiLabel(needle) {
  return /^[A-Z0-9 ]+$/.test(needle);
}

/**
 * Busca o texto após um rótulo, tolerando acentos, pontuação e maiúsculas.
 * Retorna o restante normalizado (bom para nomes/datas de passaporte).
 */
export function restAfterLabel(text, labels) {
  const hay = normalizeSearch(text);
  const sorted = [...labels].sort((a, b) => normalizeSearch(b).length - normalizeSearch(a).length);
  for (const label of sorted) {
    const needle = normalizeSearch(label).trim();
    if (!needle) continue;
    // latinos curtos (NO, OF) → falso positivo; ideogramas de 1 char ok
    if (isAsciiLabel(needle) && needle.replace(/\s/g, '').length < 3) continue;
    let from = 0;
    while (from < hay.length) {
      const idx = hay.indexOf(needle, from);
      if (idx < 0) break;
      const before = idx > 0 ? hay[idx - 1] : ' ';
      if (/[A-Z0-9]/.test(before)) {
        from = idx + 1;
        continue;
      }
      const rest = hay.slice(idx + needle.length).replace(/^[\s:.\-\/]+/, '').trim();
      if (rest.length >= 1) return rest;
      from = idx + needle.length;
    }
  }
  return '';
}

/** Mantém espaços/linhas; remove acentos; maiúsculas. */
export function normalizeSearch(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(KEEP_SEARCH, ' ')
    .replace(/[_\-]+/g, ' ')
    .replace(/[ \t]+/g, ' ');
}

export function isLabelStopWord(token) {
  const t = normalizeLabelToken(token);
  if (!t || t.length < 3) return false;
  return LABEL_STOP_WORDS.includes(t);
}
