import { Card, Copy } from "./ui";
import { duration } from "../utils/format";
import type { RoutedPath } from "../features/routes/routing";
import type { RoadPreviewMap } from "../features/routes/road-preview";

export default function RoadPreviewDetails({
  path,
  map,
}: {
  path: RoutedPath;
  map: RoadPreviewMap;
}) {
  const profile = path.provenance.profile;
  const cycling = profile === "cycling";
  const mode = cycling
    ? "Cycling"
    : profile === "running"
      ? "Running"
      : "Walking";
  return (
    <Card>
      <Copy>
        {mode} · {(path.distanceMeters / 1000).toFixed(2)} km
        {path.durationSeconds === undefined
          ? ""
          : ` · Estimated ${duration(path.durationSeconds * 1000)}${profile === "running" ? " (walking pace)" : ""}`}
      </Copy>
      <Copy muted>
        Orange markers show requested points. Teal dots show route snaps over 25
        m away.
      </Copy>
      {map.markers
        .filter(({ snapped }) => snapped)
        .map(({ label, offset, severity }) => (
          <Copy key={label}>
            {label} is about {offset} m from the{" "}
            {cycling ? "cycling" : "walking"} route.
            {severity === "large"
              ? cycling
                ? " Choose a nearby bicycle-accessible road for a more accurate point."
                : " Choose a nearby walkable street or path for a more accurate point."
              : ""}
          </Copy>
        ))}
      <Copy muted>{path.provenance.attribution}</Copy>
    </Card>
  );
}
