import { useMemo, useState } from "react";
import PlannerMap from "./PlannerMap";
import { DashboardTabs } from "./dashboard-ui";
import { Button, Copy, Heading, Screen } from "./ui";
import {
  kathmanduPreviewError,
  kathmanduSamples,
  readKathmanduPreview,
  type KathmanduSample,
} from "../features/routes/kathmandu-preview";
import RoadPreviewDetails from "./RoadPreviewDetails";

export default function KathmanduRoadsPreview({
  onClose,
}: {
  onClose: () => void;
}) {
  const [sample, setSample] = useState<KathmanduSample>("Kathmandu walking");
  const preview = useMemo(() => readKathmanduPreview(sample), [sample]);
  return (
    <Screen>
      <Heading eyebrow="Route Studio · Demo">Kathmandu Roads</Heading>
      <Button secondary title="Back to planning" onPress={onClose} />
      <DashboardTabs
        items={kathmanduSamples}
        value={sample}
        onChange={setSample}
        label="Sample routes"
      />
      {preview ? (
        <>
          <PlannerMap points={[]} fitRequest={0} roadPreview={preview.map} />
          <RoadPreviewDetails path={preview.path} map={preview.map} />
        </>
      ) : (
        <Copy>{kathmanduPreviewError}</Copy>
      )}
    </Screen>
  );
}
