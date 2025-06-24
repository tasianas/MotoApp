import { Dimensions, SafeAreaView, StyleSheet } from "react-native";

import MotorcycleModelViewer from "@/components/MotorcycleModelViewer";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.container}>
        <ThemedView style={styles.titleContainer}>
          <ThemedText type="title">MotoApp </ThemedText>
        </ThemedView>

        <ThemedView style={styles.stepContainer}>
          <ThemedText style={styles.title}>Ducati Panigale V4R</ThemedText>

          <MotorcycleModelViewer
            width={Dimensions.get("window").width}
            height={400}
            autoRotate={true}
          />

          <ThemedText style={styles.instructions}>
            Touch to Rotate • Pinch to Zoom
          </ThemedText>
        </ThemedView>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#000000",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#D42129",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#aaa", // Brighter text against dark background
    marginBottom: 20,
    textAlign: "center",
  },
  instructions: {
    fontSize: 14,
    fontStyle: "italic",
    color: "#999", // Brighter text against dark background
    marginTop: 10,
    textAlign: "center",
  },
  stepContainer: {
    alignItems: "center",
    gap: 12,
    width: "100%",
    maxWidth: 500,
    marginTop: 10,
  },
});
