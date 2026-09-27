'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import type { SpaceObject } from '@/types/satellite';
import type * as ThreeTypes from 'three';

interface Globe3DProps {
  satellites: SpaceObject[];
  selectedSatellite?: SpaceObject | null;
  onSelectSatellite?: (satellite: SpaceObject) => void;
  className?: string;
}

const EARTH_RADIUS = 1;
const SCALE_ALTITUDE = 0.0008;

function latLonAltToVec3(
  lat: number,
  lon: number,
  altKm: number,
  THREE: typeof ThreeTypes
): ThreeTypes.Vector3 {
  const r = EARTH_RADIUS + altKm * SCALE_ALTITUDE;
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta)
  );
}

export default function Globe3D({
  satellites,
  selectedSatellite,
  onSelectSatellite,
  className = '',
}: Globe3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const satellitesRef = useRef(satellites);
  const selectedRef = useRef(selectedSatellite);
  const onSelectRef = useRef(onSelectSatellite);
  satellitesRef.current = satellites;
  selectedRef.current = selectedSatellite;
  onSelectRef.current = onSelectSatellite;

  const tooltipRef = useRef<HTMLDivElement>(null);
  const cleanup = useRef<() => void>(() => {});

  const init = useCallback(async () => {
    if (!mountRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const container = mountRef.current!;

    const THREE = await import('three');

    const W = container.clientWidth;
    const H = container.clientHeight;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // --- Scene & Camera ---
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.01, 1000);
    camera.position.set(0, 0, 3.2);

    // --- Lighting ---
    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(5, 3, 5);
    scene.add(sun);

    // --- Earth texture ---
    const loader = new THREE.TextureLoader();
    // Natural Earth II — NASA SEDAC, served via unpkg (no CORS)
    const earthTexture = loader.load(
      'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg'
    );

    // --- Earth Globe ---
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: earthTexture,
      shininess: 8,
    });
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    scene.add(earthMesh);

    // --- Atmosphere glow ---
    const atmGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.025, 64, 64);
    const atmMat = new THREE.MeshPhongMaterial({
      color: 0x4fc3f7,
      transparent: true,
      opacity: 0.06,
      side: THREE.BackSide,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    // --- Graticule (lat/lon grid lines) ---
    const gridMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.08 });
    const gridGroup = new THREE.Group();

    for (let lat = -60; lat <= 60; lat += 30) {
      const pts: ThreeTypes.Vector3[] = [];
      for (let lon = 0; lon <= 360; lon += 3) {
        pts.push(latLonAltToVec3(lat, lon - 180, 0, THREE));
      }
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const pts: ThreeTypes.Vector3[] = [];
      for (let lat = -90; lat <= 90; lat += 3) {
        pts.push(latLonAltToVec3(lat, lon - 180, 0, THREE));
      }
      gridGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), gridMat));
    }
    scene.add(gridGroup);

    // --- Satellite markers ---
    const markerGeo = new THREE.SphereGeometry(0.012, 8, 8);
    const categoryMats = {
      station: new THREE.MeshBasicMaterial({ color: 0x22d3ee }),
      satellite: new THREE.MeshBasicMaterial({ color: 0x34d399 }),
      debris: new THREE.MeshBasicMaterial({ color: 0xf43f5e }),
    };

    type MarkerEntry = { mesh: ThreeTypes.Mesh; sat: SpaceObject };
    const markerMap = new Map<string, MarkerEntry>();

    function buildMarkers(sats: SpaceObject[]) {
      markerMap.forEach(({ mesh }) => scene.remove(mesh));
      markerMap.clear();
      sats.forEach((sat) => {
        const mat = categoryMats[sat.category] ?? categoryMats.satellite;
        const mesh = new THREE.Mesh(markerGeo, mat);
        const pos = latLonAltToVec3(sat.latitude, sat.longitude, sat.altitudeKm, THREE);
        mesh.position.copy(pos);
        scene.add(mesh);
        markerMap.set(sat.id, { mesh, sat });
      });
    }

    buildMarkers(satellites);

    // --- Selection ring ---
    const ringGeo = new THREE.RingGeometry(0.018, 0.026, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const selectionRing = new THREE.Mesh(ringGeo, ringMat);
    selectionRing.visible = false;
    scene.add(selectionRing);

    function updateSelectionRing(sel: SpaceObject | null | undefined, rotX: number, rotY: number) {
      if (!sel) { selectionRing.visible = false; return; }
      const pos = latLonAltToVec3(sel.latitude, sel.longitude, sel.altitudeKm, THREE);
      pos.applyEuler(new THREE.Euler(rotX, rotY, 0));
      selectionRing.position.copy(pos);
      selectionRing.lookAt(camera.position);
      selectionRing.visible = true;
    }

    // --- Orbit track ---
    const orbitLineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.35 });
    let orbitLine: ThreeTypes.Line | null = null;

    function buildOrbitTrack(sel: SpaceObject | null | undefined) {
      if (orbitLine) { scene.remove(orbitLine); orbitLine = null; }
      if (!sel) return;
      const r = EARTH_RADIUS + sel.altitudeKm * SCALE_ALTITUDE;
      const pts: ThreeTypes.Vector3[] = [];
      const inc = (sel.inclinationDeg ?? 51.6) * (Math.PI / 180);
      for (let i = 0; i <= 180; i++) {
        const angle = (i / 180) * 2 * Math.PI;
        pts.push(new THREE.Vector3(
          r * Math.cos(angle),
          r * Math.sin(angle) * Math.cos(inc),
          r * Math.sin(angle) * Math.sin(inc)
        ));
      }
      orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), orbitLineMat);
      scene.add(orbitLine);
    }
    buildOrbitTrack(selectedSatellite);

    // --- Raycaster for hover/click ---
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function onMouseMove(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(markerMap.values()).map((v) => v.mesh);
      const hits = raycaster.intersectObjects(meshes);
      const tooltip = tooltipRef.current;
      if (!tooltip) return;
      if (hits.length > 0) {
        const found = Array.from(markerMap.values()).find((v) => v.mesh === hits[0].object);
        if (found) {
          tooltip.style.display = 'block';
          tooltip.style.left = `${e.clientX - rect.left + 12}px`;
          tooltip.style.top = `${e.clientY - rect.top - 8}px`;
          tooltip.innerHTML = `
            <div class="font-semibold text-white text-xs">${found.sat.name}</div>
            <div class="text-[10px] text-slate-400 mt-0.5 font-mono">${found.sat.altitudeKm.toFixed(1)} km • ${Math.round(found.sat.velocityKmh).toLocaleString()} km/h</div>
          `;
          container.style.cursor = 'pointer';
        }
      } else {
        tooltip.style.display = 'none';
        container.style.cursor = 'grab';
      }
    }

    function onClick(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const meshes = Array.from(markerMap.values()).map((v) => v.mesh);
      const hits = raycaster.intersectObjects(meshes);
      if (hits.length > 0) {
        const found = Array.from(markerMap.values()).find((v) => v.mesh === hits[0].object);
        if (found) onSelectRef.current?.(found.sat);
      }
    }

    container.addEventListener('mousemove', onMouseMove);
    container.addEventListener('click', onClick);

    // --- Drag to rotate ---
    let isDragging = false;
    let prevX = 0, prevY = 0;
    let rotX = 0, rotY = 0;

    function onPointerDown(e: PointerEvent) {
      isDragging = true;
      prevX = e.clientX; prevY = e.clientY;
      container.style.cursor = 'grabbing';
    }
    function onPointerMove(e: PointerEvent) {
      if (!isDragging) return;
      rotY += (e.clientX - prevX) * 0.005;
      rotX += (e.clientY - prevY) * 0.005;
      rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
      prevX = e.clientX; prevY = e.clientY;
    }
    function onPointerUp() {
      isDragging = false;
      container.style.cursor = 'grab';
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      camera.position.z = Math.max(1.5, Math.min(6, camera.position.z + e.deltaY * 0.003));
    }

    container.addEventListener('pointerdown', onPointerDown);
    container.addEventListener('pointermove', onPointerMove);
    container.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.style.cursor = 'grab';

    // --- Animation loop ---
    let animId = 0;
    let lastSatVersion = satellites.length;
    let lastSelId = selectedSatellite?.id;

    const selWatcher = setInterval(() => {
      const cur = selectedRef.current;
      if (cur?.id !== lastSelId) {
        lastSelId = cur?.id;
        buildOrbitTrack(cur);
      }
    }, 200);

    function animate() {
      animId = requestAnimationFrame(animate);
      const curSats = satellitesRef.current;
      const curSel = selectedRef.current;

      if (!isDragging) rotY += 0.0005;

      const euler = new THREE.Euler(rotX, rotY, 0);

      // Rebuild markers only when count changes
      if (curSats.length !== lastSatVersion) {
        buildMarkers(curSats);
        lastSatVersion = curSats.length;
      }

      // Apply globe rotation
      earthMesh.rotation.x = rotX;
      earthMesh.rotation.y = rotY;
      gridGroup.rotation.x = rotX;
      gridGroup.rotation.y = rotY;

      // Update & rotate all markers
      curSats.forEach((sat) => {
        const entry = markerMap.get(sat.id);
        if (entry) {
          entry.sat = sat;
          const pos = latLonAltToVec3(sat.latitude, sat.longitude, sat.altitudeKm, THREE);
          pos.applyEuler(euler);
          entry.mesh.position.copy(pos);
        }
      });

      // Orbit track rotation
      if (orbitLine) {
        orbitLine.rotation.x = rotX;
        orbitLine.rotation.y = rotY;
      }

      updateSelectionRing(curSel, rotX, rotY);

      renderer.render(scene, camera);
    }
    animate();

    // --- Resize ---
    function onResize() {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener('resize', onResize);

    cleanup.current = () => {
      cancelAnimationFrame(animId);
      clearInterval(selWatcher);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('mousemove', onMouseMove);
      container.removeEventListener('click', onClick);
      container.removeEventListener('pointerdown', onPointerDown);
      container.removeEventListener('pointermove', onPointerMove);
      container.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    init();
    return () => cleanup.current();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      className={`relative w-full h-[650px] min-h-[500px] max-h-[85vh] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl shadow-cyan-950/20 ${className}`}
    >
      <div ref={mountRef} className="w-full h-full" />

      {/* Hover tooltip */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute hidden z-50 bg-slate-900/95 border border-slate-700 rounded-lg px-3 py-2 shadow-xl backdrop-blur-sm"
      />

      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-10 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/60 text-[11px] font-mono text-slate-300 space-y-1 shadow-lg">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block shadow-[0_0_6px_#22d3ee]" />
          Station
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block shadow-[0_0_6px_#34d399]" />
          Satellite
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block shadow-[0_0_6px_#f43f5e]" />
          Debris
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 left-4 z-10 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/60 text-[10px] font-mono text-slate-400 shadow">
        Drag to rotate • Scroll to zoom • Click to select
      </div>
    </div>
  );
}
