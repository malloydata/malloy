/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { useEffect, useState } from "react";
import moment from "moment";
import styled from "styled-components";
import { COLORS } from "../colors";
import {
  ChevronLeftButton,
  ChevronRightButton,
  FormFieldList,
} from "../CommonElements";
import { NumberInput } from "../NumberInput";
import { SelectDropdown } from "../SelectDropdown";

interface DatePickerProps {
  value: Date;
  setValue: (value: Date) => void;
  maxLevel:
    | "year"
    | "month"
    | "day"
    | "quarter"
    | "week"
    | "hour"
    | "minute"
    | "second";
}

function granularityIndex(
  granularity:
    | "year"
    | "month"
    | "day"
    | "quarter"
    | "week"
    | "hour"
    | "minute"
    | "second"
) {
  return [
    "year",
    "quarter",
    "month",
    "week",
    "day",
    "hour",
    "minute",
    "second",
  ].indexOf(granularity);
}

function monthName(month: number) {
  return [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ][month];
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  setValue,
  maxLevel,
}) => {
  const [date, setDate] = useState(value);
  const calendar = getCalendar(date);
  const [pickLevel, setPickLevel] = useState<
    "day" | "month" | "year" | "quarter" | "week" | "hour" | "minute" | "second"
  >(maxLevel);
  const yearBucket = Math.floor(moment(date).year() / 10) * 10;

  useEffect(() => {
    if (granularityIndex(maxLevel) < granularityIndex(pickLevel)) {
      setPickLevel(maxLevel);
    } else if (pickLevel === "quarter" && maxLevel !== "quarter") {
      setPickLevel(maxLevel);
    } else if (pickLevel === "week" && maxLevel !== "week") {
      setPickLevel(maxLevel);
    }
  }, [maxLevel, pickLevel]);

  useEffect(() => {
    setDate(value);
  }, [value]);

  const setYear = (year: number) => {
    const newDate = moment(date).year(year).toDate();
    setDate(newDate);
    setValue(newDate);
    if (maxLevel !== "year") {
      if (maxLevel === "quarter") {
        setPickLevel("quarter");
      } else {
        setPickLevel("month");
      }
    }
  };

  const yearButton = (offset: number) => {
    const click = () => setYear(yearBucket + offset);
    if (offset === -1 || offset === 10) {
      return (
        <NonCurrentYear onClick={click} isSelected={false}>
          {yearBucket + offset}
        </NonCurrentYear>
      );
    }
    return (
      <Year
        onClick={click}
        isSelected={moment(date).year() === yearBucket + offset}
      >
        {yearBucket + offset}
      </Year>
    );
  };

  const setMonth = (month: number) => {
    const newDate = moment(date).month(month).toDate();
    setDate(newDate);
    setValue(newDate);
    if (maxLevel !== "month") {
      if (maxLevel === "week") {
        setPickLevel("week");
      } else {
        setPickLevel("day");
      }
    }
  };

  const setDay = (day: Date) => {
    setDate(day);
    setValue(day);
    if (maxLevel !== "day") {
      setPickLevel(maxLevel);
    }
  };

  const setWeekByDay = (dateOfFirstDayOfWeek: Date) => {
    setDate(dateOfFirstDayOfWeek);
    setValue(dateOfFirstDayOfWeek);
    if (maxLevel !== "week") {
      setPickLevel("day");
    }
  };

  const setQuarter = (quarter: number) => {
    const newDate = moment(date)
      .quarter(quarter + 1)
      .toDate();
    setDate(newDate);
    setValue(newDate);
  };

  const monthButton = (month: number) => {
    const click = () => setMonth(month);
    return (
      <Month
        onClick={click}
        isSelected={
          moment(date).month() === month &&
          moment(date).year() === moment(value).year()
        }
      >
        {monthName(month)}
      </Month>
    );
  };

  const quarterButton = (quarter: number) => {
    const click = () => setQuarter(quarter);
    return (
      <Quarter
        onClick={click}
        isSelected={
          moment(date).quarter() - 1 === quarter &&
          moment(date).year() === moment(value).year()
        }
      >
        Q{quarter + 1}
      </Quarter>
    );
  };

  return (
    <Outer>
      <ControlRow>
        <ArrowButton>
          <ChevronLeftButton
            onClick={() => {
              if (pickLevel === "day" || pickLevel === "week") {
                setDate(moment(date).subtract(1, "month").toDate());
              } else if (pickLevel === "month" || pickLevel === "quarter") {
                setDate(moment(date).subtract(1, "year").toDate());
              } else if (pickLevel === "year") {
                setDate(moment(date).subtract(10, "years").toDate());
              } else {
                setDay(moment(date).subtract(1, "days").toDate());
              }
            }}
          />
        </ArrowButton>
        <MiddleButton
          onClick={() => {
            if (pickLevel === "day" || pickLevel === "week") {
              setPickLevel("month");
            } else if (pickLevel === "month" || pickLevel === "quarter") {
              setPickLevel("year");
            } else if (
              pickLevel === "hour" ||
              pickLevel === "minute" ||
              pickLevel === "second"
            ) {
              setPickLevel("day");
            }
          }}
        >
          {(pickLevel === "day" || pickLevel === "week") &&
            moment(date).format("MMMM YYYY")}
          {(pickLevel === "month" || pickLevel === "quarter") &&
            moment(date).format("YYYY")}
          {pickLevel === "year" && (
            <>
              {yearBucket}-{yearBucket + 9}
            </>
          )}
          {(pickLevel === "hour" ||
            pickLevel === "minute" ||
            pickLevel === "second") && (
            <>{moment(date).format("MMMM D, YYYY")}</>
          )}
        </MiddleButton>
        <ArrowButton>
          <ChevronRightButton
            onClick={() => {
              if (pickLevel === "day" || pickLevel === "week") {
                setDate(moment(date).add(1, "month").toDate());
              } else if (pickLevel === "month" || pickLevel === "quarter") {
                setDate(moment(date).add(1, "year").toDate());
              } else if (pickLevel === "year") {
                setDate(moment(date).add(10, "years").toDate());
              } else {
                setDay(moment(date).add(1, "days").toDate());
              }
            }}
          />
        </ArrowButton>
      </ControlRow>
      {pickLevel === "day" && (
        <Calendar>
          <WeekHeader>
            <DayHeader>S</DayHeader>
            <DayHeader>M</DayHeader>
            <DayHeader>T</DayHeader>
            <DayHeader>W</DayHeader>
            <DayHeader>T</DayHeader>
            <DayHeader>F</DayHeader>
            <DayHeader>S</DayHeader>
          </WeekHeader>
          {calendar.map((week, index) => (
            <Week key={index}>
              {week.map((day) => (
                <Day
                  key={day.number}
                  isCurrentMonth={day.isCurrentMonth}
                  onClick={() => {
                    setDay(day.date);
                  }}
                  isSelected={value.getTime() === day.date.valueOf()}
                >
                  {day.number}
                </Day>
              ))}
            </Week>
          ))}
        </Calendar>
      )}
      {pickLevel === "month" && (
        <MonthPicker>
          <MonthsRow>
            {monthButton(0)}
            {monthButton(1)}
            {monthButton(2)}
          </MonthsRow>
          <MonthsRow>
            {monthButton(3)}
            {monthButton(4)}
            {monthButton(5)}
          </MonthsRow>
          <MonthsRow>
            {monthButton(6)}
            {monthButton(7)}
            {monthButton(8)}
          </MonthsRow>
          <MonthsRow>
            {monthButton(9)}
            {monthButton(10)}
            {monthButton(11)}
          </MonthsRow>
        </MonthPicker>
      )}
      {pickLevel === "year" && (
        <YearPicker>
          <YearsRow>
            {yearButton(-1)}
            {yearButton(0)}
            {yearButton(1)}
          </YearsRow>
          <YearsRow>
            {yearButton(2)}
            {yearButton(3)}
            {yearButton(4)}
          </YearsRow>
          <YearsRow>
            {yearButton(5)}
            {yearButton(6)}
            {yearButton(7)}
          </YearsRow>
          <YearsRow>
            {yearButton(8)}
            {yearButton(9)}
            {yearButton(10)}
          </YearsRow>
        </YearPicker>
      )}
      {pickLevel === "quarter" && (
        <QuarterPicker>
          {quarterButton(0)}
          {quarterButton(1)}
          {quarterButton(2)}
          {quarterButton(3)}
        </QuarterPicker>
      )}
      {pickLevel === "week" && (
        <Calendar>
          <WeekHeader>
            <DayHeader>S</DayHeader>
            <DayHeader>M</DayHeader>
            <DayHeader>T</DayHeader>
            <DayHeader>W</DayHeader>
            <DayHeader>T</DayHeader>
            <DayHeader>F</DayHeader>
            <DayHeader>S</DayHeader>
          </WeekHeader>
          {calendar.map((week, index) => (
            <WeekButton
              key={index}
              onClick={() => {
                setWeekByDay(week[0].date);
              }}
              isSelected={value.getTime() === week[0].date.valueOf()}
            >
              {week.map((day) => (
                <DayNotButton
                  key={day.number}
                  isCurrentMonth={day.isCurrentMonth}
                >
                  {day.number}
                </DayNotButton>
              ))}
            </WeekButton>
          ))}
        </Calendar>
      )}
      {(pickLevel === "hour" ||
        pickLevel === "minute" ||
        pickLevel === "second") && (
        <TimePicker>
          <TimePickerInner>
            <FormFieldList>
              <NumberInput
                label="Hours"
                value={parseInt(moment(date).format("hh"))}
                setValue={(hour12) => {
                  const amPm = moment(date).hour() >= 12 ? "PM" : "AM";
                  const newHour24 = parseInt(
                    moment(`${hour12} ${amPm}`, ["hh A"]).format("H")
                  );
                  setValue(moment(date).hour(newHour24).toDate());
                }}
              ></NumberInput>
            </FormFieldList>
            {(maxLevel === "minute" || maxLevel === "second") && (
              <FormFieldList>
                <NumberInput
                  label="Minutes"
                  value={moment(date).minutes()}
                  setValue={(minute) => {
                    setValue(moment(date).minute(minute).toDate());
                  }}
                ></NumberInput>
              </FormFieldList>
            )}
            {maxLevel === "second" && (
              <FormFieldList>
                <NumberInput
                  label="Seconds"
                  value={moment(date).seconds()}
                  setValue={(second) => {
                    setValue(moment(date).second(second).toDate());
                  }}
                ></NumberInput>
              </FormFieldList>
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                flexDirection: "column",
              }}
            >
              <SelectDropdown
                value={moment(date).hour() >= 12 ? "PM" : "AM"}
                onChange={(amPm) => {
                  const hour12 = parseInt(moment(date).format("h"));
                  const newHour24 = parseInt(
                    moment(`${hour12} ${amPm}`, ["hh A"]).format("H")
                  );
                  setValue(moment(date).hour(newHour24).toDate());
                }}
                options={[
                  { value: "AM", label: "AM" },
                  { value: "PM", label: "PM" },
                ]}
              />
            </div>
          </TimePickerInner>
        </TimePicker>
      )}
    </Outer>
  );
};

