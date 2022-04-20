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

import { ReactElement, useRef, useState } from "react";
import styled from "styled-components";
import { timeFilterChangeType } from "../../core/filters";
import {
  InThePastUnit,
  ThisLastPeriod,
  TimeCustomFilter,
  TimeFilter,
  TimeFilterType,
  TimeGranularity,
  TimeIsAfterFilter,
  TimeIsBeforeFilter,
  TimeIsBetweenFilter,
  TimeIsInThePastFilter,
  TimeIsLastFilter,
  TimeIsOnFilter,
  TimeIsThisFilter,
} from "../../types";
import { CodeInput } from "../CodeInput";
import { DateInput } from "../DateInput";
import { DatePicker } from "../DatePicker";
import { useClickOutside } from "../hooks";
import { SelectDropdown } from "../SelectDropdown";

interface TimeFilterBuilderProps {
  filter: TimeFilter;
  type: "date" | "timestamp";
  setFilter: (filter: TimeFilter) => void;
}

export const TimeFilterBuilder: React.FC<TimeFilterBuilderProps> = ({
  filter,
  setFilter,
  type,
}) => {
  const changeType = (type: TimeFilterType) => {
    setFilter(timeFilterChangeType(filter, type));
  };

  const typeDropdown = (
    <SelectDropdown
      value={filter.type}
      onChange={changeType}
      options={
        [
          { value: "is_in_the_past", label: "Past" },
          { value: "is_last", label: "Last" },
          { value: "is_this", label: "This" },
          { value: "is_on", label: "On" },
          { value: "is_after", label: "After" },
          { value: "is_before", label: "Before" },
          { value: "is_between", label: "Between" },
          { value: "is_null", label: "Null" },
          { value: "is_not_null", label: "Not null" },
          { value: "custom", label: "Custom" },
        ] as { value: TimeFilterType; label: string }[]
      }
    />
  );

  const inThePast = useTimeInThePastBuilder(
    filter,
    setFilter,
    type,
    typeDropdown
  );
  const between = useTimeBetweenBuilder(filter, setFilter, type, typeDropdown);
  const thisLast = useTimeLastThis(filter, setFilter, type, typeDropdown);
  const isOn = useTimeIsOnBuilder(filter, setFilter, type, typeDropdown);
  const custom = useTimeCustomBuilder(filter, setFilter, typeDropdown);
  const noBuilder =
    filter.type === "is_null" || filter.type === "is_not_null" ? (
      <div style={{ width: "100%" }}>{typeDropdown}</div>
    ) : null;

  const showUtilRow =
    inThePast.util || isOn.util || custom.util || thisLast.util || between.util;

  return (
    <div>
      <BuilderRow>
        {inThePast.builder}
        {isOn.builder}
        {custom.builder}
        {thisLast.builder}
        {between.builder}
        {noBuilder}
      </BuilderRow>
      {showUtilRow && (
        <UtilRow>
          {inThePast.util}
          {isOn.util}
          {custom.util}
          {thisLast.util}
          {between.util}
        </UtilRow>
      )}
    </div>
  );
};

const BuilderRow = styled.div`
  padding: 0 15px;
`;

const UtilRow = styled.div`
  border-top: 1px solid #efefef;
  padding: 15px;
  margin-top: 10px;
  padding-bottom: 0;
`;

const Row = styled.div`
  display: flex;
  gap: 10px;
  flex-direction: row;
  width: 100%;
`;

const Column = styled.div`
  display: flex;
  gap: 10px;
  flex-direction: column;
  width: 100%;
`;

function useTimeInThePastBuilder(
  filter: TimeFilter,
  setFilter: (filter: TimeIsInThePastFilter) => void,
  type: "date" | "timestamp",
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_in_the_past") {
    return { builder: null, util: null };
  }

  const options = [
    { value: "years", label: "Years" },
    { value: "quarters", label: "Quarters" },
    { value: "months", label: "Months" },
    { value: "weeks", label: "Weeks" },
    { value: "days", label: "Days" },
  ] as { value: InThePastUnit; label: string }[];

  if (type === "timestamp") {
    options.push(
      { value: "hours", label: "Hours" },
      { value: "minutes", label: "Minutes" },
      { value: "seconds", label: "Seconds" }
    );
  }

  const builder = (
    <Row>
      <div style={{ width: "30%", flexShrink: 1 }}>{typeDropdown}</div>
      <div style={{ width: "30%", flexShrink: 1 }}>
        <CodeInput
          value={filter.amount.toString()}
          setValue={(amount) =>
            setFilter({ ...filter, amount: parseFloat(amount) })
          }
        />
      </div>
      <div style={{ width: "40%", flexShrink: 1 }}>
        <SelectDropdown
          value={filter.unit}
          options={options}
          onChange={(unit) => setFilter({ ...filter, unit })}
        />
      </div>
    </Row>
  );
  const util = null;
  return { builder, util };
}

function useTimeLastThis(
  filter: TimeFilter,
  setFilter: (filter: TimeIsLastFilter | TimeIsThisFilter) => void,
  type: "timestamp" | "date",
  typeDropdown: ReactElement
) {
  if (filter.type !== "is_this" && filter.type !== "is_last") {
    return { builder: null, util: null };
  }

  const options = [
    { value: "year", label: "Year" },
    { value: "quarter", label: "Quarter" },
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
  ] as { value: ThisLastPeriod; label: string }[];

  if (type === "timestamp") {
    options.push(
      { value: "hour", label: "Hour" },
      { value: "minute", label: "Minute" },
      { value: "second", label: "Second" }
    );
  }

  const builder = (
    <Row>
      <div style={{ width: "50%", flexShrink: 1 }}>{typeDropdown}</div>
      <div style={{ width: "50%", flexShrink: 1 }}>
        <SelectDropdown
          value={filter.period}
          options={options}
          onChange={(period) => setFilter({ ...filter, period })}
        />
      </div>
    </Row>
  );
  const util = null;
  return { builder, util };
}

