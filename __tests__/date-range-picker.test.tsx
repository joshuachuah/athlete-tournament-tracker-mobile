import { fireEvent, render, screen } from "@testing-library/react-native";
import { Keyboard } from "react-native";

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

  it("dismisses the keyboard and exposes full weekday names", () => {
    const dismiss = jest.spyOn(Keyboard, "dismiss").mockImplementation();
    render(
      <DateRangePicker
        endDate="2026-08-15"
        onChange={jest.fn()}
        startDate="2026-08-13"
      />,
    );

    fireEvent.press(screen.getByLabelText("Start date, Aug 13, 2026"));

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Sun")).toBeTruthy();
    expect(screen.getByLabelText("Sat")).toBeTruthy();
    dismiss.mockRestore();
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

  it("chooses an end date across a month boundary", () => {
    const onChange = jest.fn();
    render(
      <DateRangePicker
        endDate="2026-09-02"
        onChange={onChange}
        startDate="2026-08-31"
      />,
    );

    fireEvent.press(screen.getByLabelText("End date, Sep 2, 2026"));
    expect(screen.getByText("September 2026")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Choose Sep 3, 2026 as end date"));

    expect(onChange).toHaveBeenCalledWith({
      startDate: "2026-08-31",
      endDate: "2026-09-03",
    });
  });

  it("recovers from malformed persisted dates", () => {
    const onChange = jest.fn();
    render(
      <DateRangePicker
        endDate="also-not-a-date"
        onChange={onChange}
        startDate="not-a-date"
      />,
    );

    expect(screen.getAllByText("Choose a date")).toHaveLength(2);
    fireEvent.press(screen.getByLabelText("Start date, Choose a date"));
    fireEvent.press(screen.getAllByLabelText(/as start date$/)[0]);

    const selectedDate = onChange.mock.calls[0]?.[0] as
      | { startDate: string; endDate: string }
      | undefined;
    expect(selectedDate?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(selectedDate?.endDate).toBe(selectedDate?.startDate);
  });
});
