import { fireEvent, render } from "@testing-library/react-native";
import { router } from "expo-router";

import { WizardNav } from "@/components/tournament/wizard-shell";

jest.mock("expo-router", () => ({
  router: {
    back: jest.fn(),
  },
}));

describe("WizardNav", () => {
  it("pops the current route when Back is pressed", () => {
    const onNext = jest.fn();
    const screen = render(<WizardNav showBack onNext={onNext} />);

    fireEvent.press(screen.getByText("Back"));

    expect(router.back).toHaveBeenCalledTimes(1);
    expect(onNext).not.toHaveBeenCalled();
  });
});
