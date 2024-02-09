/*

 MIT License

 Copyright (c) 2022 Looker Data Sciences, Inc.

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in all
 copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 SOFTWARE.

 */
import {convertToNumber} from './convert_to_number';
import {zeroPad2} from './zero_pad';

export interface TimeFormatProps {
  hour: number;
  minute?: number;
  meridiem?: string;
}

const meridiemChange = 12;
const hourCeil = 24;
const minuteCeil = 60;
const defaultMinuteValue = 0;

const meridiemAm = 'AM';
const meridiemPm = 'PM';

export const allowedTimeInputValues = /\d|[a|p|m]|\s|^$/gi;

const exactTimeMatch = /^(0[0-9]|1[0-9]|2[0-3]|[0-9]):([0-5][0-9])\s(am|pm)$/gi;

/**
 * Given any hour value this will ensure that the houra never get higher than 23
 */
const maxHourValue = (hour: number) =>
  hour <= 0 || hour >= hourCeil ? 0 : hour;

/**
 * Given any minute value this will ensure that the minutes never get higher than 59
 */
const maxMinuteValue = (minute: number) =>
  !minute || minute < 0 || minute >= minuteCeil ? 0 : minute;

/**
 * Given a time segmented object this will use the provided hour
 * to ensure that the provided meridiem is an accurate match.
 * If it is not it will be replaced.
 * ex. - an input of { hour: 20, meridiem: 'am'} will return 'PM'
 */
const getAccurateMeridiem = ({hour, meridiem = meridiemAm}: TimeFormatProps) =>
  hour > meridiemChange ? meridiemPm : meridiem.toUpperCase();

export const meridiemFrom24HourTime = (hour: number) =>
  hour >= meridiemChange && hour < hourCeil ? meridiemPm : meridiemAm;
/**
 * Given any number input this will return an appropriate 12 hour time value
 * If the number is larger than an acceptable input value within a 24 hour range
 * the return will default to 12
 *
 * @param hour Number
 */
const get12HourTimeValue = (hour: number) => {
  if (hour > meridiemChange) {
    hour = hour - meridiemChange;
  }

  if (hour === 0) {
    hour = meridiemChange;
  }

  return hour;
};

/**
 * Takes an object of time segments and returns a formatted
 * 12 hour time string
 */
export const displayTimeAsIs = ({
  hour,
  minute = defaultMinuteValue,
  meridiem = '',
}: TimeFormatProps) => `${hour}:${zeroPad2(minute)} ${meridiem}`.trim();

/**
 * Given an TimeFormatProps object it will convert to a 12 hour format.
 * ex. {hour: 14, minute: 0, meridiem: ''}  will return "2:00 PM"
 */
export const formatAndDisplayTime = ({
  hour,
  minute = 0,
  meridiem = meridiemAm,
}: TimeFormatProps) =>
  displayTimeAsIs({
    hour: get12HourTimeValue(maxHourValue(hour)),
    minute: maxMinuteValue(minute),
    meridiem: getAccurateMeridiem({
      hour: maxHourValue(hour),
      meridiem,
    }),
  });

/**
 * Given an TimeFormatProps object it will convert to a 24 hour format.
 * ex. {hour: 2, minute: 0, meridiem: 'pm'} will return { hour: '14', minute: '00', meridiem: 'pm'}
 */
export const get24HourTime = ({
  hour,
  minute = 0,
  meridiem = '',
}: TimeFormatProps) => {
  hour = maxHourValue(hour);
  if (meridiem.toUpperCase() === meridiemPm && hour < meridiemChange) {
    hour = meridiemChange + hour;
  }

  return {
    hour,
    minute: maxMinuteValue(minute),
    meridiem: hour < meridiemChange ? meridiemAm : meridiemPm,
  };
};

export const parseTimeInput = (inputValue: string): TimeFormatProps => {
  const [hour, minute, meridiem] = inputValue
    .split(exactTimeMatch)
    .filter(Boolean);
  return {
    hour: convertToNumber(hour),
    minute: convertToNumber(minute),
    meridiem,
  };
};

/**
 * Tests if the time value is correctly formatted. The only acceptable format is as follows
 * HH:MM (AM | PM)
 * @param input : string
 */
export const isTimeAndFormatAccurate = (input: string): boolean =>
  !!input.match(exactTimeMatch);
