import { StyleSheet, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

// Give the native swipe gesture clearance above the sheet's controls.
export function SheetGrabber() {
  return (
    <View style={styles.zone}>
      <View style={styles.pill} />
    </View>
  );
}

const styles = StyleSheet.create({
  zone: {
    height: 44,
    alignItems: "center",
    paddingTop: spacing.sm,
  },
  pill: {
    width: 42,
    height: 5,
    borderRadius: radii.sm,
    backgroundColor: colors.border,
  },
});