const Outer = styled.div`
  user-select: none;
  font-size: 14px;
  font-family: Roboto;
`;

const ControlRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 5px;
  margin-bottom: 5px;
`;

const ArrowButton = styled.div`
  border-radius: 5px;
  padding-top: 2px;
  padding-left: 4px;
  padding-right: 4px;
  cursor: pointer;

  &:hover {
    background-color: #efefef;
  }
`;

const MiddleButton = styled.div`
  border-radius: 5px;
  padding: 4px;
  padding-top: 5px;
  flex-grow: 1;
  text-align: center;
  cursor: pointer;
  text-transform: none;
  font-weight: normal;

  &:hover {
    background-color: #efefef;
  }
`;

const MonthPicker = styled.div`
  display: flex;
  flex-direction: column;
  user-select: none;
  justify-content: space-around;
  height: 209.5px;
`;

const TimePicker = styled.div`
  display: flex;
  flex-direction: column;
  user-select: none;
  justify-content: space-around;
  height: 90px;
`;

const TimePickerInner = styled.div`
  display: flex;
  flex-direction: row;
  user-select: none;
  justify-content: space-around;
  gap: 10px;
`;

const QuarterPicker = styled.div`
  display: flex;
  flex-direction: column;
  user-select: none;
  justify-content: space-around;
  height: 209.5px;
