import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';

export async function POST() {
  try {
    const connection = await prisma.spoolmanConnection.findFirst();
    if (!connection) return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });

    const client = new SpoolmanClient(connection.url);
    const [filaments, spools] = await Promise.all([
      client.getFilaments(),
      client.getSpools(true),
    ]);
    const usedIds = new Set(spools.map((spool) => spool.filament.id));
    const unused = filaments.filter((filament) => !usedIds.has(filament.id));
    for (const filament of unused) await client.deleteFilament(filament.id);

    return NextResponse.json({ deleted: unused.map((filament) => filament.id), count: unused.length });
  } catch (error) {
    console.error('Error cleaning unused filaments:', error);
    return NextResponse.json({ error: 'Failed to clean unused filaments' }, { status: 500 });
  }
}