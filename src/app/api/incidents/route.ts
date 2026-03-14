import { NextResponse } from 'next/server';
import type { ApiResponse, Incident } from '@/types/incident';
import { listIncidents } from '@/lib/incidents';
import { logger } from '@/lib/logger';

export async function GET(): Promise<NextResponse<ApiResponse<Incident[]>>> {
  try {
    const incidents = await listIncidents();
    return NextResponse.json({ success: true, data: incidents });
  } catch (err) {
    logger.error('GET /api/incidents error', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
