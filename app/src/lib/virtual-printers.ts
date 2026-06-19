/**
 * Virtual printers (issue #67).
 *
 * A "virtual printer" is a user-defined storage location — a filament dryer, a
 * dry box, a shelf — that has no Home Assistant entity behind it. Its slots are
 * assignable exactly like real AMS trays, enabling QR/NFC-based inventory
 * management for filament that isn't loaded in a printer.
 *
 * Virtual printers are persisted as JSON in the Settings key/value table (no
 * schema migration needed). Their slots are assigned by an opaque key
 * `virtual:<printerId>:<slotId>` stored in Spoolman's extra.active_tray — the
 * same explicit-assignment model used for real trays. Because the key never
 * starts with `sensor.`, it bypasses the entity_id→unique_id resolver and is
 * never written into any HA automation, so virtual slots receive no usage
 * tracking (by design — dryers/dry boxes don't consume filament).
 */
import prisma from '@/lib/db';
import type { HAPrinter, HATray } from '@/lib/api/homeassistant';

export const VIRTUAL_PRINTERS_KEY = 'virtual_printers';
export const VIRTUAL_KEY_PREFIX = 'virtual:';

export interface VirtualSlot {
  id: string;
  name: string;
}

export interface VirtualPrinter {
  id: string;
  name: string;
  slots: VirtualSlot[];
}

/** Build the opaque assignment key for a virtual slot. */
export function virtualSlotKey(printerId: string, slotId: string): string {
  return `${VIRTUAL_KEY_PREFIX}${printerId}:${slotId}`;
}

/** Read and parse the stored virtual printers (always returns an array). */
export async function getVirtualPrinters(): Promise<VirtualPrinter[]> {
  const setting = await prisma.settings.findUnique({ where: { key: VIRTUAL_PRINTERS_KEY } });
  if (!setting?.value) return [];
  try {
    const parsed = JSON.parse(setting.value);
    if (!Array.isArray(parsed)) return [];
    // Defensive normalization — ignore malformed entries.
    return parsed
      .filter((p): p is VirtualPrinter => !!p && typeof p.id === 'string' && typeof p.name === 'string')
      .map((p) => ({
        id: p.id,
        name: p.name,
        slots: Array.isArray(p.slots)
          ? p.slots
              .filter((s: unknown): s is VirtualSlot => !!s && typeof (s as VirtualSlot).id === 'string')
              .map((s: VirtualSlot) => ({ id: s.id, name: typeof s.name === 'string' ? s.name : s.id }))
          : [],
      }));
  } catch {
    return [];
  }
}

/** Persist the full virtual-printers list. */
export async function saveVirtualPrinters(printers: VirtualPrinter[]): Promise<void> {
  const value = JSON.stringify(printers);
  await prisma.settings.upsert({
    where: { key: VIRTUAL_PRINTERS_KEY },
    create: { key: VIRTUAL_PRINTERS_KEY, value },
    update: { value },
  });
}

/**
 * Convert virtual printers into HAPrinter-shaped objects so they can be merged
 * into the dashboard's printer list and reuse the existing PrinterCard / TraySlot
 * rendering and assignment flow. Each slot becomes a tray keyed by its synthetic
 * assignment key.
 */
export function virtualPrintersToHAPrinters(printers: VirtualPrinter[]): HAPrinter[] {
  return printers.map((vp) => {
    const trays: HATray[] = vp.slots.map((slot, idx) => ({
      entity_id: virtualSlotKey(vp.id, slot.id),
      unique_id: virtualSlotKey(vp.id, slot.id),
      tray_number: idx + 1,
      is_external: true,
      name: slot.name,
    }));

    return {
      brand: 'virtual',
      is_virtual: true,
      entity_id: `${VIRTUAL_KEY_PREFIX}${vp.id}`,
      name: vp.name,
      state: 'idle',
      prefix: `virtual_${vp.id}`,
      ams_units: trays.length > 0
        ? [{ entity_id: `${VIRTUAL_KEY_PREFIX}${vp.id}:slots`, name: vp.name, ams_number: 1, trays }]
        : [],
      external_spools: [],
    };
  });
}
