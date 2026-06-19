import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@/lib/db';
import {
  getVirtualPrinters,
  saveVirtualPrinters,
  virtualSlotKey,
  VirtualPrinter,
  VirtualSlot,
} from '@/lib/virtual-printers';
import { SpoolmanClient } from '@/lib/api/spoolman';
import { createActivityLog } from '@/lib/activity-log';

const MAX_SLOTS = 16;

/**
 * Best-effort: clear Spoolman assignments for a set of (now-removed) virtual
 * slot keys, so deleting a virtual printer/slot doesn't leave orphaned
 * extra.active_tray values pointing at slots that no longer exist.
 */
async function unassignSlotKeys(slotKeys: string[]): Promise<void> {
  if (slotKeys.length === 0) return;
  try {
    const conn = await prisma.spoolmanConnection.findFirst();
    if (!conn) return;
    const client = new SpoolmanClient(conn.url);
    const spools = await client.getSpools();
    const jsonKeys = new Set(slotKeys.map((k) => JSON.stringify(k)));
    for (const spool of spools) {
      const raw = spool.extra?.['active_tray'];
      if (raw && jsonKeys.has(raw)) {
        await client.unassignSpoolFromTray(spool.id);
      }
    }
  } catch (err) {
    console.error('Failed to unassign spools from removed virtual slots:', err);
  }
}

export async function GET() {
  try {
    const virtualPrinters = await getVirtualPrinters();
    return NextResponse.json({ virtualPrinters });
  } catch (error) {
    console.error('Error fetching virtual printers:', error);
    return NextResponse.json({ error: 'Failed to fetch virtual printers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const name = (body.name ?? '').toString().trim();
    if (!name) {
      return NextResponse.json({ error: 'A name is required' }, { status: 400 });
    }
    const slotCount = Math.min(Math.max(parseInt(body.slotCount, 10) || 1, 1), MAX_SLOTS);

    const printers = await getVirtualPrinters();
    const slots: VirtualSlot[] = Array.from({ length: slotCount }, (_, i) => ({
      id: randomUUID(),
      name: `Slot ${i + 1}`,
    }));
    const printer: VirtualPrinter = { id: randomUUID(), name, slots };
    printers.push(printer);
    await saveVirtualPrinters(printers);

    await createActivityLog({
      type: 'virtual_printer_created',
      message: `Created virtual printer "${name}" with ${slotCount} slot(s)`,
      details: { id: printer.id, slotCount },
    });

    return NextResponse.json({ success: true, virtualPrinter: printer });
  } catch (error) {
    console.error('Error creating virtual printer:', error);
    return NextResponse.json({ error: 'Failed to create virtual printer' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const id = (body.id ?? '').toString();
    if (!id) {
      return NextResponse.json({ error: 'A printer id is required' }, { status: 400 });
    }

    const printers = await getVirtualPrinters();
    const printer = printers.find((p) => p.id === id);
    if (!printer) {
      return NextResponse.json({ error: 'Virtual printer not found' }, { status: 404 });
    }

    if (typeof body.name === 'string' && body.name.trim()) {
      printer.name = body.name.trim();
    }

    // If a full slots array is supplied, replace it (preserving ids the client
    // sends so existing assignments stay valid) and clear assignments for any
    // slot that was removed.
    if (Array.isArray(body.slots)) {
      const oldKeys = new Set(printer.slots.map((s) => virtualSlotKey(printer.id, s.id)));
      const newSlots: VirtualSlot[] = body.slots
        .filter((s: unknown): s is { id?: string; name?: unknown } => !!s && typeof s === 'object')
        .slice(0, MAX_SLOTS)
        .map((s: { id?: string; name?: unknown }) => ({
          id: typeof s.id === 'string' && s.id ? s.id : randomUUID(),
          name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : 'Slot',
        }));
      printer.slots = newSlots;

      const newKeys = new Set(newSlots.map((s) => virtualSlotKey(printer.id, s.id)));
      const removedKeys = [...oldKeys].filter((k) => !newKeys.has(k));
      await unassignSlotKeys(removedKeys);
    }

    await saveVirtualPrinters(printers);
    return NextResponse.json({ success: true, virtualPrinter: printer });
  } catch (error) {
    console.error('Error updating virtual printer:', error);
    return NextResponse.json({ error: 'Failed to update virtual printer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const id = (body.id ?? '').toString();
    if (!id) {
      return NextResponse.json({ error: 'A printer id is required' }, { status: 400 });
    }

    const printers = await getVirtualPrinters();
    const removed = printers.find((p) => p.id === id);
    if (!removed) {
      return NextResponse.json({ error: 'Virtual printer not found' }, { status: 404 });
    }

    await saveVirtualPrinters(printers.filter((p) => p.id !== id));
    await unassignSlotKeys(removed.slots.map((s) => virtualSlotKey(removed.id, s.id)));

    await createActivityLog({
      type: 'virtual_printer_deleted',
      message: `Deleted virtual printer "${removed.name}"`,
      details: { id: removed.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting virtual printer:', error);
    return NextResponse.json({ error: 'Failed to delete virtual printer' }, { status: 500 });
  }
}
