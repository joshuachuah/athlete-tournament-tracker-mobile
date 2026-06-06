import { Text, TextInput, View, type TextInputProps } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

type InputProps = TextInputProps & {
  label: string;
  error?: string;
};

export function Input({ label, error, style, ...props }: InputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text
        style={{
          color: colors.mutedForeground,
          fontSize: 12,
          fontWeight: "800",
          textTransform: "uppercase",
        }}
      >
        {label}
      </Text>
      <TextInput
        placeholderTextColor={colors.mutedForeground}
        style={[
          {
            minHeight: 48,
            borderWidth: 1,
            borderColor: error ? colors.loss : colors.border,
            borderRadius: radii.md,
            borderCurve: "continuous",
            paddingHorizontal: spacing.md,
            color: colors.foreground,
            backgroundColor: colors.surface,
            fontSize: 16,
          },
          style,
        ]}
        {...props}
      />
      {error ? (
        <Text style={{ color: colors.loss, fontSize: 13 }} selectable>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
