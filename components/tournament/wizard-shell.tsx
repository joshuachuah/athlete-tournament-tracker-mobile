import { router } from "expo-router";
import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { colors, radii, spacing } from "@/constants/theme";

const steps = [
  ["details", "Details"],
  ["prizes", "Prizes"],
  ["travel", "Travel"],
  ["subsidy", "Subsidy"],
  ["spending", "Spending"],
] as const;

export type WizardStep = (typeof steps)[number][0];

export function WizardShell({
  step,
  children,
}: {
  step: WizardStep;
  children: ReactNode;
}) {
  const activeIndex = steps.findIndex(([value]) => value === step);

  return (
    <View style={{ gap: spacing.lg }}>
      <View style={{ gap: spacing.sm }}>
        <Text
          style={{
            color: colors.mutedForeground,
            fontSize: 12,
            fontWeight: "800",
            textTransform: "uppercase",
          }}
        >
          Step {activeIndex + 1} of {steps.length}
        </Text>
        <View style={{ flexDirection: "row", gap: 4 }}>
          {steps.map(([value], index) => (
            <View
              key={value}
              style={{
                flex: 1,
                height: 8,
                borderRadius: radii.sm,
                backgroundColor: index <= activeIndex ? colors.accent : colors.border,
              }}
            />
          ))}
        </View>
      </View>
      {children}
    </View>
  );
}

export function WizardNav({
  showBack = false,
  nextLabel = "Next",
  onNext,
  loading,
}: {
  showBack?: boolean;
  nextLabel?: string;
  onNext: () => void;
  loading?: boolean;
}) {
  return (
    <View style={{ flexDirection: "row", gap: spacing.md }}>
      {showBack ? (
        <Button
          label="Back"
          variant="secondary"
          onPress={() => router.back()}
          style={{ flex: 1 }}
        />
      ) : null}
      <Button
        label={nextLabel}
        loading={loading}
        onPress={onNext}
        style={{ flex: 1 }}
      />
    </View>
  );
}
