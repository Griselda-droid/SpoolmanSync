import { NextResponse } from 'next/server';
import filamentProfiles from '@/lib/filaments_detail.json';

export interface FilamentProfile {
  name: string;
  filament_vendor: string;
  filament_type: string;
  filament_density: number;
  nozzle_temperature: number;
  nozzle_temperature_range_high: number;
  nozzle_temperature_range_low: number;
}

export async function GET() {
  return NextResponse.json({ profiles: filamentProfiles as Record<string, FilamentProfile> });
}