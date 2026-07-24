import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { SpoolmanClient } from '@/lib/api/spoolman';
import { createActivityLog } from '@/lib/activity-log';

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json() as { spoolId?: number };
    const spoolId = body.spoolId;
    if (typeof spoolId !== 'number' || !Number.isInteger(spoolId)) {
      return NextResponse.json({ error: 'spoolId is required and must be an integer' }, { status: 400 });
    }

    const connection = await prisma.spoolmanConnection.findFirst();
    if (!connection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(connection.url);
    await client.deleteSpool(spoolId);
    await createActivityLog({
      type: 'spool_change',
      message: `Deleted spool #${spoolId}`,
      details: { spoolId },
    });

    return NextResponse.json({ deleted: spoolId });
  } catch (error) {
    console.error('Error deleting spool:', error);
    return NextResponse.json({ error: 'Failed to delete spool' }, { status: 500 });
  }
}