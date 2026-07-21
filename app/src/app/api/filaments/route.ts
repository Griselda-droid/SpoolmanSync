import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';

/**
 * GET /api/filaments
 *
 * Returns all filaments from the connected Spoolman instance.
 */
export async function GET() {
  try {
    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();

    if (!spoolmanConnection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(spoolmanConnection.url);
    const filaments = await client.getFilaments();

    return NextResponse.json({ filaments });
  } catch (error) {
    console.error('Error fetching filaments:', error);
    return NextResponse.json({ error: 'Failed to fetch filaments' }, { status: 500 });
  }
}
