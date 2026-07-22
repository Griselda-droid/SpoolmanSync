import { NextRequest, NextResponse } from 'next/server';
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

/**
 * POST /api/filaments
 *
 * Creates a new filament in the connected Spoolman instance.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, material, vendor, vendor_id, color_hex, density, diameter } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '耗材名称不能为空' }, { status: 400 });
    }

    const spoolmanConnection = await prisma.spoolmanConnection.findFirst();

    if (!spoolmanConnection) {
      return NextResponse.json({ error: 'Spoolman not configured' }, { status: 400 });
    }

    const client = new SpoolmanClient(spoolmanConnection.url);

    // Resolve vendor: use vendor_id if provided, otherwise look up by name
    let resolvedVendorId = vendor_id || undefined;
    const vendorName = (typeof vendor === 'string' ? vendor.trim() : '') || undefined;

    if (!resolvedVendorId && vendorName) {
      try {
        const vendors = await client.getVendors();
        const existing = vendors.find(
          (v) => v.name.toLowerCase() === vendorName.toLowerCase()
        );
        if (existing) {
          resolvedVendorId = existing.id;
        } else {
          // Create new vendor
          const newVendor = await client.createVendor(vendorName);
          resolvedVendorId = newVendor.id;
        }
      } catch (err) {
        console.warn('Failed to resolve vendor, proceeding without:', err);
      }
    }

    const filament = await client.createFilament({
      name: name.trim(),
      material: material?.trim() || undefined,
      vendor_id: resolvedVendorId,
      color_hex: color_hex || undefined,
      density: density || undefined,
      diameter: diameter || undefined,
    });

    return NextResponse.json({ filament }, { status: 201 });
  } catch (error) {
    console.error('Error creating filament:', error);
    return NextResponse.json({ error: 'Failed to create filament' }, { status: 500 });
  }
}
