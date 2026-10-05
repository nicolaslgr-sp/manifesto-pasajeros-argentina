import { NAT } from '../lib/constants.js';
import { foldKey } from '../lib/dates.js';
import { NATIONALITY_LABELS } from './viz-labels.js';

/**
 * Palavras de nacionalidade / país (vários idiomas) → código ICAO.
 * Saída no manifesto é sempre a forma em espanhol de NAT[code].
 */
export const NAT_WORDS = {
  // Brasil
  BRASIL: 'BRA', BRAZIL: 'BRA', BRAZILIAN: 'BRA', BRASILEIRA: 'BRA', BRASILEIRO: 'BRA',
  BRASILENA: 'BRA', BRASILENO: 'BRA', BRESIL: 'BRA', BRESILIEN: 'BRA', BRESILIENNE: 'BRA',
  BRASILIANISCH: 'BRA', BRASILIANER: 'BRA', BRASILE: 'BRA', BRASILIANO: 'BRA', BRASILIANA: 'BRA',
  // Argentina
  ARGENTINA: 'ARG', ARGENTINE: 'ARG', ARGENTINO: 'ARG', ARGENTINIAN: 'ARG', ARGENTINIEN: 'ARG',
  // Paraguai / Uruguai / Chile / Bolívia
  PARAGUAY: 'PRY', PARAGUAYA: 'PRY', PARAGUAYO: 'PRY', PARAGUAYAN: 'PRY', PARAGUAI: 'PRY',
  URUGUAY: 'URY', URUGUAYA: 'URY', URUGUAYO: 'URY', URUGUAYAN: 'URY', URUGUAI: 'URY',
  CHILE: 'CHL', CHILENA: 'CHL', CHILENO: 'CHL', CHILEAN: 'CHL', CHILIEN: 'CHL',
  BOLIVIA: 'BOL', BOLIVIANA: 'BOL', BOLIVIANO: 'BOL', BOLIVIAN: 'BOL', BOLIVIEN: 'BOL',
  // Andinos / Caribe
  PERU: 'PER', PERUANA: 'PER', PERUANO: 'PER', PERUVIAN: 'PER', PERUVIEN: 'PER',
  COLOMBIA: 'COL', COLOMBIANA: 'COL', COLOMBIANO: 'COL', COLOMBIAN: 'COL', COLOMBIEN: 'COL',
  VENEZUELA: 'VEN', VENEZOLANA: 'VEN', VENEZOLANO: 'VEN', VENEZUELAN: 'VEN', VENEZUELIEN: 'VEN',
  ECUADOR: 'ECU', ECUATORIANA: 'ECU', ECUATORIANO: 'ECU', ECUADORIAN: 'ECU', EQUATORIEN: 'ECU',
  // Europa
  ITALIA: 'ITA', ITALY: 'ITA', ITALIANA: 'ITA', ITALIANO: 'ITA', ITALIAN: 'ITA', ITALIEN: 'ITA', ITALIENNE: 'ITA',
  ESPANA: 'ESP', SPAIN: 'ESP', ESPANOLA: 'ESP', ESPANOL: 'ESP', SPANISH: 'ESP', ESPAGNE: 'ESP',
  ESPAGNOL: 'ESP', ESPAGNOLE: 'ESP', SPANIEN: 'ESP', SPANISCH: 'ESP',
  PORTUGAL: 'PRT', PORTUGUESA: 'PRT', PORTUGUES: 'PRT', PORTUGUESE: 'PRT', PORTUGAISE: 'PRT',
  GERMANY: 'DEU', ALEMANA: 'DEU', ALEMAN: 'DEU', ALEMANHA: 'DEU', GERMAN: 'DEU',
  DEUTSCHLAND: 'DEU', DEUTSCHE: 'DEU', DEUTSCHER: 'DEU', ALLEMAGNE: 'DEU', ALLEMAND: 'DEU', ALLEMANDE: 'DEU',
  FRANCE: 'FRA', FRANCESA: 'FRA', FRANCES: 'FRA', FRENCH: 'FRA', FRANCAIS: 'FRA', FRANCAISE: 'FRA',
  FRANZOSISCH: 'FRA', FRANZOESISCH: 'FRA',
  BRITISH: 'GBR', BRITANICA: 'GBR', BRITANICO: 'GBR', INGLESA: 'GBR', INGLES: 'GBR', ENGLISH: 'GBR',
  UNITEDKINGDOM: 'GBR', GREATBRITAIN: 'GBR', ROYAUMEUNI: 'GBR',
  POLAND: 'POL', POLACA: 'POL', POLACO: 'POL', POLISH: 'POL', POLSKA: 'POL', POLOGNE: 'POL',
  UKRAINE: 'UKR', UCRANIANA: 'UKR', UCRANIANO: 'UKR', UKRAINIAN: 'UKR', UKRAINIEN: 'UKR',
  ROMANIA: 'ROU', RUMANA: 'ROU', RUMANO: 'ROU', ROMANIAN: 'ROU', ROUMAIN: 'ROU', ROUMANIE: 'ROU',
  TURKEY: 'TUR', TURCA: 'TUR', TURCO: 'TUR', TURKISH: 'TUR', TURQUIE: 'TUR', TURC: 'TUR',
  IRELAND: 'IRL', IRLANDESA: 'IRL', IRLANDES: 'IRL', IRISH: 'IRL', IRLANDE: 'IRL',
  SWEDEN: 'SWE', SUECA: 'SWE', SUECO: 'SWE', SWEDISH: 'SWE', SUEDE: 'SWE', SUEDEIS: 'SWE',
  NORWAY: 'NOR', NORUEGA: 'NOR', NORUEGO: 'NOR', NORWEGIAN: 'NOR', NORVEGE: 'NOR',
  DENMARK: 'DNK', DANESA: 'DNK', DANES: 'DNK', DANISH: 'DNK', DANEMARK: 'DNK',
  FINLAND: 'FIN', FINLANDESA: 'FIN', FINLANDES: 'FIN', FINNISH: 'FIN', FINLANDE: 'FIN',
  AUSTRIA: 'AUT', AUSTRIACA: 'AUT', AUSTRIACO: 'AUT', AUSTRIAN: 'AUT', AUTRICHE: 'AUT',
  GREECE: 'GRC', GRIEGA: 'GRC', GRIEGO: 'GRC', GREEK: 'GRC', GRECE: 'GRC', GREC: 'GRC',
  CZECH: 'CZE', CHECA: 'CZE', CHECO: 'CZE', CZECHIA: 'CZE', TCHEQUE: 'CZE',
  HUNGARY: 'HUN', HUNGARA: 'HUN', HUNGARO: 'HUN', HUNGARIAN: 'HUN', HONGRIE: 'HUN',
  BELGIUM: 'BEL', BELGA: 'BEL', BELGIAN: 'BEL', BELGIQUE: 'BEL', BELGE: 'BEL',
  NETHERLANDS: 'NLD', HOLANDA: 'NLD', HOLANDESA: 'NLD', DUTCH: 'NLD', NEERLANDESA: 'NLD',
  NEERLANDES: 'NLD', PAYSBAS: 'NLD', NEDERLAND: 'NLD',
  SWITZERLAND: 'CHE', SUIZA: 'CHE', SUIZO: 'CHE', SWISS: 'CHE', SUISSE: 'CHE', SCHWEIZ: 'CHE',
  // América do Norte / Oceania
  USA: 'USA', AMERICAN: 'USA', ESTADOUNIDENSE: 'USA', UNITEDSTATES: 'USA', AMERICANA: 'USA',
  AMERICANO: 'USA', ETATSUNIS: 'USA',
  CANADA: 'CAN', CANADIENSE: 'CAN', CANADIAN: 'CAN', CANADIEN: 'CAN', CANADIENNE: 'CAN',
  MEXICO: 'MEX', MEXICANA: 'MEX', MEXICANO: 'MEX', MEXICAN: 'MEX', MEXIQUE: 'MEX',
  AUSTRALIA: 'AUS', AUSTRALIANA: 'AUS', AUSTRALIANO: 'AUS', AUSTRALIAN: 'AUS', AUSTRALIEN: 'AUS',
  NEWZEALAND: 'NZL', NEOZELANDESA: 'NZL', NEOZELANDES: 'NZL',
  // Ásia
  JAPAN: 'JPN', JAPONESA: 'JPN', JAPONES: 'JPN', JAPANESE: 'JPN', JAPON: 'JPN', JAPONAIS: 'JPN',
  CHINA: 'CHN', CHINESE: 'CHN', CHINOISE: 'CHN', CHINOIS: 'CHN', CHINESA: 'CHN', CHINES: 'CHN',
  KOREA: 'KOR', KOREAN: 'KOR', COREANA: 'KOR', COREANO: 'KOR', COREE: 'KOR',
  RUSSIA: 'RUS', RUSSIAN: 'RUS', RUSA: 'RUS', RUSO: 'RUS', RUSSIE: 'RUS', RUSSE: 'RUS',
  INDIA: 'IND', INDIAN: 'IND', INDIANA: 'IND', INDIANO: 'IND', INDIEN: 'IND',
  ISRAEL: 'ISR', ISRAELI: 'ISR', ISRAELIEN: 'ISR',
  SINGAPORE: 'SGP', SINGAPURENSE: 'SGP', SINGAPOURIEN: 'SGP',
  THAILAND: 'THA', TAILANDESA: 'THA', THAI: 'THA', THAILANDAISE: 'THA',
  INDONESIA: 'IDN', INDONESIAN: 'IDN', INDONESIEN: 'IDN',
  PHILIPPINES: 'PHL', FILIPINA: 'PHL', FILIPINO: 'PHL', PHILIPPINE: 'PHL',
  VIETNAM: 'VNM', VIETNAMITA: 'VNM', VIETNAMESE: 'VNM', VIETNAMIEN: 'VNM',
  TAIWAN: 'TWN', TAIWANESE: 'TWN', TAIWANESA: 'TWN',
  HONGKONG: 'HKG', HONGKONESA: 'HKG',
  MALAYSIA: 'MYS', MALASIA: 'MYS', MALAYSIAN: 'MYS',
  BANGLADESH: 'BGD', BANGLADESI: 'BGD',
  PAKISTAN: 'PAK', PAKISTANI: 'PAK',
  // Oriente Médio / África
  UAE: 'ARE', EMIRATI: 'ARE', EMIRATIE: 'ARE', EMIRATS: 'ARE',
  SAUDI: 'SAU', SAUDIARABIA: 'SAU', SAOUDIEN: 'SAU',
  EGYPT: 'EGY', EGIPCIA: 'EGY', EGIPCIO: 'EGY', EGYPTIAN: 'EGY', EGYPTE: 'EGY',
  MOROCCO: 'MAR', MARROQUI: 'MAR', MOROCCAN: 'MAR', MAROC: 'MAR', MAROCAIN: 'MAR',
  SOUTHAFRICA: 'ZAF', SUDAFRICANA: 'ZAF', SUDAFRICANO: 'ZAF',
  // Caribe / América Central
  CUBA: 'CUB', CUBANA: 'CUB', CUBANO: 'CUB', CUBAN: 'CUB',
  DOMINICAN: 'DOM', DOMINICANA: 'DOM', DOMINICANO: 'DOM',
  HAITI: 'HTI', HAITIANA: 'HTI', HAITIANO: 'HTI', HAITIAN: 'HTI',
  PANAMA: 'PAN', PANAMENA: 'PAN', PANAMENO: 'PAN', PANAMANIAN: 'PAN',
  COSTARICA: 'CRI', COSTARRICENSE: 'CRI',
  NICARAGUA: 'NIC', NICARAGUENSE: 'NIC',
  HONDURAS: 'HND', HONDURENA: 'HND', HONDURENO: 'HND',
  ELSALVADOR: 'SLV', SALVADORENA: 'SLV', SALVADORENO: 'SLV',
  GUATEMALA: 'GTM', GUATEMALTECA: 'GTM', GUATEMALTECO: 'GTM'
};

