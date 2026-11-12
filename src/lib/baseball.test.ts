import { describe, expect, test } from 'bun:test';
import { baseballRefreshInterval } from './baseball';

describe('Actualización del marcador oficial', () => {
  test('el partido en vivo actualiza cada 10 segundos', () => {
    expect(baseballRefreshInterval('Live')).toBe(10_000);
  });
  test('el resultado final detiene las consultas periódicas', () => {
    expect(baseballRefreshInterval('Final')).toBe(false);
  });
});