import { colorForEffort, zoneForEffort } from "@/lib/rumoso/colors";
import type { TrackPoint } from "@/lib/rumoso/types";

type LineFeature = {
  type: "Feature";
  properties: { color: string; zone: string };
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

export type RouteCollection = { type: "FeatureCollection"; features: LineFeature[] };

export function routeFeatureCollection(points: readonly TrackPoint[]): RouteCollection {
  const features: LineFeature[] = [];
  if (points.length < 2) return { type: "FeatureCollection", features };

  let coords: [number, number][] = [
    [points[0]!.lon, points[0]!.lat],
    [points[1]!.lon, points[1]!.lat],
  ];
  let color = colorForEffort((points[0]!.effort + points[1]!.effort) / 2);
  let zone = zoneForEffort((points[0]!.effort + points[1]!.effort) / 2).id;

  const flush = () => {
    if (coords.length >= 2) {
      features.push({
        type: "Feature",
        properties: { color, zone },
        geometry: { type: "LineString", coordinates: coords },
      });
    }
  };

  for (let i = 2; i < points.length; i++) {
    const e = (points[i - 1]!.effort + points[i]!.effort) / 2;
    const nextColor = colorForEffort(e);
    const nextZone = zoneForEffort(e).id;
    if (nextZone !== zone) {
      flush();
      coords = [
        [points[i - 1]!.lon, points[i - 1]!.lat],
        [points[i]!.lon, points[i]!.lat],
      ];
      color = nextColor;
      zone = nextZone;
    } else {
      coords.push([points[i]!.lon, points[i]!.lat]);
    }
  }
  flush();
  return { type: "FeatureCollection", features };
}
