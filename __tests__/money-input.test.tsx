import { fireEvent, render } from "@testing-library/react-native";
import { useState } from "react";

import { MoneyInput } from "@/components/ui/money-input";

function ControlledMoneyInput() {
  const [value, setValue] = useState(10);

  return (
    <MoneyInput
      label="Amount"
      testID="amount"
      value={value}
      onChangeValue={setValue}
    />
  );
}

describe("MoneyInput", () => {
  it("preserves partial text while editing and normalizes it on blur", () => {
    const screen = render(<ControlledMoneyInput />);
    const input = screen.getByTestId("amount");

    fireEvent(input, "focus");
    fireEvent.changeText(input, "10.");

    expect(screen.getByTestId("amount").props.value).toBe("10.");

    fireEvent(input, "blur");

    expect(screen.getByTestId("amount").props.value).toBe("10");
  });

  it("shows external value changes while idle", () => {
    const onChangeValue = jest.fn();
    const screen = render(
      <MoneyInput
        label="Amount"
        testID="amount"
        value={10}
        onChangeValue={onChangeValue}
      />,
    );

    screen.rerender(
      <MoneyInput
        label="Amount"
        testID="amount"
        value={25}
        onChangeValue={onChangeValue}
      />,
    );

    expect(screen.getByTestId("amount").props.value).toBe("25");
  });
});
