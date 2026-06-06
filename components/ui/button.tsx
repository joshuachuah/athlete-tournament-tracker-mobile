import { ActivityIndicator, Pressable, Text, type PressableProps } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = PressableProps & {
  label: string;
  variant?: ButtonVariant;
  loading?: boolean;
};

function buttonColors(variant: ButtonVariant) {
  switch (variant) {
    case "secondary":
      return {
        backgroundColor: colors.surfaceMuted,
        color: colors.foreground,
        borderColor: colors.border,
      };
    case "danger":
      return {
        backgroundColor: colors.loss,
        color: "#FFFFFF",
        borderColor: colors.loss,
      };
    case "ghost":
      return {
        backgroundColor: "transparent",
        color: colors.accent,
        borderColor: "transparent",
      };
    case "primary":
      return {
        backgroundColor: colors.foreground,
        color: "#FFFFFF",
        borderColor: colors.foreground,
      };
  }
}

export function Button({
  label,
  variant = "primary",
  loading = false,
  disabled,
  style,
  ...props
}: ButtonProps) {
  const palette = buttonColors(variant);
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          borderRadius: radii.md,
          borderWidth: 1,
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
          opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1,
        },
        typeof style === "function" ? style({ pressed }) : style,
      ]}
      {...props}
    >
      {loading ? <ActivityIndicator color={palette.color} /> : null}
      <Text style={{ color: palette.color, fontWeight: "700", fontSize: 16 }}>
        {label}
      </Text>
    </Pressable>
  );
}
