import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';

/**
 * GET /api/vendors
 *
 * Returns all vendors from the connected Spoolman instance.
 */
export async function GET() {
  try {
    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();

    if (!spoolmanConnection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(spoolmanConnection.url);
    const vendors = await client.getVendors();

    return NextResponse.json({ vendors });
  } catch (error) {
    console.error('Error fetching vendors:', error);
    return NextResponse.json({ error: 'Failed to fetch vendors' }, { status: 500 });
  }
}
