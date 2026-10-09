import { afterEach, expect, jest, test } from "@jest/globals";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import { Platform } from "react-native";
import { deriveCopy, timeText } from "../../src/core/derive";
import { DateTimeRow } from "../../src/ui/atoms/DateTimeRow";
import { ThemeProvider } from "../../src/ui/theme";

const seed = new Date("2027-02-09T16:35:00Z");
const format = { locale: "pt-PT", timeZone: "Europe/Lisbon", ownZone: "Europe/Lisbon" };
const base = {
  copy: deriveCopy("pt").dateTime,
  initialValue: seed,
  timeZone: format.timeZone,
  label: "Quando",
  testID: "instant",
  value: undefined,
  text: (at: Date) => timeText(at, format),
};
afterEach(() => {
  jest.restoreAllMocks();
});

test("an unset iOS date takes its supplied initial value and translated action", async () => {
  const onChange = jest.fn();
  await render(
    <ThemeProvider>
      <DateTimeRow {...base} onChange={onChange} />
    </ThemeProvider>,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Definir" }));
  expect(onChange).toHaveBeenCalledWith(seed);
  expect(onChange).toHaveBeenCalledTimes(1);
});

test("required or disabled dates cannot clear; native callbacks respect disabled", async () => {
  const onChange = jest.fn();
  const row = (disabled: boolean, required = false) => (
    <ThemeProvider>
      <DateTimeRow
        {...base}
        value={seed}
        onChange={onChange}
        disabled={disabled}
        required={required}
      />
    </ThemeProvider>
  );
  await render(row(false, true));
  expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  await screen.rerender(row(true));
  expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  for (const picker of [screen.getByTestId("instant-date"), screen.getByTestId("instant-time")]) {
    expect(picker.props.timeZoneName).toBe("Europe/Lisbon");
    await act(() =>
      picker.props.onChange({
        nativeEvent: { timestamp: Date.parse("2027-02-10T15:10:00Z"), utcOffset: 0 },
      }),
    );
  }
  expect(onChange).not.toHaveBeenCalled();
  await screen.rerender(row(false));
  await fireEvent.press(screen.getByRole("button", { name: "Limpar" }));
  expect(onChange).toHaveBeenCalledWith(undefined);
});

test("Android composes the two native dialogs in the supplied zone and commits only a time selection", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const open = jest.spyOn(DateTimePickerAndroid, "open").mockImplementation(() => undefined);
  const onChange = jest.fn();
  await render(
    <ThemeProvider>
      <DateTimeRow {...base} onChange={onChange} />
    </ThemeProvider>,
  );
  const row = screen.getByRole("button", { name: "Quando" });
  expect(row).toHaveAccessibilityValue({ text: "Não definido" });
  await fireEvent.press(row);
  const date = open.mock.calls[0]![0];
  expect(date.value).toEqual(seed);
  expect(date.mode).toBe("date");
  expect(date.timeZoneName).toBe("Europe/Lisbon");
  expect(onChange).not.toHaveBeenCalled();
  const day = new Date("2027-02-11T16:35:00Z");
  const event = { nativeEvent: { timestamp: day.getTime(), utcOffset: 0 } };
  await act(() => date.onValueChange!(event, day));
  const time = open.mock.calls[1]![0];
  expect(time.value).toEqual(day);
  expect(time.mode).toBe("time");
  expect(time.timeZoneName).toBe("Europe/Lisbon");
  expect(onChange).not.toHaveBeenCalled();
  const selected = new Date("2027-02-11T18:15:00Z");
  await act(() => time.onValueChange!(event, selected));
  expect(onChange).toHaveBeenCalledWith(selected);
  expect(onChange).toHaveBeenCalledTimes(1);
});

test("an open Android dialog cannot change a newly disabled or unmounted row", async () => {
  jest.replaceProperty(Platform, "OS", "android");
  const open = jest.spyOn(DateTimePickerAndroid, "open").mockImplementation(() => undefined);
  const onChange = jest.fn();
  const row = (disabled: boolean) => (
    <ThemeProvider>
      <DateTimeRow {...base} onChange={onChange} disabled={disabled} />
    </ThemeProvider>
  );
  await render(row(false));
  await fireEvent.press(screen.getByRole("button", { name: "Quando" }));
  const date = open.mock.calls[0]![0];
  const event = { nativeEvent: { timestamp: seed.getTime(), utcOffset: 0 } };
  await screen.rerender(row(true));
  await act(() => date.onValueChange!(event, seed));
  expect(open).toHaveBeenCalledTimes(1);
  expect(onChange).not.toHaveBeenCalled();
  await screen.rerender(row(false));
  await fireEvent.press(screen.getByRole("button", { name: "Quando" }));
  await act(() => open.mock.calls[1]![0].onValueChange!(event, seed));
  const time = open.mock.calls[2]![0];
  await screen.unmount();
  await act(() => time.onValueChange!(event, seed));
  expect(onChange).not.toHaveBeenCalled();
});
