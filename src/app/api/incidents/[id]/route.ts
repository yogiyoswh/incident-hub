import { NextRequest, NextResponse } from 'next/server';
import type { ApiResponse, Incident } from '@/types/incident';
import { getIncident } from '@/lib/incidents';
import { logger } from '@/lib/logger';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<Incident>>> {
  try {
    const { id } = await params;
    const incident = await getIncident(id);
    if (!incident) {
      return NextResponse.json({ success: false, error: 'Incident not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: incident });
  } catch (err) {
    logger.error('GET /api/incidents/[id] error', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