`;

const MonthsRow = styled.div`
  display: flex;
  flex-direction: row;
  gap: 2px;
  justify-content: space-between;
`;

const Quarter = styled.div<{
  isSelected: boolean;
}>`
  width: calc(100% - 22px);
  padding: 5px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #efefef;
  color: #505050;
  cursor: pointer;
  text-transform: none;
  border-radius: 5px;
  font-weight: normal;

  &:hover {
    background-color: ${COLORS.dimension.fillLight};
    border-color: ${COLORS.dimension.fillMedium};
  }

  ${({ isSelected }) =>
    isSelected
      ? `
      background-color: ${COLORS.dimension.fillLight};
      border-color: ${COLORS.dimension.fillMedium};
    `
      : ""}
`;

const Month = styled.div<{
  isSelected: boolean;
}>`
  width: 60px;
  min-width: 60px;
  max-width: 60px;
  padding: 5px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #efefef;
  color: #505050;
  cursor: pointer;
  text-transform: none;
  border-radius: 5px;
  font-weight: normal;

  &:hover {
    background-color: ${COLORS.dimension.fillLight};
    border-color: ${COLORS.dimension.fillMedium};
  }

  ${({ isSelected }) =>
    isSelected
      ? `
      background-color: ${COLORS.dimension.fillLight};
      border-color: ${COLORS.dimension.fillMedium};
    `
      : ""}
