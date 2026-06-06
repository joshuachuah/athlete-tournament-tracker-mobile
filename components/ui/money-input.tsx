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

// Keep at most one decimal point and drop anything that isn't a digit or dot so
// partial entries like "10." or "" survive while the user is still typing.
function sanitize(input: string): string {
  const cleaned = input.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");

  if (firstDot === -1) {
    return cleaned;
  }

  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

/**
 * Numeric input that holds the in-progress text locally and only commits a
 * parsed number to the parent. Editing a numeric value directly (the previous
 * approach) made it impossible to type a decimal point or clear the field,
 * since "10." re-rendered as "10" and an empty field snapped back to "0".
 */
export function MoneyInput({ value, onChangeValue, ...rest }: MoneyInputProps) {
  const [text, setText] = useState(() => moneyToText(value));

  // Resync when the committed value changes from outside (prefill, edit
  // hydration, auto-calculated totals) and no longer matches what's shown.
  // Done during render via the previous-value pattern instead of a useEffect:
  // no extra render/paint, and the React Compiler can optimize it.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    if (parseMoneyInput(text) !== value) {
      setText(moneyToText(value));
    }
  }

  function handleChangeText(next: string) {
    const cleaned = sanitize(next);
    setText(cleaned);
    onChangeValue(parseMoneyInput(cleaned));
  }

  return (
    <Input
      {...rest}
      value={text}
      keyboardType="numeric"
      onChangeText={handleChangeText}
    />
  );
}
