import { describe, it, expect } from 'vitest';
import {
  realTrayLocationLabel,
  virtualLocationLabel,
  truncateLocation,
  SPOOLMAN_LOCATION_MAX,
} from './spool-location';
import { bambuFilamentId, bambuTrayBrand, bambuTrayFilamentSettings } from './api/homeassistant';

describe('bambuTrayBrand', () => {
  it('uses Bambu for the Bambu vendor regardless of case or whitespace', () => {
    expect(bambuTrayBrand(' Bambu ')).toBe('Bambu');
    expect(bambuTrayBrand(' Bambu Lab ')).toBe('Bambu');
  });

  it('uses Generic for every other vendor', () => {
    expect(bambuTrayBrand('SUNLU')).toBe('Generic');
    expect(bambuTrayBrand(undefined)).toBe('Generic');
  });
});

describe('bambu filament profiles', () => {
  it('uses the PLA Silk profile instead of the previous tray profile', () => {
    expect(bambuFilamentId('PLA SILK', 'Bambu', 'GFG00')).toBe('GFA05');
    expect(bambuFilamentId('PLA SILK', 'Generic', 'GFG00')).toBe('GFL96');
    expect(bambuFilamentId('PLA SILK', 'Bambu', 'GFA00', 'Bambu PLA Silk', 'Bambu Lab')).toBe('GFA05');
    expect(bambuFilamentId('PLA SILK', 'Generic', 'GFA00', 'Generic PLA Silk', 'Generic')).toBe('GFL96');
    expect(bambuFilamentId('TPU 95A HF', 'Bambu', 'GFA00', 'Bambu TPU 95A HF', 'Bambu Lab')).toBe('GFU00');
    expect(bambuFilamentId('TPU 95A', 'Bambu', 'GFA00', 'Bambu TPU 95A', 'Bambu Lab')).toBe('GFU01');
    expect(bambuFilamentId('Bambu PLA Silk', 'Bambu', 'GFG00', 'Bambu PLA Silk 蓝绿', 'Bambu Lab')).toBe('GFA05');
    expect(bambuFilamentId('Bambu TPU 95A HF', 'Bambu', 'GFG00', 'Bambu Lab TPU 95A HF 红色', 'Bambu Lab')).toBe('GFU00');
    expect(bambuFilamentId('TPU 95A HF', 'Bambu', 'GFA00')).toBe('GFU00');
    expect(bambuTrayFilamentSettings('PLA SILK', '#70B8C2')).toEqual({
      material: 'PLA',
      color: '70B8C2FF',
    });
  });
});

describe('realTrayLocationLabel', () => {
  it('formats an AMS tray', () => {
    expect(realTrayLocationLabel('X1C', 'AMS 1', 3, false)).toBe('X1C - AMS 1 Tray 3');
  });

  it('formats an external spool', () => {
    expect(realTrayLocationLabel('P1S', 'AMS 1', 0, true)).toBe('P1S - External');
    // AMS name is ignored for external
    expect(realTrayLocationLabel('P1S', undefined, 0, true)).toBe('P1S - External');
  });

  it('falls back to "<Printer> - Tray N" when no AMS name', () => {
    expect(realTrayLocationLabel('Ender 3', undefined, 1, false)).toBe('Ender 3 - Tray 1');
    expect(realTrayLocationLabel('Ender 3', '  ', 1, false)).toBe('Ender 3 - Tray 1');
  });

  it('handles a missing printer name', () => {
    expect(realTrayLocationLabel('', 'AMS 1', 2, false)).toBe('Printer - AMS 1 Tray 2');
  });

  it('never exceeds Spoolman max length', () => {
    const longName = 'P'.repeat(200);
    const label = realTrayLocationLabel(longName, 'AMS 1', 3, false);
    expect(label.length).toBe(SPOOLMAN_LOCATION_MAX);
  });
});

describe('virtualLocationLabel', () => {
  it('is just the trimmed printer name', () => {
    expect(virtualLocationLabel('Dry Box A')).toBe('Dry Box A');
    expect(virtualLocationLabel('  Shelf 2  ')).toBe('Shelf 2');
  });

  it('truncates to max length', () => {
    expect(virtualLocationLabel('D'.repeat(100)).length).toBe(SPOOLMAN_LOCATION_MAX);
  });
});

describe('truncateLocation', () => {
  it('leaves short strings unchanged', () => {
    expect(truncateLocation('Shelf A')).toBe('Shelf A');
  });
  it('clamps to 64 chars', () => {
    expect(truncateLocation('x'.repeat(80))).toHaveLength(64);
  });
});
