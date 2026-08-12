import { fireEvent, render, screen } from "@testing-library/react-native";

import { DateRangePicker } from "@/components/ui/date-range-picker";

describe("DateRangePicker", () => {
  it("chooses a start and end date from the calendar", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <DateRangePicker
        endDate="2026-08-15"
        onChange={onChange}
        startDate="2026-08-13"
      />,
    );

    fireEvent.press(screen.getByLabelText("Start date, Aug 13, 2026"));
    expect(screen.getByText("August 2026")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Choose Aug 14, 2026 as start date"));

    expect(onChange).toHaveBeenLastCalledWith({
      startDate: "2026-08-14",
      endDate: "2026-08-15",
    });

    rerender(
      <DateRangePicker
        endDate="2026-08-15"
        onChange={onChange}
        startDate="2026-08-14"
      />,
    );
    fireEvent.press(screen.getByLabelText("Choose Aug 16, 2026 as end date"));

    expect(onChange).toHaveBeenLastCalledWith({
      startDate: "2026-08-14",
      endDate: "2026-08-16",
    });
  });

  it("moves both dates when a new start is after the current end", () => {
    const onChange = jest.fn();
    render(
      <DateRangePicker
        endDate="2026-08-15"
        onChange={onChange}
        startDate="2026-08-13"
      />,
    );

    fireEvent.press(screen.getByLabelText("Start date, Aug 13, 2026"));
    fireEvent.press(screen.getByLabelText("Choose Aug 20, 2026 as start date"));

    expect(onChange).toHaveBeenCalledWith({
      startDate: "2026-08-20",
      endDate: "2026-08-20",
    });
  });

  it("prevents choosing an end date before the start date", () => {
    render(
      <DateRangePicker
        endDate="2026-08-15"
        onChange={jest.fn()}
        startDate="2026-08-13"
      />,
    );

    fireEvent.press(screen.getByLabelText("End date, Aug 15, 2026"));

    expect(
      screen.getByLabelText("Choose Aug 12, 2026 as end date").props.accessibilityState,
    ).toEqual({ disabled: true, selected: false });
  });

  it("navigates between calendar months", () => {
    render(
      <DateRangePicker
        endDate="2026-08-15"
        onChange={jest.fn()}
        startDate="2026-08-13"
      />,
    );

    fireEvent.press(screen.getByLabelText("Start date, Aug 13, 2026"));
    fireEvent.press(screen.getByLabelText("Next month"));

    expect(screen.getByText("September 2026")).toBeTruthy();
  });
});