`;

const YearPicker = styled.div`
  display: flex;
  flex-direction: column;
  user-select: none;
  justify-content: space-around;
  height: 209.5px;
`;

const YearsRow = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 2px;
`;

const Year = styled.div<{
  isSelected: boolean;
}>`
  width: 60px;
  min-width: 60px;
  max-width: 60px;
  padding: 5px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #efefef;
  color: #505050;
  font-weight: normal;
  cursor: pointer;
  text-transform: none;
  border-radius: 5px;

  &:hover {
    background-color: ${COLORS.dimension.fillLight};
    border-color: ${COLORS.dimension.fillMedium};
  }

  ${({ isSelected }) =>
    isSelected
      ? `
      background-color: ${COLORS.dimension.fillLight};
      border-color: ${COLORS.dimension.fillMedium};
    `
      : ""}
`;

const NonCurrentYear = styled(Year)`
  color: #909090;
`;

const Calendar = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  user-select: none;
`;

const WeekHeader = styled.div`
  display: flex;
  flex-direction: row;
  gap: 2px;
  justify-content: space-between;
`;

const Week = styled.div`
  display: flex;
  flex-direction: row;
  gap: 2px;
  justify-content: space-between;
`;

const WeekButton = styled.div<{
  isSelected: boolean;
}>`
  display: flex;
  cursor: pointer;
  flex-direction: row;
  gap: 2px;
  border-radius: 50px;
  justify-content: space-between;
  border: 1px solid transparent;

  ${({ isSelected }) =>
    isSelected
      ? `
    background-color: ${COLORS.dimension.fillLight};
    color:  ${COLORS.dimension.fillStrong};
    border-color: ${COLORS.dimension.fillMedium};
  `
      : `
    &:hover {
      background-color: ${COLORS.dimension.fillLight};
    }
  `}
`;

const Cell = styled.div`
  width: 16.5px;
  height: 16.5px;
  min-width: 16.5px;
  max-width: 16.5px;
  padding: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const DayHeader = styled(Cell)`
  font-weight: bold;
  color: #505050;
`;

const DayNotButton = styled(Cell)<{
  isCurrentMonth: boolean;
}>`
  cursor: pointer;
  border-radius: 50px;
  font-size: 12px;
  ${({ isCurrentMonth }) => `
    color: ${isCurrentMonth ? "#505050" : "#909090"};
  `}
`;

const Day = styled(Cell)<{
  isCurrentMonth: boolean;
  isSelected: boolean;
}>`
  cursor: pointer;
  border-radius: 50px;
  font-size: 12px;
  border: 1px solid transparent;
  ${({ isCurrentMonth, isSelected }) => `
    color: ${isCurrentMonth ? "#505050" : "#909090"};
    ${
      isSelected
        ? `
      background-color: ${COLORS.dimension.fillLight};
      color:  ${COLORS.dimension.fillStrong};
      border-color: ${COLORS.dimension.fillMedium};
    `
        : `
      &:hover {
        background-color: ${COLORS.dimension.fillLight};
      }
    `
    }
  `}
`;

function getCalendar(date: Date) {
  const firstDayOfMonth = moment(date).date(1);
  const dow = firstDayOfMonth.day();
  const daysInMonth = firstDayOfMonth.daysInMonth();
  const daysInPreviousMonth = firstDayOfMonth
    .clone()
    .subtract(1, "day")
    .daysInMonth();
  const calendar = [];
  for (let week = 0; week < 6; week++) {
    const row = [];
    for (let day = 0; day < 7; day++) {
      if (week === 0 && day < dow) {
        const diff = dow - day;
        row.push({
          number: daysInPreviousMonth - diff + 1,
          date: firstDayOfMonth.clone().subtract(diff, "days").toDate(),
          isCurrentMonth: false,
        });
      } else {
        const dom = week * 7 + day - dow;
        if (dom < daysInMonth) {
          row.push({
            number: dom + 1,
            date: firstDayOfMonth.clone().add(dom, "days").toDate(),
            isCurrentMonth: true,
          });
        } else {
          row.push({
            number: dom - daysInMonth + 1,
            date: firstDayOfMonth.clone().add(dom, "days").toDate(),
            isCurrentMonth: false,
          });
        }
      }
    }
    calendar.push(row);
  }
  return calendar;
}
