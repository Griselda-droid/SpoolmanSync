/**
 * Spoolman `location` sync (issue: sync physical location into Spoolman).
 *
 * Spoolman has a native top-level `location` string field (max 64 chars). This
 * module keeps that field in step with where a spool physically is:
 *   - assigned to a real AMS/CFS tray  → "<Printer> - <AMS> Tray <N>" / "… - External"
 *   - assigned to a virtual printer    → the virtual printer's name (dry box/shelf)
 *
 * Design notes:
 * - OPT-IN. Everything here is a no-op unless the `sync_spoolman_location`
 *   setting is enabled, so existing users who manage locations manually are
 *   never touched until they turn it on.
 * - The write happens through an injected resolver on SpoolmanClient (mirroring
 *   the existing entityIdResolver), so every assign/unassign path — webhook
 *   auto-assign/clear and manual UI assign/unassign — inherits it from one place.
 * - Clearing on unassign is GUARDED: the client only wipes `location` if it still
 *   equals the label we would have set for the tray being left. A location a user
 *   changed by hand is left alone.
 */
import prisma from '@/lib/db';
import { HomeAssistantClient } from '@/lib/api/homeassistant';
import { getVirtualPrinters, virtualSlotKey } from '@/lib/virtual-printers';
import type { LocationResolver } from '@/lib/api/spoolman';

/** Settings key for the opt-in toggle. */
export const LOCATION_SYNC_KEY = 'sync_spoolman_location';
/** Spoolman's `location` field is `str | None` with max_length 64. */
export const SPOOLMAN_LOCATION_MAX = 64;

export async function isLocationSyncEnabled(): Promise<boolean> {
  const s = await prisma.settings.findUnique({ where: { key: LOCATION_SYNC_KEY } });
  return s?.value === 'true';
}

/** Clamp any location string to Spoolman's 64-char limit. */
export function truncateLocation(value: string): string {
  return value.length > SPOOLMAN_LOCATION_MAX ? value.slice(0, SPOOLMAN_LOCATION_MAX) : value;
}

/**
 * Human-readable location label for a real printer tray, e.g.
 *   "X1C - AMS 1 Tray 3", "P1S - External".
 * Falls back to "<Printer> - Tray <N>" when no AMS name is available.
 */
export function realTrayLocationLabel(
  printerName: string,
  amsName: string | undefined,
  trayNumber: number,
  isExternal: boolean,
): string {
  const name = (printerName || 'Printer').trim();
  let label: string;
  if (isExternal) {
    label = `${name} - External`;
  } else if (amsName && amsName.trim()) {
    label = `${name} - ${amsName.trim()} Tray ${trayNumber}`;
  } else {
    label = `${name} - Tray ${trayNumber}`;
  }
  return truncateLocation(label);
}

/** Location label for a virtual printer (dry box / shelf) — just its name. */
export function virtualLocationLabel(printerName: string): string {
  return truncateLocation((printerName || '').trim());
}

/**
 * Build a resolver mapping a tray key (unique_id, entity_id, or virtual slot key)
 * to its location label. Returns null when location sync is disabled, which tells
 * SpoolmanClient to leave the `location` field untouched entirely.
 *
 * Discovery (virtual printers + HA printers) runs lazily on first lookup and is
 * cached for the lifetime of the resolver, so a single webhook/request only pays
 * the cost once regardless of how many spools it touches.
 */
export async function makeLocationResolver(): Promise<LocationResolver | null> {
  if (!(await isLocationSyncEnabled())) return null;

  let cache: Map<string, string> | null = null;

  const build = async (): Promise<Map<string, string>> => {
    const map = new Map<string, string>();

    // Virtual printers (dry boxes / shelves) — keyed by the friendly slot key.
    try {
      const vps = await getVirtualPrinters();
      for (const vp of vps) {
        const label = virtualLocationLabel(vp.name);
        if (!label) continue;
        for (const slot of vp.slots) {
          map.set(virtualSlotKey(vp.name, slot.number), label);
        }
      }
    } catch (err) {
      console.warn('[location-sync] Could not load virtual printers:', err);
    }

    // Real printers — keyed by BOTH unique_id and entity_id so we resolve
    // regardless of which form a caller passes (assignments are stored by
    // unique_id, but pre-migration spools and some paths use entity_ids).
    try {
      const ha = await HomeAssistantClient.fromConnection();
      if (ha) {
        const printers = await ha.discoverPrinters();
        for (const p of printers) {
          if (p.is_virtual) continue; // handled above
          for (const ams of p.ams_units) {
            for (const t of ams.trays) {
              const label = realTrayLocationLabel(p.name, ams.name, t.tray_number, false);
              if (t.unique_id) map.set(t.unique_id, label);
              if (t.entity_id) map.set(t.entity_id, label);
            }
          }
          for (const ext of p.external_spools) {
            const label = realTrayLocationLabel(p.name, undefined, ext.tray_number, true);
            if (ext.unique_id) map.set(ext.unique_id, label);
            if (ext.entity_id) map.set(ext.entity_id, label);
          }
        }
      }
    } catch (err) {
      console.warn('[location-sync] Could not discover HA printers for location labels:', err);
    }

    return map;
  };

  return async (trayKey: string): Promise<string> => {
    if (!cache) cache = await build();
    return cache.get(trayKey) ?? '';
  };
}
