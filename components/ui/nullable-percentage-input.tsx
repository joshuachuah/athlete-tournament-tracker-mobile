import { useState } from "react";
import { Text } from "react-native";

import { Input } from "@/components/ui/input";
import { colors } from "@/constants/theme";

export function NullablePercentageInput({
  error,
  label,
  onChangeValue,
  value,
}: {
  error?: string;
  label: string;
  onChangeValue: (value: number | null) => void;
  value: number | null;
}) {
  const [text, setText] = useState(value === null ? "" : String(value));

  return (
    <>
      <Input
        error={error}
        keyboardType="decimal-pad"
        label={`${label} (%)`}
        onChangeText={(nextText) => {
          const normalized = nextText.replace(",", ".");
          if (!/^\d{0,3}(?:\.\d{0,2})?$/.test(normalized)) return;

          setText(normalized);
          onChangeValue(normalized === "" ? null : Number(normalized));
        }}
        placeholder="Unknown"
        value={text}
      />
      <Text style={{ color: colors.mutedForeground, fontSize: 12, lineHeight: 18 }}>
        Enter the tournament's local rate. Leave blank to show gross payouts only.
      </Text>
    </>
  );
}
