import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import type {
  WhereTheISSApiResponse,
  SatellitesApiResponse,
  SpaceObject,
  CelesTrakOMMRecord,
} from '@/types/satellite';
import {
  propagateOMMToSpaceObject,
  classifyOrbitalObject,
} from '@/lib/satellite-propagator';

const ISS_API_URL = 'https://api.wheretheiss.at/v1/satellites/25544';
const CELESTRAK_API_URL =
  'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json';

export const dynamic = 'force-dynamic';

// In-memory cache for CelesTrak records to prevent 403 rate-limits (2 hours TTL)
let memoryCache: {
  records: CelesTrakOMMRecord[];
  timestamp: number;
} | null = null;

const CACHE_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Loads CelesTrak OMM records either from live API, in-memory cache, or disk fallback
 */
async function getCelesTrakRecords(): Promise<{
  records: CelesTrakOMMRecord[];
  isCached: boolean;
}> {
  const now = Date.now();

  // 1. Return in-memory cache if fresh
  if (memoryCache && now - memoryCache.timestamp < CACHE_TTL_MS) {
    return { records: memoryCache.records, isCached: true };
  }

  // 2. Try fetching from CelesTrak API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(CELESTRAK_API_URL, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'SpaceDebrisTracker-NextJS/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        memoryCache = {
          records: data as CelesTrakOMMRecord[],
          timestamp: now,
        };

        // Asynchronously persist to disk cache
        try {
          const cacheDir = path.join(process.cwd(), 'data');
          if (!fs.existsSync(cacheDir)) {
            fs.mkdirSync(cacheDir, { recursive: true });
          }
          fs.writeFileSync(
            path.join(cacheDir, 'celestrak-cache.json'),
            JSON.stringify(data)
          );
        } catch {}

        return { records: memoryCache.records, isCached: false };
      }
    }
  } catch (fetchErr) {
    console.warn('CelesTrak live fetch failed or rate-limited, checking disk cache:', fetchErr);
  }

  // 3. Fallback to persisted disk cache if available
  try {
    const cacheFilePath = path.join(process.cwd(), 'data', 'celestrak-cache.json');
    if (fs.existsSync(cacheFilePath)) {
      const fileData = fs.readFileSync(cacheFilePath, 'utf8');
      const parsed = JSON.parse(fileData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache = {
          records: parsed as CelesTrakOMMRecord[],
          timestamp: now,
        };
        return { records: memoryCache.records, isCached: true };
      }
    }
  } catch (diskErr) {
    console.warn('Failed reading disk cache:', diskErr);
  }

  return { records: [], isCached: false };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'combined'; // 'iss' | 'celestrak' | 'combined'
  const limitParam = parseInt(searchParams.get('limit') || '100', 10);
  const limit = Math.min(Math.max(limitParam, 1), 300);
  const categoryFilter = searchParams.get('category'); // 'station' | 'satellite' | 'debris'

  let issObject: SpaceObject | null = null;
  let rawISSData: WhereTheISSApiResponse | undefined = undefined;
  let celestrakObjects: SpaceObject[] = [];
  let isFromCache = false;

  // 1. Fetch ISS from "Where the ISS At?" (Phase 1)
  if (
    (source === 'iss' || source === 'combined') &&
    (!categoryFilter || categoryFilter === 'all' || categoryFilter === 'station')
  ) {
    try {
      const res = await fetch(ISS_API_URL, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      if (res.ok) {
        rawISSData = await res.json();
        if (rawISSData) {
          issObject = {
            id: String(rawISSData.id),
            noradId: rawISSData.id,
            name:
              rawISSData.name.toUpperCase() === 'ISS'
                ? 'International Space Station (ISS)'
                : rawISSData.name,
            category: 'station',
            latitude: rawISSData.latitude,
            longitude: rawISSData.longitude,
            altitudeKm: rawISSData.altitude,
            velocityKmh: rawISSData.velocity,
            visibility: rawISSData.visibility,
            footprintKm: rawISSData.footprint,
            timestamp: rawISSData.timestamp,
            solarLat: rawISSData.solar_lat,
            solarLon: rawISSData.solar_lon,
            units: rawISSData.units,
          };
        }
      }
    } catch (err) {
      console.warn('Failed to fetch from Where the ISS At API:', err);
    }
  }

  // 2. Fetch & propagate CelesTrak active satellites using satellite.js (Phase 2)
  if (source === 'celestrak' || source === 'combined') {
    const { records, isCached } = await getCelesTrakRecords();
    isFromCache = isCached;

    if (records.length > 0) {
      const now = new Date();
      const targetCount = limit;

      if (categoryFilter && categoryFilter !== 'all') {
        // Targeted propagation for specific category
        for (const record of records) {
          if (celestrakObjects.length >= targetCount) break;
          if (classifyOrbitalObject(record.OBJECT_NAME) === categoryFilter) {
            const obj = propagateOMMToSpaceObject(record, now);
            if (obj && obj.noradId !== 25544) {
              celestrakObjects.push(obj);
            }
          }
        }
      } else {
        // Balanced selection: ensure debris and stations are included along with satellites
        const stations: SpaceObject[] = [];
        const debris: SpaceObject[] = [];
        const satellites: SpaceObject[] = [];

        for (const record of records) {
          if (
            stations.length + debris.length + satellites.length >=
            targetCount * 1.5
          ) {
            break;
          }

          const cat = classifyOrbitalObject(record.OBJECT_NAME);
          if (cat === 'debris' && debris.length < 15) {
            const obj = propagateOMMToSpaceObject(record, now);
            if (obj) debris.push(obj);
          } else if (cat === 'station' && stations.length < 10) {
            const obj = propagateOMMToSpaceObject(record, now);
            if (obj && obj.noradId !== 25544) stations.push(obj);
          } else if (cat === 'satellite' && satellites.length < targetCount) {
            const obj = propagateOMMToSpaceObject(record, now);
            if (obj) satellites.push(obj);
          }
        }

        // Merge prioritized categories
        celestrakObjects = [...stations, ...debris, ...satellites];
      }
    }
  }

  // 3. Assemble combined payload
  let allObjects: SpaceObject[] = [];

  if (issObject) {
    allObjects.push(issObject);
  }

  allObjects = allObjects.concat(celestrakObjects);

  // Apply maximum limit
  const finalObjects = allObjects.slice(0, limit);

  const responsePayload: SatellitesApiResponse = {
    success: true,
    source: source as 'wheretheiss' | 'celestrak' | 'combined',
    count: finalObjects.length,
    timestamp: Date.now(),
    data: finalObjects,
    raw: rawISSData,
    cached: isFromCache,
  };

  return NextResponse.json(responsePayload, {
    status: 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
