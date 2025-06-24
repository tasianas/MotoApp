import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import MotorcycleModelViewer from "./MotorcycleModelViewer";
import { ThemedView } from "./ThemedView";

interface Motorcycle3DShowcaseProps {
  width?: number;
  height?: number;
}

export default function Motorcycle3DShowcase({
  width = Dimensions.get("window").width,
  height = Dimensions.get("window").height * 0.4,
}: Motorcycle3DShowcaseProps) {
  return (
    <ThemedView style={[styles.container, { width }]}>
      <View style={[styles.viewerContainer, { height: height || 400 }]}>
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <MotorcycleModelViewer
            width={width}
            height={height || 400}
            autoRotate={true}
          />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#fff",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    marginVertical: 15,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    maxHeight: Dimensions.get("window").height * 0.8,
  },
  headerContainer: {
    padding: 16,
    backgroundColor: "#f8f9fa",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#eaeaea",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#D42129",
    marginBottom: 6,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
  },
  viewerContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: 300,
    height: 500,
    overflow: "hidden",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    position: "relative",
  },
});
