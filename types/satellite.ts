/**
 * Raw telemetry response from the "Where the ISS At?" API:
 * https://api.wheretheiss.at/v1/satellites/25544
 */
export interface WhereTheISSApiResponse {
  name: string;
  id: number;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: 'daylight' | 'eclipsed' | string;
  footprint: number;
  timestamp: number;
  daynum: number;
  solar_lat: number;
  solar_lon: number;
  units: 'kilometers' | 'miles';
}

/**
 * CelesTrak Orbit Mean-Elements Message (OMM) schema in JSON format:
 * https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=json
 */
export interface CelesTrakOMMRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

/**
 * Normalized telemetry object used across the Space Debris Tracker dashboard.
 * Designed to seamlessly bridge Phase 1 (ISS) and Phase 2 (CelesTrak / NORAD active satellites and space debris).
 */
export interface SpaceObject {
  id: string;
  noradId: number;
  name: string;
  category: 'station' | 'satellite' | 'debris';
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmh: number;
  visibility?: string;
  footprintKm?: number;
  timestamp: number;
  solarLat?: number;
  solarLon?: number;
  units: string;
  inclinationDeg?: number;
  periodMinutes?: number;
  epoch?: string;
}

/**
 * Standardized API response format for /api/satellites
 */
export interface SatellitesApiResponse {
  success: boolean;
  source: 'wheretheiss' | 'celestrak' | 'combined';
  count: number;
  timestamp: number;
  data: SpaceObject[];
  raw?: WhereTheISSApiResponse;
  error?: string;
  cached?: boolean;
}
