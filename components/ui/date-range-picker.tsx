import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react-native";
import { useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radii, spacing } from "@/constants/theme";
import { formatDate, isoToday, parseDateOnly } from "@/lib/utils";

type ActiveDate = "start" | "end";

const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

type CalendarCell = { date: Date | null; key: string };

function calendarDays(month: Date): CalendarCell[] {
  const firstDay = startOfMonth(month);
  const dayCount = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const monthKey = `${month.getFullYear()}-${month.getMonth() + 1}`;

  return [
    ...Array.from({ length: firstDay.getDay() }, (_, index) => ({
      date: null,
      key: `${monthKey}-leading-${index + 1}`,
    })),
    ...Array.from({ length: dayCount }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
      return { date, key: isoToday(date) };
    }),
  ];
}

function DateButton({
  active,
  error,
  label,
  onPress,
  value,
}: {
  active: boolean;
  error?: string;
  label: string;
  onPress: () => void;
  value: string;
}) {
  const parsedValue = parseDateOnly(value);
  const displayValue = parsedValue ? formatDate(parsedValue) : "Choose a date";

  return (
    <View style={styles.dateField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        accessibilityLabel={`${label}, ${displayValue}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: active }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.dateButton,
          active && styles.dateButtonActive,
          error && styles.dateButtonError,
          pressed && styles.pressed,
        ]}
      >
        <CalendarDays color={active ? colors.accent : colors.mutedForeground} size={18} />
        <Text style={styles.dateValue}>{displayValue}</Text>
      </Pressable>
      {error ? (
        <Text selectable style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function DateRangePicker({
  endDate,
  endError,
  onChange,
  startDate,
  startError,
}: {
  endDate: string;
  endError?: string;
  onChange: (dates: { startDate: string; endDate: string }) => void;
  startDate: string;
  startError?: string;
}) {
  const validStart = parseDateOnly(startDate);
  const validEnd = parseDateOnly(endDate);
  const parsedStart = validStart ?? validEnd ?? new Date();
  const parsedEnd = validEnd ?? parsedStart;
  const [activeDate, setActiveDate] = useState<ActiveDate | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(parsedStart));

  function openCalendar(field: ActiveDate) {
    const selectedDate = field === "start" ? parsedStart : parsedEnd;
    Keyboard.dismiss();
    setVisibleMonth(startOfMonth(selectedDate));
    setActiveDate((current) => (current === field ? null : field));
  }

  function moveMonth(offset: number) {
    setVisibleMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + offset, 1),
    );
  }

  function selectDate(date: Date) {
    if (!activeDate) return;

    const selected = isoToday(date);

    if (activeDate === "start") {
      onChange({
        startDate: selected,
        endDate: !validEnd || date > validEnd ? selected : endDate,
      });
      setActiveDate("end");
      return;
    }

    onChange({ startDate: validStart ? startDate : selected, endDate: selected });
    setActiveDate(null);
  }

  const days = calendarDays(visibleMonth);

  return (
    <View style={styles.container}>
      <View style={styles.fields}>
        <DateButton
          active={activeDate === "start"}
          error={startError}
          label="Start date"
          onPress={() => openCalendar("start")}
          value={startDate}
        />
        <DateButton
          active={activeDate === "end"}
          error={endError}
          label="End date"
          onPress={() => openCalendar("end")}
          value={endDate}
        />
      </View>

      {activeDate ? (
        <View accessibilityLabel={`${activeDate} date calendar`} style={styles.calendar}>
          <View style={styles.monthHeader}>
            <Pressable
              accessibilityLabel="Previous month"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => moveMonth(-1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <ChevronLeft color={colors.foreground} size={20} />
            </Pressable>
            <Text accessibilityRole="header" style={styles.monthTitle}>
              {monthLabel(visibleMonth)}
            </Text>
            <Pressable
              accessibilityLabel="Next month"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => moveMonth(1)}
              style={({ pressed }) => [styles.monthButton, pressed && styles.pressed]}
            >
              <ChevronRight color={colors.foreground} size={20} />
            </Pressable>
          </View>

          <View style={styles.weekGrid}>
            {weekdays.map((weekday) => (
              <View key={weekday} style={styles.dayCell}>
                <Text accessibilityLabel={weekday} style={styles.weekday}>
                  {weekday.slice(0, 1)}
                </Text>
              </View>
            ))}
            {days.map(({ date, key }) => {
              if (!date) {
                return <View key={key} style={styles.dayCell} />;
              }

              const value = isoToday(date);
              const disabled =
                activeDate === "end" && validStart !== null && date < validStart;
              const selected = value === startDate || value === endDate;
              const inRange =
                validStart !== null &&
                validEnd !== null &&
                date > validStart &&
                date < validEnd;

              return (
                <View key={value} style={[styles.dayCell, inRange && styles.dayInRange]}>
                  <Pressable
                    accessibilityLabel={`Choose ${formatDate(date)} as ${activeDate} date`}
                    accessibilityRole="button"
                    accessibilityState={{ disabled, selected }}
                    disabled={disabled}
                    onPress={() => selectDate(date)}
                    style={({ pressed }) => [
                      styles.dayButton,
                      selected && styles.daySelected,
                      disabled && styles.dayDisabled,
                      pressed && !disabled && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>
                      {date.getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>

          <Text style={styles.hint}>
            {activeDate === "start" ? "Choose the first day" : "Choose the last day"}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  fields: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  dateField: {
    flexGrow: 1,
    minWidth: 144,
    gap: spacing.xs,
  },
  fieldLabel: {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: "500",
  },
  dateButton: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
  },
  dateButtonActive: {
    borderColor: colors.accent,
  },
  dateButtonError: {
    borderColor: colors.loss,
  },
  dateValue: {
    color: colors.foreground,
    fontSize: 16,
  },
  error: {
    color: colors.loss,
    fontSize: 13,
  },
  calendar: {
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderCurve: "continuous",
    marginHorizontal: -spacing.xl,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },
  monthHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  monthTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: "700",
  },
  weekGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dayInRange: {
    backgroundColor: colors.surfaceMuted,
  },
  weekday: {
    color: colors.mutedForeground,
    fontSize: 12,
    fontWeight: "700",
  },
  dayButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
  },
  daySelected: {
    backgroundColor: colors.brand,
  },
  dayDisabled: {
    opacity: 0.3,
  },
  dayText: {
    color: colors.foreground,
    fontSize: 15,
    fontWeight: "600",
  },
  dayTextSelected: {
    color: colors.brandForeground,
  },
  hint: {
    color: colors.mutedForeground,
    fontSize: 13,
    textAlign: "center",
  },
  pressed: {
    opacity: 0.6,
  },
});
