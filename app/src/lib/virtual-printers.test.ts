import { describe, it, expect } from 'vitest';
import { virtualSlotKey, virtualPrintersToHAPrinters, VIRTUAL_KEY_PREFIX } from './virtual-printers';

describe('virtualSlotKey', () => {
  it('builds an opaque key that never collides with a real entity_id', () => {
    expect(virtualSlotKey('p1', 's1')).toBe('virtual:p1:s1');
    expect(virtualSlotKey('p1', 's1').startsWith('sensor.')).toBe(false);
    expect(virtualSlotKey('p1', 's1').startsWith(VIRTUAL_KEY_PREFIX)).toBe(true);
  });
});

describe('virtualPrintersToHAPrinters (issue #67)', () => {
  it('maps a virtual printer with slots into an HAPrinter with assignable trays', () => {
    const [hp] = virtualPrintersToHAPrinters([
      { id: 'p1', name: 'Dry Box A', slots: [{ id: 's1', name: 'Slot 1' }, { id: 's2', name: 'Slot 2' }] },
    ]);
    expect(hp.brand).toBe('virtual');
    expect(hp.is_virtual).toBe(true);
    expect(hp.prefix).toBe('virtual_p1');
    expect(hp.name).toBe('Dry Box A');
    expect(hp.external_spools).toEqual([]);
    expect(hp.ams_units).toHaveLength(1);
    expect(hp.ams_units[0].trays).toHaveLength(2);
    // tray keys must equal the synthetic assignment key (used in extra.active_tray)
    expect(hp.ams_units[0].trays[0].unique_id).toBe('virtual:p1:s1');
    expect(hp.ams_units[0].trays[0].entity_id).toBe('virtual:p1:s1');
    expect(hp.ams_units[0].trays[1].unique_id).toBe('virtual:p1:s2');
  });

  it('produces no AMS group for a printer with zero slots', () => {
    const [hp] = virtualPrintersToHAPrinters([{ id: 'p2', name: 'Empty', slots: [] }]);
    expect(hp.ams_units).toEqual([]);
    expect(hp.external_spools).toEqual([]);
  });

  it('maps each printer in the list', () => {
    const result = virtualPrintersToHAPrinters([
      { id: 'a', name: 'A', slots: [{ id: 's', name: 'S' }] },
      { id: 'b', name: 'B', slots: [] },
    ]);
    expect(result).toHaveLength(2);
    expect(result.map((p) => p.prefix)).toEqual(['virtual_a', 'virtual_b']);
  });
});
