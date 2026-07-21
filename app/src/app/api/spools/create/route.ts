import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';
import { createActivityLog } from '@/lib/activity-log';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filament_id, initial_weight, spool_weight, location, lot_nr, comment } = body;

    // Validate required fields
    if (typeof filament_id !== 'number' || !Number.isFinite(filament_id) || filament_id <= 0) {
      return NextResponse.json(
        { error: 'filament_id is required and must be a positive number' },
        { status: 400 }
      );
    }
    if (typeof initial_weight !== 'number' || !Number.isFinite(initial_weight) || initial_weight <= 0) {
      return NextResponse.json(
        { error: 'initial_weight is required and must be a positive number' },
        { status: 400 }
      );
    }

    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();
    if (!spoolmanConnection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(spoolmanConnection.url);

    const newSpool = await client.createSpool({
      filament_id,
      initial_weight,
      spool_weight: spool_weight ?? undefined,
      location: location || undefined,
      lot_nr: lot_nr || undefined,
      comment: comment || undefined,
    });

    // Log activity
    await createActivityLog({
      type: 'spool_created',
      message: `Created spool #${newSpool.id}: ${newSpool.filament.vendor?.name ?? ''} ${newSpool.filament.name} (${newSpool.filament.material})`,
      details: {
        spoolId: newSpool.id,
        filamentId: filament_id,
        initialWeight: initial_weight,
        filament: newSpool.filament,
      },
    });

    return NextResponse.json({ spool: newSpool });
  } catch (error) {
    console.error('Error creating spool:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create spool' },
      { status: 500 }
    );
  }
}
