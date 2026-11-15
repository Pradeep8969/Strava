import { ImageBackground, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useColors } from "./ui";
import type { TrackPoint } from "../types/activity";
export default function TrackMap({
  points,
}: {
  points: TrackPoint[];
  onPress?: unknown;
  current?: boolean;
  cursor?: TrackPoint;
}) {
  const c = useColors();
  return (
    <ImageBackground
      source={require("../assets/nepal-trails.png")}
      imageStyle={{ borderRadius: 22 }}
      style={{
        minHeight: 220,
        borderRadius: 22,
        overflow: "hidden",
        backgroundColor: c.navy,
      }}
    >
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(13,44,51,0.52)",
          padding: 22,
          justifyContent: "space-between",
          gap: 17,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            gap: 7,
            alignItems: "center",
            alignSelf: "flex-start",
            borderRadius: 50,
            backgroundColor: "rgba(7,34,42,0.8)",
            padding: 10,
          }}
        >
          <Ionicons name="map-outline" size={17} color="#fff" />
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 11 }}>
            NATIVE MAP PREVIEW
          </Text>
        </View>
        <View style={{ gap: 6, maxWidth: 560 }}>
          <Text style={{ color: "#fff", fontWeight: "900", fontSize: 21 }}>
            Your next route starts outside.
          </Text>
          <Text style={{ color: "#E4EFEB", lineHeight: 19, fontSize: 12 }}>
            {points.length ? `${points.length} GPS fixes stored. ` : ""}
            Record real foreground GPS using the Record screen and its route
            map. This panel is a scenic illustration, not an interactive map.
          </Text>
        </View>
      </View>
    </ImageBackground>
  );
}
