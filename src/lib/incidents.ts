import fs from 'fs/promises';
import path from 'path';
import type { Incident } from '@/types/incident';
import { logger } from '@/lib/logger';

const DATA_DIR = path.join(process.cwd(), 'data', 'incidents');

async function ensureDataDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function getIncident(id: string): Promise<Incident | null> {
  try {
    const filePath = path.join(DATA_DIR, `${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Incident;
  } catch {
    return null;
  }
}

export async function listIncidents(): Promise<Incident[]> {
  try {
    await ensureDataDir();
    const files = await fs.readdir(DATA_DIR);
    const jsonFiles = files.filter((f) => f.endsWith('.json'));

    const incidents = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
        return JSON.parse(content) as Incident;
      }),
    );

    return incidents.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  } catch (err) {
    logger.error('listIncidents failed', err);
    return [];
  }
}

export async function saveIncident(incident: Incident): Promise<void> {
  await ensureDataDir();
  const filePath = path.join(DATA_DIR, `${incident.id}.json`);
  await fs.writeFile(filePath, JSON.stringify(incident, null, 2), 'utf-8');
}

export async function updateIncident(
  id: string,
  updates: Partial<Incident>,
): Promise<Incident> {
  const existing = await getIncident(id);
  if (!existing) {
    throw new Error(`Incident not found: ${id}`);
  }
  const updated: Incident = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  await saveIncident(updated);
  return updated;
}
