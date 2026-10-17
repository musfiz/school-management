import { diff, normalize } from '../../scripts/parity/json-diff';

describe('parity/json-diff normalize', () => {
  it('turns Dates into ISO strings', () => {
    expect(normalize(new Date('2026-01-02T03:04:05.000Z'))).toBe(
      '2026-01-02T03:04:05.000Z',
    );
  });

  it('turns decimal.js Decimals into strings', () => {
    const decimal = {
      plus: () => undefined,
      toFixed: () => '10.00',
      toString: () => '10.00',
    };
    expect(normalize(decimal)).toBe('10.00');
  });

  it('sorts object keys so key order is irrelevant', () => {
    expect(normalize({ b: 1, a: 2 })).toEqual({ a: 2, b: 1 });
  });
});

describe('parity/json-diff diff', () => {
  it('reports no differences for equal structures', () => {
    expect(diff({ a: [1, 2], b: 'x' }, { b: 'x', a: [1, 2] })).toEqual([]);
  });

  it('compares decimal-ish values as strings', () => {
    const decimal = { plus: () => undefined, toFixed: () => '5.00', toString: () => '5.00' };
    expect(diff({ amount: '5.00' }, { amount: decimal })).toEqual([]);
  });

  it('reports the path of a scalar difference', () => {
    const differences = diff({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 3 } });
    expect(differences).toEqual([
      { path: '$.b.c', expected: 2, actual: 3 },
    ]);
  });

  it('flags array length mismatches and element differences', () => {
    const differences = diff([1, 2, 3], [1, 9]);
    expect(differences).toEqual([
      { path: '$.length', expected: 3, actual: 2 },
      { path: '$[1]', expected: 2, actual: 9 },
      { path: '$[2]', expected: 3, actual: undefined },
    ]);
  });
});
