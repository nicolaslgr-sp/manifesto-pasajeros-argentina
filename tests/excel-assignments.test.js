import { describe, it, expect } from 'vitest';
import { buildExcelAssignments } from '../src/excel/assignments.js';

const sampleState = {
  header: {
    medio: 'AUTOMOVIL', placa: 'ABC1D23', nacion: 'BRASIL', paso: 'PTN',
    fecha: '2026-08-18', nro: '12345', hoja: 1, hojaTotal: 1,
    del: 'FOZ DO IGUACU', por: 'PUERTO IGUAZU', consignado: 'AGENCIA TESTE LTDA'
  },
  guia: { nombre: 'REGINALDO PEREIRA GOMES', documento: 'PASAPORTE BR123456', nacionalidad: 'BRASILEÑA' },
  tripulacion: [{ id: 'c1', nombre: 'JOAO SILVA', documento: 'RG 1234567' }],
  pasajeros: [
    { id: 'p1', apellidoNombre: 'SILVA SANTOS MARIA', nacimiento: '1985-03-15', nacionalidad: 'BRASILEÑA', documento: 'PASAPORTE BR987654', visa: 'sin' },
    { id: 'p2', apellidoNombre: 'OLIVEIRA COSTA JOAO', nacimiento: '1990-07-22', nacionalidad: 'BRASILEÑA', documento: 'PASAPORTE BR876543', visa: 'con' }
  ]
};

describe('buildExcelAssignments', () => {
  it('preenche ENTRADA linha 18 (row 17) e SALIDA linha 53 (row 52)', () => {
    const a = buildExcelAssignments(sampleState);
    expect(a['17,1']).toBe('SILVA SANTOS MARIA');
    expect(a['17,2']).toBe('15/03/1985');
    expect(a['17,5']).toBe('X');
    expect(a['18,6']).toBe('X');
    expect(a['52,1']).toBe('SILVA SANTOS MARIA');
    expect(a['41,3']).toBe('PTN');
  });

  it('inclui cabeçalho e guia', () => {
    const a = buildExcelAssignments(sampleState);
    expect(a['12,0']).toContain('REGINALDO PEREIRA GOMES');
    expect(a['4,3']).toBe('PLACA : ABC1D23');
  });
});
