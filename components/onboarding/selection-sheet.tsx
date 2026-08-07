import { Check, Search, X } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { OnboardingOption } from "@/lib/onboarding";

export function SelectionSheet({
  options,
  selectedValue,
  title,
  onClose,
  onSelect,
}: {
  options: OnboardingOption[];
  selectedValue: string;
  title: string;
  onClose: () => void;
  onSelect: (value: string) => void;
}) {
  const [query, setQuery] = useState("");
  const reducedMotion = useReducedMotion();
  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.detail ?? ""} ${option.value}`
      .toLowerCase()
      .includes(normalizedQuery),
  );

  return (
    <Modal
      animationType={reducedMotion ? "none" : "slide"}
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent
      visible
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.modal}
      >
        <Pressable
          accessibilityLabel={`Close ${title.toLowerCase()}`}
          accessibilityRole="button"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Pressable
              accessibilityLabel={`Close ${title.toLowerCase()}`}
              accessibilityRole="button"
              hitSlop={10}
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.pressed,
              ]}
            >
              <X color={colors.foreground} size={22} strokeWidth={2.2} />
            </Pressable>
          </View>

          {options.length > 8 ? (
            <View style={styles.searchField}>
              <Search
                color={colors.mutedForeground}
                size={18}
                strokeWidth={2}
              />
              <TextInput
                accessibilityLabel={`Search ${title.toLowerCase()}`}
                autoCapitalize="none"
                autoCorrect={false}
                onChangeText={setQuery}
                placeholder="Search"
                placeholderTextColor={colors.mutedForeground}
                style={styles.searchInput}
                value={query}
              />
            </View>
          ) : null}

          <FlatList
            contentContainerStyle={styles.options}
            data={filteredOptions}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(option) => option.value}
            renderItem={({ item }) => {
              const selected = item.value === selectedValue;

              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  onPress={() => onSelect(item.value)}
                  style={({ pressed }) => [
                    styles.option,
                    selected && styles.optionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <View
                    style={[
                      styles.badge,
                      selected && styles.badgeSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.badgeText,
                        selected && styles.badgeTextSelected,
                      ]}
                    >
                      {item.badge}
                    </Text>
                  </View>
                  <View style={styles.optionCopy}>
                    <Text style={styles.optionLabel}>{item.label}</Text>
                    {item.detail ? (
                      <Text style={styles.optionDetail}>{item.detail}</Text>
                    ) : null}
                  </View>
                  {selected ? (
                    <Check
                      color={colors.brand}
                      size={20}
                      strokeWidth={2.5}
                    />
                  ) : null}
                </Pressable>
              );
            }}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>No matching option</Text>
                <Text style={styles.emptyBody}>
                  Try another search or choose the custom option.
                </Text>
              </View>
            }
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modal: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(14, 24, 18, 0.34)",
  },
  sheet: {
    maxHeight: "82%",
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderCurve: "continuous",
    backgroundColor: colors.background,
  },
  handle: {
    width: 42,
    height: 5,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  title: {
    flex: 1,
    color: colors.foreground,
    fontSize: 23,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  searchField: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  searchInput: {
    flex: 1,
    color: colors.foreground,
    fontSize: 16,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.brand,
  },
  badge: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
  },
  badgeSelected: {
    backgroundColor: colors.brand,
  },
  badgeText: {
    color: colors.brand,
    fontSize: 12,
    fontWeight: "900",
  },
  badgeTextSelected: {
    color: colors.brandForeground,
  },
  optionCopy: {
    flex: 1,
    gap: 2,
  },
  optionLabel: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "800",
  },
  optionDetail: {
    color: colors.mutedForeground,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.62,
  },
  empty: {
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  emptyTitle: {
    color: colors.foreground,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyBody: {
    color: colors.mutedForeground,
    textAlign: "center",
  },
});
