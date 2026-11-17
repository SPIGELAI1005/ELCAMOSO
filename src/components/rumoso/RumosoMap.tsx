import { useEffect, useRef } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./rumoso-map.css";
import type { TrackPoint } from "@/lib/rumoso/types";
import { colorForEffort } from "@/lib/rumoso/colors";
import { routeFeatureCollection } from "./route-geo";

const STYLE = "https://tiles.openfreemap.org/styles/dark";

interface RumosoMapProps {
  points: readonly TrackPoint[];
  follow?: boolean;
  className?: string;
  /** When true, fit the camera to the whole route (summary and mid-run). */
  fitRoute?: boolean;
  /** When set, a double-tap / double-click toggles full-screen map mode (zoom is not triggered). */
  onDoubleTap?: () => void;
  /** Stretch the map after entering or leaving full-screen. */
  expanded?: boolean;
}

export function RumosoMap({ points, follow = true, className, fitRoute, onDoubleTap, expanded }: RumosoMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("maplibre-gl").Map | null>(null);
  const readyRef = useRef(false);
  const pointsRef = useRef(points);
  const followRef = useRef(follow);
  const fitRef = useRef(fitRoute);
  const onDoubleTapRef = useRef(onDoubleTap);
  pointsRef.current = points;
  followRef.current = follow;
  fitRef.current = fitRoute;
  onDoubleTapRef.current = onDoubleTap;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let cancelled = false;
    let map: import("maplibre-gl").Map | null = null;
    let started = false;
    let ro: ResizeObserver | null = null;
    const attribTimers: number[] = [];

    const attach = (instance: import("maplibre-gl").Map) => {
      ro = new ResizeObserver(() => instance.resize());
      ro.observe(el);
    };

    const start = () => {
      if (cancelled || started) return;
      const node = containerRef.current;
      if (!node || node.clientHeight < 24 || node.clientWidth < 24) return;
      started = true;
      void import("maplibre-gl").then((mod) => {
        if (cancelled || !containerRef.current) return;
        const maplibregl = mod.default;
        const last = pointsRef.current[pointsRef.current.length - 1];
        map = new maplibregl.Map({
          container: containerRef.current,
          style: STYLE,
          center: last ? [last.lon, last.lat] : [11.5913, 48.1645],
          zoom: last ? 14 : 13,
          attributionControl: { compact: true },
          pitchWithRotate: false,
          doubleClickZoom: false,
          dragRotate: false,
        });
        mapRef.current = map;
        const onDblClick = (ev: { originalEvent?: { preventDefault?: () => void } }) => {
          ev.originalEvent?.preventDefault?.();
          onDoubleTapRef.current?.();
        };
        map.on("dblclick", onDblClick);
        // Touch: MapLibre may not emit dblclick reliably; detect a second tap ourselves.
        // Ignore multi-touch so pinch-zoom and drag keep working.
        let lastTapAt = 0;
        const onTouchEnd = (ev: TouchEvent) => {
          if (!onDoubleTapRef.current) return;
          if (ev.touches.length > 0 || ev.changedTouches.length !== 1) {
            lastTapAt = 0;
            return;
          }
          const now = Date.now();
          if (now - lastTapAt > 0 && now - lastTapAt < 320) {
            ev.preventDefault();
            lastTapAt = 0;
            onDoubleTapRef.current();
            return;
          }
          lastTapAt = now;
        };
        map.getCanvas().addEventListener("touchend", onTouchEnd, { passive: false });
        // Pinch-to-zoom is enough on a phone; keep +/- on wider screens, away from the legend.
        if (window.matchMedia("(min-width: 768px)").matches) {
          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
        }
        attach(map);
        const collapseAttribution = () => {
          const el = map?.getContainer().querySelector(".maplibregl-ctrl-attrib");
          if (!el) return;
          el.classList.add("maplibregl-compact");
          el.classList.remove("maplibregl-compact-show");
          el.removeAttribute("open");
        };
        // MapLibre 5 expands compact attribution on init (and again when style
        // attributions arrive). Collapse to the "i" button after load; retries
        // cover the late attribution update. After that, a tap on "i" stays open.
        map.once("idle", collapseAttribution);
        attribTimers.push(window.setTimeout(collapseAttribution, 400), window.setTimeout(collapseAttribution, 1600));
        map.on("load", () => {
          if (cancelled || !map) return;
          map.resize();
          map.addSource("rumoso-route", {
            type: "geojson",
            data: routeFeatureCollection(pointsRef.current),
          });
          map.addLayer({
            id: "rumoso-route-line",
            type: "line",
            source: "rumoso-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
              "line-color": ["get", "color"],
              "line-width": 5,
              "line-opacity": 0.95,
            },
          });
          map.addSource("rumoso-cursor", {
            type: "geojson",
            data: cursorGeo(pointsRef.current),
          });
          map.addLayer({
            id: "rumoso-cursor",
            type: "circle",
            source: "rumoso-cursor",
            paint: {
              "circle-radius": 7,
              "circle-color": ["get", "color"],
              "circle-stroke-width": 2,
              "circle-stroke-color": "#ffffff",
            },
          });
          readyRef.current = true;
          applyPoints(map, pointsRef.current, {
            follow: followRef.current,
            fitRoute: fitRef.current,
            jump: true,
          });
        });
      });
    };

    start();
    const waiter = new ResizeObserver(() => start());
    waiter.observe(el);
    const late = window.setTimeout(start, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(late);
      for (const id of attribTimers) window.clearTimeout(id);
      waiter.disconnect();
      ro?.disconnect();
      readyRef.current = false;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    applyPoints(map, points, { follow, fitRoute, jump: false });
  }, [points, follow, fitRoute]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.requestAnimationFrame(() => {
      map.resize();
      if (readyRef.current) applyPoints(map, pointsRef.current, { follow: followRef.current, fitRoute: fitRef.current, jump: false });
    });
    return () => window.cancelAnimationFrame(id);
  }, [expanded]);

  return (
    <div
      ref={containerRef}
      className={["rumoso-map", className].filter(Boolean).join(" ")}
      data-testid="rumoso-map"
      role="img"
      aria-label="Run route map, coloured by effort"
    />
  );
}

