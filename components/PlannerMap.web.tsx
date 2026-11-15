import DiscoveryMap from "./DiscoveryMap";
import type { PlannerMapProps } from "../features/routes/planner";

export default function PlannerMap({
  points,
  onWaypoint,
  fitRequest,
}: PlannerMapProps) {
  return (
    <DiscoveryMap
      points={points}
      height={360}
      onWaypoint={onWaypoint}
      fitRequest={fitRequest}
    />
  );
}
