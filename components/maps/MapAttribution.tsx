import { Image, Linking, Pressable, Text, View } from "react-native";

export function MapAttribution() {
  return (
    <View
      style={{
        position: "absolute",
        bottom: 6,
        left: 6,
        backgroundColor: "white",
        borderRadius: 6,
        paddingHorizontal: 6,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="MapTiler map attribution"
        style={{ minHeight: 44, justifyContent: "center" }}
        onPress={() =>
          void Linking.openURL("https://www.maptiler.com/copyright/")
        }
      >
        <Image
          source={require("../../assets/maptiler-logo.png")}
          style={{ width: 100.5, height: 30 }}
          accessibilityLabel="MapTiler"
        />
      </Pressable>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="OpenStreetMap contributors copyright"
        style={{ minHeight: 44, justifyContent: "center" }}
        onPress={() =>
          void Linking.openURL("https://www.openstreetmap.org/copyright")
        }
      >
        <Text style={{ color: "#101416", fontSize: 10 }}>
          © MapTiler · © OpenStreetMap
        </Text>
      </Pressable>
    </View>
  );
}