function cursorGeo(points: readonly TrackPoint[]) {
  const last = points[points.length - 1];
  if (!last) {
    return { type: "FeatureCollection" as const, features: [] };
  }
  return {
    type: "FeatureCollection" as const,
    features: [
      {
        type: "Feature" as const,
        properties: { color: colorForEffort(last.effort) },
        geometry: { type: "Point" as const, coordinates: [last.lon, last.lat] },
      },
    ],
  };
}

function applyPoints(
  map: import("maplibre-gl").Map,
  points: readonly TrackPoint[],
  opts: { follow: boolean; fitRoute?: boolean | undefined; jump: boolean },
) {
  const route = map.getSource("rumoso-route") as import("maplibre-gl").GeoJSONSource | undefined;
  const cursor = map.getSource("rumoso-cursor") as import("maplibre-gl").GeoJSONSource | undefined;
  route?.setData(routeFeatureCollection(points));
  cursor?.setData(cursorGeo(points));
  if (points.length === 0) return;
  const last = points[points.length - 1]!;
  if (opts.fitRoute && points.length >= 2) {
    const lons = points.map((p) => p.lon);
    const lats = points.map((p) => p.lat);
    const bounds: [[number, number], [number, number]] = [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
    map.fitBounds(bounds, { padding: 48, duration: opts.jump ? 0 : 600, maxZoom: 16 });
    return;
  }
  if (opts.follow) {
    map.easeTo({
      center: [last.lon, last.lat],
      duration: opts.jump ? 0 : 400,
      zoom: Math.max(map.getZoom(), 15),
    });
  }
}