// Forma espanhola do manifesto também resolve (BRASILEÑA → BRA, etc.)
for (const code of Object.keys(NAT)) {
  const folded = foldKey(NAT[code]);
  if (folded && folded.length >= 4 && !NAT_WORDS[folded]) NAT_WORDS[folded] = code;
}

export function natLabel(code, word) {
  const c = String(code || '').toUpperCase();
  const w = word || NAT[c] || '';
  if (c && w && w !== c) return `${c} · ${w}`;
  return w || c || '';
}

export function resolveNatPhrase(phrase) {
  const folded = foldKey(phrase);
  if (!folded) return null;
  const keys = Object.keys(NAT_WORDS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (k.length < 4) continue;
    if (folded.includes(k)) {
      const code = NAT_WORDS[k];
      if (NAT[code]) return { code, word: NAT[code], matched: k, fromWord: true };
    }
  }
  if (folded.length >= 3 && NAT[folded.slice(0, 3)]) {
    const code = folded.slice(0, 3);
    return { code, word: NAT[code], matched: code, fromWord: false };
  }
  return null;
}

export function nationalityAfterLabel(text) {
  const u = String(text || '').toUpperCase();
  // Labels mais longos primeiro
  const labels = [...NATIONALITY_LABELS].sort((a, b) => b.length - a.length);
  for (const label of labels) {
    const idx = u.indexOf(label.toUpperCase());
    if (idx < 0) continue;
    const rest = u.slice(idx + label.length).replace(/^[\s:.\-\/]+/, '');
    const lines = rest.split(/\n+/);
    let chunk = '';
    for (let j = 0; j < Math.min(3, lines.length); j++) chunk += ' ' + lines[j];
    const resolved = resolveNatPhrase(chunk.slice(0, 100));
    if (resolved) {
      resolved.fromLabel = true;
      return resolved;
    }
  }
  return null;
}

export function nationalityFromViz(text) {
  const labeled = nationalityAfterLabel(text);
  if (labeled) return labeled;
  const keys = Object.keys(NAT_WORDS).sort((a, b) => b.length - a.length);
  const folded = foldKey(text);
  for (const k of keys) {
    if (k.length < 5) continue;
    if (folded.includes(k)) {
      const code = NAT_WORDS[k];
      if (NAT[code]) return { code, word: NAT[code], matched: k, fromWord: true, fromLabel: false };
    }
  }
  return null;
}
