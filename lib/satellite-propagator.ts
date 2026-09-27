import * as satellite from 'satellite.js';
import type { CelesTrakOMMRecord, SpaceObject } from '@/types/satellite';

/**
 * Classifies an orbital object based on its name and NORAD metadata
 */
export function classifyOrbitalObject(name: string): 'station' | 'satellite' | 'debris' {
  const upper = name.toUpperCase();

  // Spent rocket bodies and fragmentation debris
  if (
    upper.includes(' R/B') ||
    upper.endsWith(' R/B') ||
    upper.includes(' DEB') ||
    upper.endsWith(' DEB') ||
    upper.includes('FRAGMENT') ||
    upper.includes('COOLANT') ||
    upper.includes('STAGE')
  ) {
    return 'debris';
  }

  // Crewed Space Stations
  if (
    upper.includes('ISS ') ||
    upper === 'ISS' ||
    upper.includes('TIANGONG') ||
    upper.includes('TIANHE') ||
    upper.includes('SPACE STATION')
  ) {
    return 'station';
  }

  // Active operational satellites
  return 'satellite';
}

/**
 * Propagates a CelesTrak OMM record using satellite.js SGP4 orbital mechanics
 * to compute real-time geodetic coordinates, altitude, and orbital velocity.
 */
export function propagateOMMToSpaceObject(
  omm: CelesTrakOMMRecord,
  date: Date = new Date()
): SpaceObject | null {
  try {
    // satellite.js supports direct parsing of CelesTrak JSON format via json2satrec
    const satrec = satellite.json2satrec(omm as Parameters<typeof satellite.json2satrec>[0]);
    if (!satrec || satrec.error) {
      return null;
    }

    // Propagate SGP4 model to the specified date
    const pv = satellite.propagate(satrec, date);
    if (!pv || !pv.position || !pv.velocity || typeof pv.position === 'boolean' || typeof pv.velocity === 'boolean') {
      return null;
    }

    // Convert ECI (Earth-Centered Inertial) to Geodetic (Lat, Lon, Alt)
    const gmst = satellite.gstime(date);
    const gd = satellite.eciToGeodetic(pv.position, gmst);

    const latitude = satellite.degreesLat(gd.latitude);
    const longitude = satellite.degreesLong(gd.longitude);
    const altitudeKm = gd.height;

    // Velocity magnitude in km/s converted to km/h
    const velocityMagnitudeKmS = Math.sqrt(
      pv.velocity.x ** 2 + pv.velocity.y ** 2 + pv.velocity.z ** 2
    );
    const velocityKmh = velocityMagnitudeKmS * 3600;

    // Validate numerical outputs
    if (isNaN(latitude) || isNaN(longitude) || isNaN(altitudeKm) || isNaN(velocityKmh)) {
      return null;
    }

    // Approximate ground coverage footprint diameter in km
    const earthRadiusKm = 6371;
    const footprintKm = Math.round(
      2 * Math.sqrt(Math.max(0, 2 * earthRadiusKm * altitudeKm + altitudeKm ** 2))
    );

    // Orbital period in minutes (1440 minutes per day / mean motion revolutions per day)
    const periodMinutes = omm.MEAN_MOTION > 0 ? +(1440 / omm.MEAN_MOTION).toFixed(1) : undefined;

    return {
      id: String(omm.NORAD_CAT_ID),
      noradId: omm.NORAD_CAT_ID,
      name: omm.OBJECT_NAME.trim(),
      category: classifyOrbitalObject(omm.OBJECT_NAME),
      latitude,
      longitude,
      altitudeKm: +altitudeKm.toFixed(2),
      velocityKmh: +velocityKmh.toFixed(2),
      visibility: 'tracking',
      footprintKm,
      timestamp: Math.floor(date.getTime() / 1000),
      units: 'kilometers',
      inclinationDeg: +omm.INCLINATION.toFixed(2),
      periodMinutes,
      epoch: omm.EPOCH,
    };
  } catch {
    return null;
  }
}

