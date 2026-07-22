import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';
import { bambuTrayBrand, bambuTrayFilamentSettings, HomeAssistantClient, type HATray } from '@/lib/api/homeassistant';
import { createActivityLog } from '@/lib/activity-log';
import { makeLocationResolver } from '@/lib/spool-location';
import { parseKValue } from '@/lib/k-value';

export async function GET() {
  try {
    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();

    if (!spoolmanConnection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(spoolmanConnection.url);
    const spools = await client.getSpools();

    // Filter out archived spools
    const activeSpools = spools.filter(s => !s.archived);

    return NextResponse.json({ spools: activeSpools });
  } catch (error) {
    console.error('Error fetching spools:', error);
    return NextResponse.json({ error: 'Failed to fetch spools' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { spoolId, trayId } = body;

    // Validate inputs before touching Spoolman to avoid malformed requests / 500s
    if (typeof spoolId !== 'number' || !Number.isFinite(spoolId)) {
      return NextResponse.json({ error: 'spoolId is required and must be a number' }, { status: 400 });
    }
    if (typeof trayId !== 'string' || trayId.trim() === '') {
      return NextResponse.json({ error: 'trayId is required and must be a non-empty string' }, { status: 400 });
    }

    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();

    if (!spoolmanConnection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(spoolmanConnection.url);

    // Wire up entity_id → unique_id resolver for defense-in-depth
    let entityIdMap: Map<string, string> | null = null;
    client.setEntityIdResolver(async (entityId: string) => {
      if (!entityIdMap) {
        try {
          const haClient = await HomeAssistantClient.fromConnection();
          if (haClient) entityIdMap = await haClient.getEntityIdToUniqueIdMap();
        } catch { /* best-effort */ }
        if (!entityIdMap) entityIdMap = new Map();
      }
      return entityIdMap.get(entityId) || entityId;
    });

    // Location sync (no-op unless enabled) — keep Spoolman's location field in
    // step with the tray this spool is being assigned to.
    const locationResolver = await makeLocationResolver();
    if (locationResolver) client.setLocationResolver(locationResolver);

    const haClient = await HomeAssistantClient.fromConnection();
    let haTray: HATray | undefined;
    if (haClient) {
      const printer = (await haClient.discoverPrinters()).find((candidate) =>
        candidate.brand === 'bambu_lab' && !candidate.is_virtual && (
          candidate.ams_units.some((ams) => ams.trays.some((tray) => tray.unique_id === trayId || tray.entity_id === trayId)) ||
          candidate.external_spools.some((tray) => tray.unique_id === trayId || tray.entity_id === trayId)
        )
      );
      const tray = printer && [
        ...printer.ams_units.flatMap((ams) => ams.trays),
        ...printer.external_spools,
      ].find((candidate) => candidate.unique_id === trayId || candidate.entity_id === trayId);
      haTray = tray;
      if (haTray?.empty === true) {
        return NextResponse.json({ error: '该料盘未安装耗材，请先安装料盘后再分配。' }, { status: 409 });
      }
    }

    const updatedSpool = await client.assignSpoolToTray(spoolId, trayId);
    const kValue = parseKValue(updatedSpool.comment);

    console.info('[Spool assignment] spool metadata', {
      spool_id: spoolId,
      comment: updatedSpool.comment || null,
      parsed_k_value: kValue ?? null,
    });

    if (haClient) {
      console.info('[Spool assignment] HA tray lookup', {
        spool_id: spoolId,
        requested_tray: trayId,
        matched_tray: haTray?.entity_id || null,
        brand: bambuTrayBrand(updatedSpool.filament.vendor?.name),
      });
      if (haTray) {
        await haClient.setBambuTrayBrand(
          haTray,
          bambuTrayBrand(updatedSpool.filament.vendor?.name),
          bambuTrayFilamentSettings(
            updatedSpool.filament.material,
            updatedSpool.filament.color_hex,
            updatedSpool.filament.name,
            updatedSpool.filament.vendor?.name,
            kValue,
          ),
        );
      }
    }

    // Log activity
    await createActivityLog({
      type: 'spool_change',
      message: `Assigned spool #${spoolId} to tray ${trayId}`,
      details: { spoolId, trayId },
    });

    return NextResponse.json({ spool: updatedSpool });
  } catch (error) {
    console.error('Error assigning spool:', error);
    return NextResponse.json({ error: 'Failed to assign spool' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { spoolId } = body;

    // Validate inputs before touching Spoolman to avoid malformed requests / 500s
    if (typeof spoolId !== 'number' || !Number.isFinite(spoolId)) {
      return NextResponse.json({ error: 'spoolId is required and must be a number' }, { status: 400 });
    }

    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();

    if (!spoolmanConnection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(spoolmanConnection.url);

    // Wire up entity_id → unique_id resolver for defense-in-depth
    let deleteEntityIdMap: Map<string, string> | null = null;
    client.setEntityIdResolver(async (entityId: string) => {
      if (!deleteEntityIdMap) {
        try {
          const haClient = await HomeAssistantClient.fromConnection();
          if (haClient) deleteEntityIdMap = await haClient.getEntityIdToUniqueIdMap();
        } catch { /* best-effort */ }
        if (!deleteEntityIdMap) deleteEntityIdMap = new Map();
      }
      return deleteEntityIdMap.get(entityId) || entityId;
    });

    // Location sync (no-op unless enabled) — the guarded clear in
    // unassignSpoolFromTray only wipes location if we set it.
    const locationResolver = await makeLocationResolver();
    if (locationResolver) client.setLocationResolver(locationResolver);

    const updatedSpool = await client.unassignSpoolFromTray(spoolId);

    // Log activity
    await createActivityLog({
      type: 'spool_change',
      message: `Unassigned spool #${spoolId} from tray`,
      details: { spoolId },
    });

    return NextResponse.json({ spool: updatedSpool });
  } catch (error) {
    console.error('Error unassigning spool:', error);
    return NextResponse.json({ error: 'Failed to unassign spool' }, { status: 500 });
  }
}
