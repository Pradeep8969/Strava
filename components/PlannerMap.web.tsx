import DiscoveryMap from "./DiscoveryMap";
import type { PlannerMapProps } from "../features/routes/planner";
import { useWindowDimensions } from "react-native";

export default function PlannerMap({
  points,
  onWaypoint,
  fitRequest,
}: PlannerMapProps) {
  const width = useWindowDimensions().width;
  return (
    <DiscoveryMap
      points={points}
      height={width >= 1100 ? 480 : width >= 768 ? 420 : 340}
      variant="planner"
      onWaypoint={onWaypoint}
      fitRequest={fitRequest}
    />
  );
}
