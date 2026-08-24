import { ChevronDown } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { SelectionSheet } from "@/components/onboarding/selection-sheet";
import { colors, radii, spacing } from "@/constants/theme";
import { countries, isCountryCode, type CountryCode } from "@/lib/countries";
import type { OnboardingOption } from "@/lib/onboarding";

const countryOptions: OnboardingOption[] = countries.map((country) => ({
  value: country.code,
  label: country.name,
  badge: country.code,
}));

export function CountrySelector({
  code,
  error,
  name,
  onSelect,
}: {
  code: CountryCode | null;
  error?: string;
  name: string;
  onSelect: (code: CountryCode) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <View style={{ gap: spacing.xs }}>
        <Text style={styles.label}>Country</Text>
        <Pressable
          accessibilityLabel={`Country. ${name || "Choose a country"}`}
          accessibilityRole="button"
          onPress={() => setOpen(true)}
          style={({ pressed }) => [
            styles.field,
            error ? styles.fieldError : null,
            pressed ? styles.pressed : null,
          ]}
        >
          <Text style={name ? styles.value : styles.placeholder}>
            {name || "Choose a country"}
          </Text>
          <ChevronDown color={colors.mutedForeground} size={20} />
        </Pressable>
        <Text style={styles.helper}>
          Country controls the estimated withholding field in Prize money.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>

      {open ? (
        <SelectionSheet
          emptyBody="Search by a country name or two-letter code."
          onClose={() => setOpen(false)}
          onSelect={(value) => {
            if (isCountryCode(value)) {
              onSelect(value);
              setOpen(false);
            }
          }}
          options={countryOptions}
          selectedValue={code ?? ""}
          title="Choose country"
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: "800",
  },
  field: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    backgroundColor: colors.surface,
  },
  fieldError: {
    borderColor: colors.loss,
  },
  value: {
    flex: 1,
    color: colors.foreground,
    fontSize: 16,
  },
  placeholder: {
    flex: 1,
    color: colors.mutedForeground,
    fontSize: 16,
  },
  helper: {
    color: colors.mutedForeground,
    fontSize: 12,
    lineHeight: 18,
  },
  error: {
    color: colors.loss,
    fontSize: 12,
  },
  pressed: {
    opacity: 0.65,
  },
});
