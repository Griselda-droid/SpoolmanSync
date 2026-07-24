import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';
import { bambuFilamentId, bambuTrayBrand, bambuTrayFilamentSettings, HomeAssistantClient } from '@/lib/api/homeassistant';
import { formatCommentWithKValue, parseKValue } from '@/lib/k-value';

interface KValueUpdate {
  spoolId: number;
  kValue: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { updates?: KValueUpdate[]; syncPrinter?: boolean };
    if (!Array.isArray(body.updates) || body.updates.length === 0) {
      return NextResponse.json({ error: 'updates is required' }, { status: 400 });
    }

    const connection = await prisma.spoolmanConnection.findFirst();
    if (!connection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(connection.url);
    const haClient = body.syncPrinter ? await HomeAssistantClient.fromConnection() : null;
    const updated = [];
    let synced = 0;
    const syncWarnings: string[] = [];
    for (const update of body.updates) {
      if (!Number.isInteger(update.spoolId)) {
        return NextResponse.json({ error: 'spoolId must be an integer' }, { status: 400 });
      }
      if (update.kValue !== null && (!Number.isFinite(update.kValue) || update.kValue < 0 || update.kValue > 2)) {
        return NextResponse.json({ error: 'kValue must be between 0 and 2' }, { status: 400 });
      }

      const spool = await client.getSpool(update.spoolId);
      const saved = await client.updateSpool(update.spoolId, {
        comment: formatCommentWithKValue(spool.comment, update.kValue ?? undefined) || null,
      });
      updated.push(saved);

      if (haClient && update.kValue !== null) {
        let activeTray = '';
        try {
          const rawTray = saved.extra?.active_tray;
          const parsedTray = rawTray ? JSON.parse(rawTray) : '';
          if (typeof parsedTray === 'string') activeTray = parsedTray;
        } catch { /* Invalid active_tray means this spool is not syncable. */ }

        if (activeTray) {
          try {
            const printers = await haClient.discoverPrinters();
            const printer = printers.find((candidate) => candidate.brand === 'bambu_lab' && (
              candidate.ams_units.some((ams) => ams.trays.some((tray) => tray.unique_id === activeTray || tray.entity_id === activeTray))
              || candidate.external_spools.some((tray) => tray.unique_id === activeTray || tray.entity_id === activeTray)
            ));
            const tray = printer && [
              ...printer.ams_units.flatMap((ams) => ams.trays),
              ...printer.external_spools,
            ].find((candidate) => candidate.unique_id === activeTray || candidate.entity_id === activeTray);
            if (!tray) throw new Error(`HA tray not found: ${activeTray}`);

            await haClient.setBambuTrayBrand(
              tray,
              bambuTrayBrand(saved.filament.vendor?.name),
              bambuTrayFilamentSettings(
                saved.filament.material,
                saved.filament.color_hex,
                saved.filament.name,
                saved.filament.vendor?.name,
                parseKValue(saved.comment),
              ),
            );
            const profileId = bambuFilamentId(
              saved.filament.material,
              bambuTrayBrand(saved.filament.vendor?.name),
              tray.filament_id,
              saved.filament.name,
              saved.filament.vendor?.name,
            );
            const syncedProfile = await haClient.syncBambuTrayKValue(
              tray,
              printer?.device_id || undefined,
              profileId,
              update.kValue,
            );
            if (!syncedProfile) syncWarnings.push(`#${saved.id}: PA profile not synchronized`);
            else synced += 1;
          } catch (error) {
            syncWarnings.push(`#${saved.id}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }

    return NextResponse.json({ spools: updated, synced, syncWarnings });
  } catch (error) {
    console.error('Error updating spool K values:', error);
    return NextResponse.json({ error: 'Failed to update spool K values' }, { status: 500 });
  }
}