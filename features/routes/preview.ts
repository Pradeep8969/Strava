import type { TrackPoint } from "../../types/activity";
import { trackSegments } from "../../utils/tracking";

/** Bounded geometry for a small route sketch; gaps and pauses remain separate. */
export function routePreview(
  points: TrackPoint[],
  width: number,
  height: number,
) {
  const groups = trackSegments(
    points.filter(
      (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
    ),
  );
  const stride = Math.max(1, Math.ceil(points.length / 120));
  const sampled = groups
    .map((group) =>
      group.filter(
        (_, i) => i === 0 || i === group.length - 1 || i % stride === 0,
      ),
    )
    .filter((group) => group.length > 1)
    .slice(0, 60);
  const origin = sampled[0]?.[0];
  if (!origin || width <= 24 || height <= 24) return [];
  const projected = sampled.map((group) =>
    group.map((point) => ({
      x:
        (((point.longitude - origin.longitude + 540) % 360) - 180) *
        Math.cos((origin.latitude * Math.PI) / 180),
      y: -point.latitude,
    })),
  );
  const all = projected.flat();
  const minX = Math.min(...all.map((p) => p.x)),
    maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y)),
    maxY = Math.max(...all.map((p) => p.y));
  const scale = Math.min(
    (width - 24) / Math.max(maxX - minX, 0.000001),
    (height - 24) / Math.max(maxY - minY, 0.000001),
  );
  return projected.map((group) =>
    group.map((point) => ({
      x: Math.max(
        12,
        Math.min(width - 12, width / 2 + (point.x - (minX + maxX) / 2) * scale),
      ),
      y: Math.max(
        12,
        Math.min(
          height - 12,
          height / 2 + (point.y - (minY + maxY) / 2) * scale,
        ),
      ),
    })),
  );
}
