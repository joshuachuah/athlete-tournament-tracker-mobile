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

  it.each([
    ["10,50", 10.5],
    ["10.50", 10.5],
  ])("commits %s as %p", (text, expected) => {
    const onChangeValue = jest.fn();
    const screen = render(
      <MoneyInput
        label="Amount"
        testID="amount"
        value={10}
        onChangeValue={onChangeValue}
      />,
    );

    fireEvent(screen.getByTestId("amount"), "focus");
    fireEvent.changeText(screen.getByTestId("amount"), text);

    expect(screen.getByTestId("amount").props.value).toBe(text);
    expect(onChangeValue).toHaveBeenLastCalledWith(expected);
  });

  it("preserves comma partial input and rejects extra separators", () => {
    const onChangeValue = jest.fn();
    const screen = render(
      <MoneyInput
        label="Amount"
        testID="amount"
        value={10}
        onChangeValue={onChangeValue}
      />,
    );
    const input = screen.getByTestId("amount");

    fireEvent(input, "focus");
    fireEvent.changeText(input, "10,");
    expect(screen.getByTestId("amount").props.value).toBe("10,");

    fireEvent.changeText(screen.getByTestId("amount"), "10,5.0");
    expect(screen.getByTestId("amount").props.value).toBe("10,");
    expect(onChangeValue).toHaveBeenLastCalledWith(10);
  });

  it("keeps an empty field editable", () => {
    const onChangeValue = jest.fn();
    const screen = render(
      <MoneyInput
        label="Amount"
        testID="amount"
        value={10}
        onChangeValue={onChangeValue}
      />,
    );

    fireEvent(screen.getByTestId("amount"), "focus");
    fireEvent.changeText(screen.getByTestId("amount"), "");

    expect(screen.getByTestId("amount").props.value).toBe("");
    expect(onChangeValue).toHaveBeenLastCalledWith(0);
  });

  it("uses a decimal-capable keyboard", () => {
    const screen = render(<ControlledMoneyInput />);

    expect(screen.getByTestId("amount").props.keyboardType).toBe("decimal-pad");
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
