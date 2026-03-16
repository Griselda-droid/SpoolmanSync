import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { HomeAssistantClient, HATray } from '@/lib/api/homeassistant';
import { SpoolmanClient, Spool } from '@/lib/api/spoolman';
import { getHiddenPrinters } from '@/app/api/printers/setup/route';

interface MismatchInfo {
  type: 'material' | 'color' | 'both';
  printerReports: {
    material?: string;
    color?: string;
  };
  spoolmanHas: {
    material: string;
    color: string;
  };
  message: string;
}

/**
 * Detect if the printer's RFID data doesn't match the assigned spool
 * This helps users catch mistakes before printing with the wrong filament
 *
 * Compares material type and hex color code. The RFID color includes an alpha
 * channel (e.g., "#042f56ff") while Spoolman uses 6-char hex (e.g., "#042f56"),
 * so we compare only the first 6 hex characters.
 *
 * Note: Only works for Bambu spools with RFID tags. Non-Bambu spools
 * won't have printer-reported data to compare against.
 */
function detectTrayMismatch(tray: HATray, assignedSpool: Spool): MismatchInfo | null {
  // Skip mismatch detection for non-RFID spools. ha-bambulab reports tray_uuid
  // as all zeros for third-party spools without RFID tags. The color/material
  // data for these is user-configured in Bambu Studio (not from RFID), so it
  // won't reliably match Spoolman's vendor data and would cause false warnings.
  const uuid = tray.tray_uuid?.replace(/0/g, '') || '';
  if (!uuid) {
    return null;
  }

  // If the tray has no material reported by printer, can't detect mismatch
  const trayName = tray.name?.toLowerCase().trim() || '';
  if (!trayName || trayName === 'empty') {
    return null;
  }

  const printerMaterial = tray.material?.toUpperCase() || '';
  const spoolMaterial = assignedSpool.filament?.material?.toUpperCase() || '';

  // Compare base material tokens (first word) so variants like "PLA Matte"
  // and "PLA Silk+" are treated as compatible with "PLA", while
  // materials like "PLA-CF" remain distinct from "PLA".
  const basePrinterMaterial = printerMaterial.split(/\s+/)[0] || '';
  const baseSpoolMaterial = spoolMaterial.split(/\s+/)[0] || '';

  // Get hex colors - RFID may have alpha channel (8 chars), Spoolman has 6 chars
  // Compare only first 6 characters (RGB, ignore alpha)
  const rfidColor = tray.color?.replace('#', '').toLowerCase().substring(0, 6) || '';
  const spoolColor = assignedSpool.filament?.color_hex?.toLowerCase().substring(0, 6) || '';

  // Check for material mismatch
  const materialMismatch =
    basePrinterMaterial &&
    baseSpoolMaterial &&
    basePrinterMaterial !== baseSpoolMaterial;

  // Check for color mismatch (exact match on first 6 hex chars)
  const colorMismatch = rfidColor && spoolColor && rfidColor !== spoolColor;

  if (!materialMismatch && !colorMismatch) {
    return null;
  }

  // Build mismatch info
  const mismatchType: 'material' | 'color' | 'both' =
    materialMismatch && colorMismatch ? 'both' :
    materialMismatch ? 'material' : 'color';

  return {
    type: mismatchType,
    printerReports: {
      material: tray.material,
      color: `#${rfidColor}`,
    },
    spoolmanHas: {
      material: assignedSpool.filament?.material || '',
      color: `#${spoolColor}`,
    },
    message: `Mismatch detected: ${mismatchType}`,
  };
}

export async function GET() {
  try {
    const haClient = await HomeAssistantClient.fromConnection();
    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();

    if (!haClient) {
      return NextResponse.json({ error: 'Home Assistant not configured' }, { status: 400 });
    }

    const allPrinters = await haClient.discoverPrinters();

    // Filter out printers removed from SpoolmanSync
    const hiddenPrintersList = await getHiddenPrinters();
    const hiddenTitles = new Set(hiddenPrintersList.map(h => h.title.toLowerCase()).filter(Boolean));

    const printers = hiddenTitles.size > 0
      ? allPrinters.filter(p => {
          const name = p.name.toLowerCase();
          const entityId = p.entity_id.toLowerCase();
          return ![...hiddenTitles].some(t => name.includes(t) || entityId.includes(t));
        })
      : allPrinters;

    // If Spoolman is configured, enrich with spool data
    if (spoolmanConnection) {
      const spoolmanClient = new SpoolmanClient(spoolmanConnection.url);
      const spools = await spoolmanClient.getSpools();

      // Create a map of tray ID to spool
      const traySpoolMap = new Map<string, typeof spools[0]>();
      for (const spool of spools) {
        const trayId = spool.extra?.['active_tray'];
        // Skip empty, null, or missing active_tray values
        // Values are JSON-encoded, so empty string is '""', null is 'null'
        if (trayId && trayId !== '' && trayId !== 'null' && trayId !== '""' && trayId !== '\"\"') {
          // Remove JSON quotes from tray ID
          const cleanTrayId = trayId.replace(/^"|"$/g, '');
          if (cleanTrayId) {
            traySpoolMap.set(cleanTrayId, spool);
          }
        }
      }

      // Enrich printer data with spool info and mismatch detection
      for (const printer of printers) {
        for (const ams of printer.ams_units) {
          for (const tray of ams.trays) {
            const assignedSpool = traySpoolMap.get(tray.entity_id);
            const trayRecord = tray as unknown as Record<string, unknown>;

            if (assignedSpool) {
              trayRecord.assigned_spool = assignedSpool;

              // Mismatch detection: compare printer's RFID data with assigned spool
              // Only meaningful for Bambu spools with RFID tags
              const mismatch = detectTrayMismatch(tray, assignedSpool);
              if (mismatch) {
                trayRecord.mismatch = mismatch;
              }
            }
          }
        }
        for (const extSpool of printer.external_spools) {
          const assignedSpool = traySpoolMap.get(extSpool.entity_id);
          if (assignedSpool) {
            const extRecord = extSpool as unknown as Record<string, unknown>;
            extRecord.assigned_spool = assignedSpool;

            // External spool doesn't have RFID reader, so no mismatch detection
          }
        }
      }
    }

    return NextResponse.json({ printers });
  } catch (error) {
    console.error('Error fetching printers:', error);
    return NextResponse.json({ error: 'Failed to fetch printers' }, { status: 500 });
  }
}
