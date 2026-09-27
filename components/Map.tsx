'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import type { SpaceObject } from '@/types/satellite';
import { Crosshair, Globe, Radio } from 'lucide-react';

interface MapComponentProps {
  satellites: SpaceObject[];
  selectedSatellite?: SpaceObject | null;
  onSelectSatellite?: (satellite: SpaceObject) => void;
  className?: string;
}

// Controller to smoothly pan to selected or updated satellite coordinates
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (center && !isNaN(center[0]) && !isNaN(center[1])) {
      map.panTo(center, { animate: true, duration: 1.2 });
    }
  }, [center, map]);

  return null;
}

export default function SpaceMap({
  satellites,
  selectedSatellite,
  onSelectSatellite,
  className = '',
}: MapComponentProps) {
  const [showFootprint, setShowFootprint] = useState<boolean>(true);

  // Default initial position (ISS or default coordinates [0, 0])
  const defaultPos: [number, number] = useMemo(() => {
    if (selectedSatellite) {
      return [selectedSatellite.latitude, selectedSatellite.longitude];
    }
    if (satellites.length > 0) {
      return [satellites[0].latitude, satellites[0].longitude];
    }
    return [0, 0];
  }, [selectedSatellite, satellites]);

  const osmTile = {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  };

  // Generate glowing radar-styled divIcon markers
  const getMarkerIcon = (object: SpaceObject, isSelected: boolean) => {
    const isStation = object.category === 'station';
    const isDebris = object.category === 'debris';

    const glowClass = isStation
      ? 'border-cyan-400 bg-cyan-950/80 text-cyan-300 shadow-[0_0_18px_rgba(6,182,212,0.85)]'
      : isDebris
      ? 'border-rose-500 bg-rose-950/80 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.85)]'
      : 'border-emerald-400 bg-emerald-950/80 text-emerald-300 shadow-[0_0_18px_rgba(52,211,153,0.85)]';

    const pingClass = isStation
      ? 'bg-cyan-400'
      : isDebris
      ? 'bg-rose-500'
      : 'bg-emerald-400';

    const iconHtml = `
      <div class="relative flex items-center justify-center cursor-pointer group">
        <span class="absolute inline-flex h-8 w-8 rounded-full ${pingClass} opacity-60 animate-ping"></span>
        <div class="relative flex items-center justify-center w-8 h-8 rounded-full border-2 ${glowClass} ${
      isSelected ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-black' : ''
    } transition-all duration-200">
          <div class="w-2.5 h-2.5 rounded-full ${pingClass} shadow-[0_0_8px_currentColor]"></div>
        </div>
        <span class="absolute -top-6 whitespace-nowrap px-1.5 py-0.5 rounded bg-black/85 text-[10px] font-mono text-cyan-300 border border-cyan-500/30 shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          ${object.name}
        </span>
      </div>
    `;

    return L.divIcon({
      html: iconHtml,
      className: 'space-telemetry-icon',
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      popupAnchor: [0, -18],
    });
  };

  const currentCenter: [number, number] = selectedSatellite
    ? [selectedSatellite.latitude, selectedSatellite.longitude]
    : defaultPos;

  return (
    <div
      className={`relative w-full h-[650px] min-h-[500px] max-h-[85vh] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl shadow-cyan-950/20 ${className}`}
    >
      {/* Top Map Controls Overlay */}
      <div className="absolute top-4 right-4 z-[1000] flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-lg text-xs font-mono text-slate-300">
        <button
          onClick={() => setShowFootprint((prev) => !prev)}
          className={`px-2 py-1 rounded transition-colors flex items-center gap-1 ${
            showFootprint
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
          title="Toggle coverage footprint"
        >
          <Radio className="w-3 h-3" />
          <span>Footprint</span>
        </button>
      </div>

      {/* Map Live Coordinate HUD */}
      {selectedSatellite && (
        <div className="absolute bottom-4 left-4 z-[1000] bg-slate-900/90 backdrop-blur-md px-3.5 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300 shadow-xl pointer-events-none flex items-center gap-3">
          <Crosshair className="w-4 h-4 text-cyan-400 animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider">Tracking Object</div>
            <div className="text-white font-semibold flex items-center gap-1.5">
              {selectedSatellite.name}
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                NORAD {selectedSatellite.noradId}
              </span>
            </div>
            <div className="text-cyan-400/90 text-[11px] mt-0.5">
              LAT: {selectedSatellite.latitude.toFixed(4)}° | LON: {selectedSatellite.longitude.toFixed(4)}°
            </div>
          </div>
        </div>
      )}

      {/* React Leaflet Map Container */}
      <MapContainer
        center={defaultPos}
        zoom={3}
        minZoom={2}
        maxZoom={18}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        style={{ width: '100%', height: '100%', background: '#020617' }}
      >
        <MapController center={currentCenter} />

        <TileLayer
          url={osmTile.url}
          attribution={osmTile.attribution}
          maxZoom={19}
        />

        {satellites.map((sat) => {
          const isSelected = selectedSatellite?.id === sat.id;
          const pos: [number, number] = [sat.latitude, sat.longitude];

          return (
            <React.Fragment key={sat.id}>
              {/* Render Ground Station Footprint Circle for the selected object */}
              {showFootprint && isSelected && sat.footprintKm && (
                <Circle
                  center={pos}
                  radius={Math.min(sat.footprintKm * 500, 5000000)}
                  pathOptions={{
                    color:
                      sat.category === 'debris'
                        ? '#f43f5e'
                        : sat.category === 'station'
                        ? '#06b6d4'
                        : '#10b981',
                    fillColor:
                      sat.category === 'debris'
                        ? '#f43f5e'
                        : sat.category === 'station'
                        ? '#06b6d4'
                        : '#10b981',
                    fillOpacity: 0.15,
                    weight: 1.5,
                    dashArray: '4, 6',
                  }}
                />
              )}

              <Marker
                position={pos}
                icon={getMarkerIcon(sat, isSelected)}
                eventHandlers={{
                  click: () => {
                    if (onSelectSatellite) {
                      onSelectSatellite(sat);
                    }
                  },
                }}
              >
                <Popup className="space-leaflet-popup">
                  <div className="p-1 min-w-[210px] font-sans">
                    <div className="flex items-center justify-between border-b border-slate-700/50 pb-1.5 mb-2">
                      <span className="font-semibold text-white text-sm flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-cyan-600" />
                        {sat.name}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold bg-cyan-100 text-cyan-800">
                        {sat.category}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-xs text-slate-600 mb-2">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Latitude</span>
                        <span className="font-mono font-medium text-white">{sat.latitude.toFixed(4)}°</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Longitude</span>
                        <span className="font-mono font-medium text-white">{sat.longitude.toFixed(4)}°</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Altitude</span>
                        <span className="font-mono font-medium text-white">{sat.altitudeKm.toFixed(1)} km</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Velocity</span>
                        <span className="font-mono font-medium text-white">
                          {Math.round(sat.velocityKmh).toLocaleString()} km/h
                        </span>
                      </div>
                    </div>

                    {sat.visibility && (
                      <div className="text-[11px] bg-slate-100 px-2 py-1 rounded flex items-center justify-between text-slate-700">
                        <span>Visibility:</span>
                        <span className="capitalize font-semibold text-cyan-700">{sat.visibility}</span>
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}

