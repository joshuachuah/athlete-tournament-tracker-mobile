import { useState } from "react";

import { Input } from "@/components/ui/input";
import { parseMoneyInput } from "@/lib/utils";

type MoneyInputProps = Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChangeText" | "keyboardType"
> & {
  value: number;
  onChangeValue: (value: number) => void;
};

function moneyToText(value: number): string {
  return value === 0 || Number.isNaN(value) ? "" : String(value);
}

// Keep one decimal separator without interpreting commas as thousands groups.
// Returning null rejects an extra separator instead of joining digits and
// accidentally changing the magnitude.
function sanitize(input: string): string | null {
  const cleaned = input.replace(/[^0-9.,]/g, "");
  const separators = cleaned.match(/[.,]/g);

  return (separators?.length ?? 0) <= 1 ? cleaned : null;
}

/**
 * Numeric input that holds the in-progress text locally and only commits a
 * parsed number to the parent. Editing a numeric value directly (the previous
 * approach) made it impossible to type a decimal point or clear the field,
 * since "10." re-rendered as "10" and an empty field snapped back to "0".
 */
export function MoneyInput({
  value,
  onChangeValue,
  onFocus,
  onBlur,
  ...rest
}: MoneyInputProps) {
  const [editingText, setEditingText] = useState<string | null>(null);

  function handleChangeText(next: string) {
    const cleaned = sanitize(next);

    if (cleaned === null) {
      return;
    }

    setEditingText(cleaned);
    onChangeValue(parseMoneyInput(cleaned));
  }

  return (
    <Input
      {...rest}
      value={editingText ?? moneyToText(value)}
      keyboardType="decimal-pad"
      onChangeText={handleChangeText}
      onFocus={(event) => {
        setEditingText(moneyToText(value));
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setEditingText(null);
        onBlur?.(event);
      }}
    />
  );
}
