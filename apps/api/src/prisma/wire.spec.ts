import { toDateValue, toWire, toWireList } from './wire';

describe('toWire', () => {
  it('renames camelCase timestamps to the snake_case wire keys', () => {
    const row = {
      id: '1',
      imageUrl: '/x.jpg',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      updatedAt: new Date('2026-01-03T00:00:00.000Z'),
    };

    expect(toWire(row)).toEqual({
      id: '1',
      imageUrl: '/x.jpg',
      created_at: new Date('2026-01-02T03:04:05.000Z'),
      updated_at: new Date('2026-01-03T00:00:00.000Z'),
    });
  });

  it('drops the camelCase originals so the wire shape is unchanged', () => {
    const wire = toWire({ id: '1', createdAt: new Date() });
    expect('createdAt' in wire).toBe(false);
    expect('updatedAt' in wire).toBe(false);
  });

  it('omits updated_at for models that only have a created timestamp', () => {
    const wire = toWire({
      id: '1',
      name: 'Website Management',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(Object.keys(wire).sort()).toEqual(['created_at', 'id', 'name']);
  });

  it('maps a list element-wise', () => {
    const rows = toWireList([
      { id: 'a', createdAt: new Date('2026-01-01T00:00:00.000Z') },
      { id: 'b', createdAt: new Date('2026-01-02T00:00:00.000Z') },
    ]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows[0].created_at).toEqual(new Date('2026-01-01T00:00:00.000Z'));
  });
});

describe('toDateValue', () => {
  it('parses a YYYY-MM-DD string as UTC midnight (matching the adapter formatter)', () => {
    expect(toDateValue('2026-05-01').toISOString()).toBe(
      '2026-05-01T00:00:00.000Z',
    );
  });

  it('passes Date / null / undefined through unchanged', () => {
    const date = new Date('2026-05-01T00:00:00.000Z');
    expect(toDateValue(date)).toBe(date);
    expect(toDateValue(null)).toBeNull();
    expect(toDateValue(undefined)).toBeUndefined();
  });
});
