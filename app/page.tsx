'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { SpaceObject, SatellitesApiResponse } from '@/types/satellite';
import {
  Satellite,
  Radio,
  Search,
  RefreshCw,
  AlertTriangle,
  Globe,
  Gauge,
  Compass,
  Activity,
  MapPin,
  Maximize2,
  ShieldAlert,
  Database,
  Orbit,
  Sparkles,
} from 'lucide-react';

// CRITICAL SSR RULE: Dynamic import of the MapComponent with SSR disabled
const SpaceMap = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => (
    <div className="relative w-full h-[650px] min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <Globe className="w-8 h-8 text-cyan-400 absolute animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-200">Initializing Orbital Telemetry Map...</p>
        <p className="text-xs text-slate-500 mt-1">Propagating SGP4 orbital vectors & Leaflet tiles</p>
      </div>
    </div>
  ),
});

const Globe3D = dynamic(() => import('@/components/Globe3D'), {
  ssr: false,
  loading: () => (
    <div className="relative w-full h-[650px] min-h-[500px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950/80 backdrop-blur-xl flex flex-col items-center justify-center gap-4 text-slate-400">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full border-2 border-cyan-500/20 border-t-cyan-400 animate-spin" />
        <Globe className="w-8 h-8 text-cyan-400 absolute animate-pulse" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-slate-200">Initializing 3D Orbital Globe...</p>
        <p className="text-xs text-slate-500 mt-1">Loading WebGL renderer & SGP4 orbital vectors</p>
      </div>
    </div>
  ),
});

