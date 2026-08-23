import { render } from "@testing-library/react-native";
import { StyleSheet, Text, View } from "react-native";

import { Input } from "@/components/ui/input";

describe("Input", () => {
  it("centers a leading icon within the field", () => {
    const screen = render(
      <Input label="Tournament name" leadingIcon={<Text>Search icon</Text>} />,
    );
    const iconWrapper = screen
      .UNSAFE_getAllByType(View)
      .find((view) => view.props.pointerEvents === "none");

    if (!iconWrapper) throw new Error("Leading icon wrapper was not rendered");
    expect(StyleSheet.flatten(iconWrapper.props.style)).toMatchObject({
      top: 0,
      bottom: 0,
      justifyContent: "center",
    });
  });
});
