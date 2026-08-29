export const STORAGE_KEY = 'manifesto-argentina-v3';
export const PAX_ROWS_ENTRADA = 6;
export const PAX_ROWS_SALIDA = 5;
export const PAX_MAX_TOTAL = 11;
export const GUIDE_NAME = 'Reginaldo Pereira Gomes';

export const NAT = {
  BRA: 'BRASILEÑA', ARG: 'ARGENTINA', PRY: 'PARAGUAYA', URY: 'URUGUAYA',
  CHL: 'CHILENA', BOL: 'BOLIVIANA', PER: 'PERUANA', COL: 'COLOMBIANA',
  VEN: 'VENEZOLANA', ECU: 'ECUATORIANA', USA: 'ESTADOUNIDENSE',
  ITA: 'ITALIANA', ESP: 'ESPAÑOLA', PRT: 'PORTUGUESA', DEU: 'ALEMANA',
  FRA: 'FRANCESA', GBR: 'BRITÁNICA', JPN: 'JAPONESA', CHN: 'CHINA',
  KOR: 'COREANA', RUS: 'RUSA', MEX: 'MEXICANA', CAN: 'CANADIENSE',
  AUS: 'AUSTRALIANA', NLD: 'NEERLANDESA', BEL: 'BELGA', CHE: 'SUIZA',
  ISR: 'ISRAELÍ', IND: 'INDIA', ZAF: 'SUDAFRICANA', POL: 'POLACA',
  UKR: 'UCRANIANA', ROU: 'RUMANA', TUR: 'TURCA', IRL: 'IRLANDESA',
  SWE: 'SUECA', NOR: 'NORUEGA', DNK: 'DANESA', FIN: 'FINLANDESA',
  AUT: 'AUSTRIACA', GRC: 'GRIEGA', CZE: 'CHECA', HUN: 'HÚNGARA',
  NZL: 'NEOZELANDESA', SGP: 'SINGAPURENSE', THA: 'TAILANDESA',
  IDN: 'INDONESIA', PHL: 'FILIPINA', VNM: 'VIETNAMITA',
  ARE: 'EMIRATÍ', SAU: 'SAUDÍ', EGY: 'EGIPCIA', MAR: 'MARROQUÍ',
  CUB: 'CUBANA', DOM: 'DOMINICANA', HTI: 'HAITIANA', PAN: 'PANAMEÑA',
  CRI: 'COSTARRICENSE', NIC: 'NICARAGÜENSE', HND: 'HONDUREÑA',
  SLV: 'SALVADOREÑA', GTM: 'GUATEMALTECA', TWN: 'TAIWANESA',
  HKG: 'HONGKONESA', MYS: 'MALASIA', BGD: 'BANGLADESÍ', PAK: 'PAKISTANÍ'
};

export const MRZ_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';

export function uid() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function defaultState() {
  const today = new Date();
  const iso = today.toISOString().slice(0, 10);
  return {
    header: {
      medio: 'AUTOMOVIL',
      placa: '',
      nacion: 'BRASIL',
      paso: 'PTN',
      fecha: iso,
      nro: '',
      hoja: 1,
      hojaTotal: 1,
      del: '',
      por: '',
      consignado: ''
    },
    guia: {
      nombre: GUIDE_NAME,
      documento: '',
      nacionalidad: 'BRASILEÑA'
    },
    tripulacion: [],
    pasajeros: []
  };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
    const legacy = localStorage.getItem('manifesto-argentina-v2');
    if (legacy) return JSON.parse(legacy);
  } catch (_) { /* ignore */ }
  return null;
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (_) { /* ignore */ }
}

export function crewCount(state) {
  return 1 + state.tripulacion.filter(c => (c.nombre || '').trim()).length;
}

export function filledPax(state) {
  return state.pasajeros.filter(p => (p.apellidoNombre || '').trim());
}