export default function DashboardPage() {
  const [satellites, setSatellites] = useState<SpaceObject[]>([]);
  const [selectedSatellite, setSelectedSatellite] = useState<SpaceObject | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'station' | 'satellite' | 'debris'>('all');
  const [sourceType, setSourceType] = useState<'combined' | 'iss' | 'celestrak'>('combined');
  const [limit, setLimit] = useState<number>(100);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<'2d' | '3d'>('2d');
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  // Fetch telemetry from internal Route Handler
  const fetchTelemetry = useCallback(
    async (isBackground = false) => {
      if (!isBackground) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError(null);

      try {
        const queryParams = new URLSearchParams({
          source: sourceType,
          limit: String(limit),
        });

        if (categoryFilter !== 'all') {
          queryParams.append('category', categoryFilter);
        }

        const res = await fetch(`/api/satellites?${queryParams.toString()}`, {
          cache: 'no-store',
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch telemetry (HTTP ${res.status})`);
        }
        const data: SatellitesApiResponse = await res.json();

        if (!data.success || !data.data) {
          throw new Error(data.error || 'Invalid telemetry data received');
        }

        setSatellites(data.data);
        setLastRefreshed(new Date());

        // Keep selected satellite state synchronized with latest orbital calculations
        setSelectedSatellite((prevSelected) => {
          if (!prevSelected) {
            return data.data[0] || null;
          }
          const updated = data.data.find((s) => s.id === prevSelected.id);
          return updated || data.data[0] || null;
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown telemetry retrieval error';
        setError(msg);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [sourceType, limit, categoryFilter]
  );

  // Trigger telemetry fetch on source/limit/category change
  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Telemetry real-time polling interval (every 4 seconds when autoRefresh is enabled)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchTelemetry(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTelemetry]);

  // Summary counts across all loaded objects
  const stats = useMemo(() => {
    let stations = 0;
    let debris = 0;
    let operational = 0;

    satellites.forEach((s) => {
      if (s.category === 'station') stations++;
      else if (s.category === 'debris') debris++;
      else operational++;
    });

    return { stations, debris, operational, total: satellites.length };
  }, [satellites]);

  // Filtered satellite list based on search bar
  const filteredSatellites = useMemo(() => {
    return satellites.filter((sat) => {
      const query = searchQuery.toLowerCase().trim();
      if (!query) return true;
      return (
        sat.name.toLowerCase().includes(query) ||
        String(sat.noradId).includes(query) ||
        sat.category.toLowerCase().includes(query)
      );
    });
  }, [satellites, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 text-white shadow-lg shadow-cyan-500/20 border border-cyan-400/30">
              <Satellite className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  Space Debris Tracker
                </h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-mono font-bold tracking-wider rounded-md bg-cyan-950 text-cyan-400 border border-cyan-800/80 flex items-center gap-1">
                  <Sparkles className="w-2.5 h-2.5" /> Phase 2 SGP4
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Real-Time Orbital Telemetry & Low Earth Orbit (LEO) Collision Risk Operations
              </p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-2 text-xs">
            {/* Live System Indicator */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700/60 font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-slate-300">PROPAGATOR ONLINE</span>
              {lastRefreshed && (
                <span className="text-slate-500 hidden sm:inline">
                  • {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh((prev) => !prev)}
              className={`px-3 py-1.5 rounded-lg border font-medium flex items-center gap-1.5 transition-all ${
                autoRefresh
                  ? 'bg-cyan-950/60 border-cyan-700/80 text-cyan-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Radio className={`w-3.5 h-3.5 ${autoRefresh ? 'text-cyan-400 animate-pulse' : ''}`} />
              <span>Live SGP4: {autoRefresh ? '4s' : 'Paused'}</span>
            </button>

            {/* Manual Refresh */}
            <button
              onClick={() => fetchTelemetry(false)}
              disabled={isRefreshing}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Manual Telemetry Recalculation"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Recalculate</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Dashboard Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8 space-y-6">
        {/* Source & Catalog Control Bar */}
        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs">
            <Database className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="font-semibold text-slate-300">Data Source:</span>
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 font-mono">
              <button
                onClick={() => setSourceType('combined')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  sourceType === 'combined'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Combined (ISS + CelesTrak)
              </button>
              <button
                onClick={() => setSourceType('iss')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  sourceType === 'iss'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                ISS (Phase 1)
              </button>
              <button
                onClick={() => setSourceType('celestrak')}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  sourceType === 'celestrak'
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                CelesTrak Active (Phase 2)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400 font-mono">Batch Size:</span>
            <div className="flex items-center gap-1 font-mono">
              {[50, 100, 200].map((count) => (
                <button
                  key={count}
                  onClick={() => setLimit(count)}
                  className={`px-2 py-0.5 rounded border transition-colors ${
                    limit === count
                      ? 'border-cyan-500/80 bg-cyan-950/60 text-cyan-300 font-bold'
                      : 'border-slate-800 bg-slate-950 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {count}
                </button>
              ))}
            </div>

            <div className="h-4 w-px bg-slate-800 mx-1" />

            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800">
                {stats.stations} Stations
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                {stats.debris} Debris
              </span>
              <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                {stats.operational} Satellites
              </span>
            </div>
          </div>
        </div>

        {/* Selected Telemetry Metric Cards */}
        {selectedSatellite && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Orbital Velocity</span>
                <Gauge className="w-4 h-4 text-cyan-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {Math.round(selectedSatellite.velocityKmh).toLocaleString()}
                <span className="text-xs font-normal text-slate-400 ml-1">km/h</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {(selectedSatellite.velocityKmh / 3600).toFixed(2)} km/s (Hyper-orbital)
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Mean Altitude</span>
                <Compass className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {selectedSatellite.altitudeKm.toFixed(1)}
                <span className="text-xs font-normal text-slate-400 ml-1">km</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {selectedSatellite.altitudeKm < 2000
                  ? 'Low Earth Orbit (LEO)'
                  : selectedSatellite.altitudeKm < 35000
                  ? 'Medium Earth Orbit (MEO)'
                  : 'Geostationary Orbit (GEO)'}
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Radio Footprint</span>
                <Maximize2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {selectedSatellite.footprintKm
                  ? Math.round(selectedSatellite.footprintKm).toLocaleString()
                  : 'N/A'}
                <span className="text-xs font-normal text-slate-400 ml-1">km</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">Ground coverage horizon</div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between text-slate-400 mb-1">
                <span className="text-xs font-medium uppercase tracking-wider">Classification</span>
                {selectedSatellite.category === 'debris' ? (
                  <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse" />
                ) : (
                  <Orbit className="w-4 h-4 text-cyan-400" />
                )}
              </div>
              <div className="text-2xl font-bold font-mono capitalize text-white flex items-center gap-2">
                {selectedSatellite.category}
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    selectedSatellite.category === 'debris'
                      ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                      : selectedSatellite.category === 'station'
                      ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]'
                      : 'bg-emerald-400'
                  }`}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {selectedSatellite.category === 'debris'
                  ? 'High collision risk fragment'
                  : 'Operational spacecraft'}
              </div>
            </div>
          </div>
        )}

        {/* Error Notification Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800/60 text-red-200 flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => fetchTelemetry(false)}
              className="px-3 py-1 rounded-lg bg-red-900/60 hover:bg-red-800 text-xs font-semibold text-white transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Split-Pane Layout: Left Sidebar + Right Leaflet Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Split-Pane: Searchable List & Object Details (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search and Filters */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search name, NORAD ID, or type..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/80 focus:ring-1 focus:ring-cyan-500/50 transition-all font-mono"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-1">
                {(['all', 'station', 'satellite', 'debris'] as const).map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg capitalize font-medium transition-all ${
                      categoryFilter === cat
                        ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Telemetry Objects List */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-3 text-xs text-slate-400 font-medium">
                <span className="uppercase tracking-wider">
                  Monitored Objects ({filteredSatellites.length} of {satellites.length})
                </span>
                <span className="font-mono text-cyan-400 flex items-center gap-1">
                  <Orbit className="w-3 h-3" /> SGP4 Real-Time
                </span>
              </div>

              {isLoading && satellites.length === 0 ? (
                <div className="space-y-3 py-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-950/60 animate-pulse space-y-2"
                    >
                      <div className="h-4 bg-slate-800 rounded w-2/3" />
                      <div className="h-3 bg-slate-800/60 rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : filteredSatellites.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">
                  No orbital objects match your search criteria.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {filteredSatellites.map((sat) => {
                    const isSelected = selectedSatellite?.id === sat.id;

                    return (
                      <div
                        key={sat.id}
                        onClick={() => setSelectedSatellite(sat)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-cyan-950/40 border-cyan-500/70 shadow-lg shadow-cyan-950/30'
                            : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700 hover:bg-slate-900/50'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 truncate pr-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                sat.category === 'station'
                                  ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]'
                                  : sat.category === 'debris'
                                  ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]'
                                  : 'bg-emerald-400'
                              }`}
                            />
                            <h2 className="font-semibold text-sm text-slate-100 truncate">
                              {sat.name}
                            </h2>
                          </div>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase font-bold shrink-0 ${
                              sat.category === 'debris'
                                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                : sat.category === 'station'
                                ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {sat.category}
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-xs font-mono text-slate-400 mt-2">
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span className="truncate">
                              {sat.latitude.toFixed(1)}°, {sat.longitude.toFixed(1)}°
                            </span>
                          </div>
                          <div className="text-center text-slate-300 font-medium">
                            {sat.altitudeKm.toFixed(0)} km
                          </div>
                          <div className="flex items-center gap-1 justify-end">
                            <Activity className="w-3 h-3 text-emerald-400 shrink-0" />
                            <span>{Math.round(sat.velocityKmh).toLocaleString()} km/h</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detailed Inspector Card */}
            {selectedSatellite && (
              <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs uppercase font-medium tracking-wider text-slate-400">
                    Orbital Telemetry Inspector
                  </span>
                  <span className="text-xs font-mono text-cyan-400">
                    NORAD #{selectedSatellite.noradId}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-[10px] text-slate-500 uppercase block">Latitude</span>
                    <span className="text-slate-200 text-sm font-semibold">
                      {selectedSatellite.latitude.toFixed(6)}°
                    </span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-[10px] text-slate-500 uppercase block">Longitude</span>
                    <span className="text-slate-200 text-sm font-semibold">
                      {selectedSatellite.longitude.toFixed(6)}°
                    </span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-[10px] text-slate-500 uppercase block">Orbital Period</span>
                    <span className="text-slate-200">
                      {selectedSatellite.periodMinutes
                        ? `${selectedSatellite.periodMinutes} min`
                        : '~92.5 min'}
                    </span>
                  </div>
                  <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800/70">
                    <span className="text-[10px] text-slate-500 uppercase block">Inclination</span>
                    <span className="text-slate-200">
                      {selectedSatellite.inclinationDeg !== undefined
                        ? `${selectedSatellite.inclinationDeg}°`
                        : '51.64°'}
                    </span>
                  </div>
                </div>

                {selectedSatellite.epoch && (
                  <div className="text-[11px] text-slate-500 font-mono bg-slate-950/40 p-2 rounded-lg border border-slate-800/50 flex items-center justify-between">
                    <span>OMM Epoch:</span>
                    <span className="text-slate-400">{selectedSatellite.epoch}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Split-Pane: Map / Globe (7 cols) */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 font-mono">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-cyan-400" />
                {viewMode === '2d' ? '2D Geospatial Orbital Projection' : '3D Geospatial Orbital Projection'}
              </span>

              {/* 2D / 3D toggle */}
              <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 font-mono">
                <button
                  onClick={() => setViewMode('2d')}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    viewMode === '2d'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  2D Map
                </button>
                <button
                  onClick={() => setViewMode('3d')}
                  className={`px-3 py-1 rounded text-xs transition-colors ${
                    viewMode === '3d'
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  3D Globe
                </button>
              </div>
            </div>

            {viewMode === '2d' ? (
              <SpaceMap
                satellites={filteredSatellites}
                selectedSatellite={selectedSatellite}
                onSelectSatellite={(sat) => setSelectedSatellite(sat)}
              />
            ) : (
              <Globe3D
                satellites={filteredSatellites}
                selectedSatellite={selectedSatellite}
                onSelectSatellite={(sat) => setSelectedSatellite(sat)}
              />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 bg-slate-900/40 py-4 px-6 text-center text-xs text-slate-500 font-mono mt-auto">
        Space Debris Tracker • Phase 2 Complete • Multi-source telemetry powered by satellite.js & CelesTrak OMM
      </footer>
    </div>
  );
}
