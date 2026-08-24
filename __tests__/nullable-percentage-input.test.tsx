import { fireEvent, render } from "@testing-library/react-native";
import { TextInput } from "react-native";

import { NullablePercentageInput } from "@/components/ui/nullable-percentage-input";

describe("NullablePercentageInput", () => {
  it.each(["", ".", ","])("treats %p as an unknown rate", (text) => {
    const onChangeValue = jest.fn();
    const screen = render(
      <NullablePercentageInput
        label="Estimated withholding"
        onChangeValue={onChangeValue}
        value={10}
      />,
    );

    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), text);

    expect(onChangeValue).toHaveBeenLastCalledWith(null);
  });

  it("preserves explicit zero separately from blank", () => {
    const onChangeValue = jest.fn();
    const screen = render(
      <NullablePercentageInput
        label="Estimated withholding"
        onChangeValue={onChangeValue}
        value={null}
      />,
    );

    fireEvent.changeText(screen.UNSAFE_getByType(TextInput), "0");

    expect(onChangeValue).toHaveBeenLastCalledWith(0);
    expect(screen.UNSAFE_getByType(TextInput).props.value).toBe("0");
  });
});
