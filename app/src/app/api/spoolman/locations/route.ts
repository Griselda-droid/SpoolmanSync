import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';

/**
 * Return the distinct, non-empty `location` values already in use across all
 * spools in Spoolman. Spoolman has no location-enumeration endpoint, so we
 * derive the list from spools (version-independent). Used to offer existing
 * locations as suggestions when creating a virtual printer, so names line up
 * with Spoolman's native location field.
 */
export async function GET() {
  try {
    const conn = await prisma.spoolmanConnection.findFirst();
    if (!conn) return NextResponse.json({ locations: [] });

    const client = new SpoolmanClient(conn.url);
    const spools = await client.getSpools(true); // include archived for full coverage

    const set = new Set<string>();
    for (const spool of spools) {
      const loc = (spool.location ?? '').trim();
      if (loc) set.add(loc);
    }
    const locations = [...set].sort((a, b) => a.localeCompare(b));
    return NextResponse.json({ locations });
  } catch (error) {
    // Non-fatal: the UI treats an empty list as "no suggestions".
    console.error('Error fetching Spoolman locations:', error);
    return NextResponse.json({ locations: [] });
  }
}
