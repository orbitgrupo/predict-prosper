import { describe, it as test } from 'node:test';
import { strict as assert } from 'node:assert';
import { baseballRefreshInterval } from '../src/lib/baseball';

describe('Actualización del marcador oficial', () => {
  test('el partido en vivo actualiza cada 10 segundos', () => {
    assert.equal(baseballRefreshInterval('Live'), 10_000);
  });
  test('el resultado final detiene las consultas periódicas', () => {
    assert.equal(baseballRefreshInterval('Final'), false);
  });
});