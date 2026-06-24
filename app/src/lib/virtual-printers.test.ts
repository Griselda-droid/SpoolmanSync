import { describe, it, expect } from 'vitest';
import {
  virtualSlotKey,
  nextSlotNumber,
  virtualPrintersToHAPrinters,
  VIRTUAL_KEY_PREFIX,
} from './virtual-printers';

describe('virtualSlotKey (issue #70 — friendly key)', () => {
  it('builds a readable underscore-delimited key mirroring real AMS keys', () => {
    expect(virtualSlotKey('Dry Box A', 1)).toBe('virtual_Dry Box A_tray_1');
    expect(virtualSlotKey('Dryer', 3)).toBe('virtual_Dryer_tray_3');
  });

  it('never starts with sensor. (so it bypasses the entity_id resolver)', () => {
    const key = virtualSlotKey('Anything', 2);
    expect(key.startsWith('sensor.')).toBe(false);
    expect(key.startsWith(VIRTUAL_KEY_PREFIX)).toBe(true);
  });
});

describe('nextSlotNumber (stable, never reused)', () => {
  it('returns 1 for an empty printer', () => {
    expect(nextSlotNumber([])).toBe(1);
  });
  it('returns max+1, so removing a middle slot never reuses a number', () => {
    expect(nextSlotNumber([{ id: 'a', number: 1 }, { id: 'c', number: 3 }])).toBe(4);
  });
});

describe('virtualPrintersToHAPrinters (issue #67/#70)', () => {
  it('maps slots to "Tray N" trays keyed by the friendly key', () => {
    const [hp] = virtualPrintersToHAPrinters([
      { id: 'p1', name: 'Dry Box A', slots: [{ id: 's1', number: 1 }, { id: 's2', number: 2 }] },
    ]);
    expect(hp.brand).toBe('virtual');
    expect(hp.is_virtual).toBe(true);
    expect(hp.name).toBe('Dry Box A');
    expect(hp.external_spools).toEqual([]);
    expect(hp.ams_units).toHaveLength(1);
    expect(hp.ams_units[0].trays).toHaveLength(2);

    const t0 = hp.ams_units[0].trays[0];
    expect(t0.unique_id).toBe('virtual_Dry Box A_tray_1');
    expect(t0.entity_id).toBe('virtual_Dry Box A_tray_1');
    expect(t0.tray_number).toBe(1);
    // not flagged external → renders as "Tray 1", not "External"
    expect(t0.is_external).toBeUndefined();

    expect(hp.ams_units[0].trays[1].unique_id).toBe('virtual_Dry Box A_tray_2');
  });

  it('keeps a stable key when a non-final slot is removed (uses slot.number, not index)', () => {
    const [hp] = virtualPrintersToHAPrinters([
      { id: 'p1', name: 'Dryer', slots: [{ id: 's1', number: 1 }, { id: 's3', number: 3 }] },
    ]);
    expect(hp.ams_units[0].trays.map((t) => t.unique_id)).toEqual([
      'virtual_Dryer_tray_1',
      'virtual_Dryer_tray_3',
    ]);
  });

  it('produces no AMS group for a printer with zero slots', () => {
    const [hp] = virtualPrintersToHAPrinters([{ id: 'p2', name: 'Empty', slots: [] }]);
    expect(hp.ams_units).toEqual([]);
    expect(hp.external_spools).toEqual([]);
  });
});