function useTimeIsOnBuilder(
  filter: TimeFilter,
  setFilter: (
    filter: TimeIsOnFilter | TimeIsAfterFilter | TimeIsBeforeFilter
  ) => void,
  type: "date" | "timestamp",
  typeDropdown: ReactElement
) {
  const [isActive, setIsActive] = useState(false);
  const dateInputRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useClickOutside([dateInputRef, datePickerRef], () => setIsActive(false));

  if (
    filter.type !== "is_on" &&
    filter.type !== "is_after" &&
    filter.type !== "is_before"
  ) {
    return { builder: null, util: null };
  }

  const options = [
    { value: "year", label: "Year" },
    { value: "quarter", label: "Quarter" },
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
  ] as { value: TimeGranularity; label: string }[];

  if (type === "timestamp") {
    options.push(
      { value: "hour", label: "Hour" },
      { value: "minute", label: "Minute" },
      { value: "second", label: "Second" }
    );
  }

  const granularity =
    type === "date" &&
    (filter.granularity === "second" ||
      filter.granularity === "minute" ||
      filter.granularity === "hour")
      ? "day"
      : filter.granularity;

  const builder = (
    <Column>
      <Row>
        <div style={{ width: "50%", flexShrink: 1 }}>{typeDropdown}</div>
        <div style={{ width: "50%", flexShrink: 1 }}>
          <SelectDropdown
            value={filter.granularity}
            options={options}
            onChange={(granularity) => setFilter({ ...filter, granularity })}
          />
        </div>
      </Row>
      <Row>
        <div ref={dateInputRef} style={{ width: "100%", flexShrink: 1 }}>
          <DateInput
            value={filter.date}
            setValue={(date) => setFilter({ ...filter, date })}
            granularity={granularity}
            onFocus={() => setIsActive(true)}
            isActive={isActive}
          />
        </div>
      </Row>
    </Column>
  );
  const util = isActive ? (
    <div ref={datePickerRef}>
      <DatePicker
        value={filter.date}
        setValue={(date) => setFilter({ ...filter, date })}
        maxLevel={granularity}
      />
    </div>
  ) : null;
  return { builder, util };
}

function useTimeBetweenBuilder(
  filter: TimeFilter,
  setFilter: (filter: TimeIsBetweenFilter) => void,
  type: "date" | "timestamp",
  typeDropdown: ReactElement
) {
  const [currentUtil, setCurrentUtil] = useState<
    | {
        date: Date;
        setValue: (value: Date) => void;
        key: string;
      }
    | undefined
  >(undefined);
  const startRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const datePickerRef = useRef<HTMLDivElement>(null);

  useClickOutside([startRef, endRef, datePickerRef], () => {
    setCurrentUtil(undefined);
  });

  if (filter.type !== "is_between") {
    return { builder: null, util: null };
  }

  const options = [
    { value: "year", label: "Year" },
    { value: "quarter", label: "Quarter" },
    { value: "month", label: "Month" },
    { value: "week", label: "Week" },
    { value: "day", label: "Day" },
  ] as { value: TimeGranularity; label: string }[];

  if (type === "timestamp") {
    options.push(
      { value: "hour", label: "Hour" },
      { value: "minute", label: "Minute" },
      { value: "second", label: "Second" }
    );
  }

  const granularity =
    type === "date" &&
    (filter.granularity === "second" ||
      filter.granularity === "minute" ||
      filter.granularity === "hour")
      ? "day"
      : filter.granularity;

  const builder = (
    <Column>
      <Row>
        <div style={{ width: "50%", flexShrink: 1 }}>{typeDropdown}</div>
        <div style={{ width: "50%", flexShrink: 1 }}>
          <SelectDropdown
            value={filter.granularity}
            options={options}
            onChange={(granularity) => setFilter({ ...filter, granularity })}
          />
        </div>
      </Row>
      <Row>
        <div ref={startRef}>
          <DateInput
            value={filter.start}
            setValue={(start) => setFilter({ ...filter, start })}
            granularity={granularity}
            onFocus={() =>
              setCurrentUtil({
                key: "start",
                date: filter.start,
                setValue: (start) => setFilter({ ...filter, start }),
              })
            }
            isActive={currentUtil?.key === "start"}
          />
        </div>
        <div ref={endRef}>
          <DateInput
            value={filter.end}
            setValue={(end) => setFilter({ ...filter, end })}
            granularity={granularity}
            onFocus={() =>
              setCurrentUtil({
                key: "end",
                date: filter.end,
                setValue: (end) => setFilter({ ...filter, end }),
              })
            }
            isActive={currentUtil?.key === "end"}
          />
        </div>
      </Row>
    </Column>
  );
  const util = currentUtil ? (
    <div ref={datePickerRef}>
      <DatePicker
        key={currentUtil.key}
        value={currentUtil.date}
        setValue={currentUtil.setValue}
        maxLevel={granularity}
      />
    </div>
  ) : null;
  return { builder, util };
}

function useTimeCustomBuilder(
  filter: TimeFilter,
  setFilter: (filter: TimeCustomFilter) => void,
  typeDropdown: ReactElement
) {
  if (filter.type !== "custom") {
    return { builder: null, util: null };
  }

  const builder = (
    <Column>
      {typeDropdown}
      <CodeInput
        value={filter.partial}
        setValue={(partial) => setFilter({ type: "custom", partial })}
        placeholder="!= null"
      />
    </Column>
  );

  const util = null;

  return { builder, util };
}
