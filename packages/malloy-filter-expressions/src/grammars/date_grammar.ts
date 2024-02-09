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
import {initializer} from './common/initializer';
import {numbers} from './common/numbers';
import {whitespace} from './common/whitespace';

const base = `

//LOOKER DATE GRAMMAR
ROOT = EXPRESSION

EXPRESSION = expression:( LOGICAL_EXPRESSION / TERM ) {
	return Object.assign({}, expression, {is:true})
}

LOGICAL_EXPRESSION = left:TERM _ type:LOGIC_SYMBOL _ right:EXPRESSION {
	return {
    	type:type.toLowerCase(),
        left: left,
        right: right,
        is: true
    }
}

TERM = term:(DATES /
       RELATIVE_RANGE /
       FROM_NOW /
       PAST_AGO /
       PAST /
       THIS_RANGE /
       THIS_NEXT /
       LAST /
       LAST_INTERVAL /
       DAY_INTERVAL /
       BEFORE_AFTER_THIS_NEXT_LAST /
       DAY_EXPRESSIONS /
       BEFORE_AFTER /
       FISCAL_QUARTER_RULE /
       FISCAL_YEAR_RULE /
       NULLS) {
           return Object.assign({}, term, {is: true})
       }

THIS_NEXT = type:("this"i / "next"i) _ unit:DAY_YEAR_UNITS {
	return {type:type.toLowerCase(), unit:unit}
}

LAST = type:("last"i) _ unit:INTERVAL_UNIT {
	return {type:type.toLowerCase(), unit:unit}
}

THIS_RANGE = "THIS "i startInterval:INTERVAL_UNIT " TO "i endInterval:INTERVAL_UNIT {
    return {
        type: 'thisRange',
        startInterval: startInterval,
        endInterval: endInterval
    }
}

PAST = interval:N_INTERVAL {
	return {type:'past', value:interval.value, unit:interval.unit}
}

PAST_AGO = interval:N_INTERVAL SPACE "AGO"i {
	return {type:'pastAgo', value:interval.value, unit:interval.unit}
}

LAST_INTERVAL = "last"i _ interval:N_INTERVAL {
	return {type:'lastInterval', value:interval.value, unit:interval.unit}
}

FROM_NOW = interval:N_INTERVAL SPACE "FROM NOW"i {
	return {type:'from now', value:interval.value, unit:interval.unit}
}

INTERVAL_TYPE = SPACE dir:("AGO"i/"FROM NOW"i) {
	return dir.toLowerCase() === "ago" ? "ago" : "from now"
}

RELATIVE_RANGE = startInterval:N_INTERVAL intervalType:INTERVAL_TYPE SPACE "for"i SPACE endInterval:N_INTERVAL  {
    if (startInterval.value === endInterval.value &&
        startInterval.unit === endInterval.unit) {
        return {
            type: 'past',
            value: startInterval.value,
            unit: startInterval.unit,
            complete: true
        }
    }
    return {type:'relative', intervalType:intervalType, startInterval:startInterval, endInterval:endInterval}

}

BEFORE_AFTER = prefix:(BEFORE / AFTER) SPACE interval:N_INTERVAL intervalType:INTERVAL_TYPE? {
    return {
        range: 'relative',
        value: interval.value,
        unit: interval.unit,
        type: prefix,
        fromnow: intervalType === 'from now'
    }
} / prefix:(BEFORE / AFTER) SPACE date:DATETIME {
    return { range: 'absolute', date: date, type: prefix}
}

BEFORE_AFTER_THIS_NEXT_LAST = prefix:(BEFORE / AFTER) _ type:("this"i / "next"i / "last"i) _ unit:DAY_YEAR_UNITS  {
    return {
        type:prefix.toLowerCase() + '_' + type,
        unit: unit
    }
}
RANGE = start:DATETIME SPACE "TO"i SPACE end:DATETIME {
		return {
        	type:'range',
            start:start,
            end:end
        }
    }

RANGE_INTERVAL = start:DATETIME SPACE "FOR"i SPACE end:N_INTERVAL {
		return {
        	type:'rangeInterval',
            start:start,
            end:end
        }
    }

YEAR_MONTH_INTERVAL = start:YEAR_MONTH_RULE SPACE "FOR"i SPACE end:N_INTERVAL {
    return {
        type:'monthInterval',
        year: start.year,
        month: start.month,
        end:end
    }
}

DAY_EXPRESSIONS = day:(DAY_OF_WEEK_KEYWORD / DAY_KEYWORD) {
      return {type:'day', day:day}
  }

DAY_INTERVAL = day:(DAY_EXPRESSIONS) _ "for"i _ interval:N_INTERVAL {
    return {type:'dayInterval',value:interval.value, unit:interval.unit}
}

N_INTERVAL = value:positiveInteger SPACE unit:INTERVAL_UNIT {
		return {type: 'interval', value:value, unit:unit}
	}

DATES = RANGE_INTERVAL /
        RANGE /
        DATETIME_RULE /
        YEAR_MONTH_INTERVAL /
        YEAR_QUARTER_RULE /
        YEAR_MONTH_RULE /
        YEAR_RULE

YEAR_RULE = year:YYYY {
	return {type:'year', year:year}
   }

FISCAL_YEAR_RULE = "FY" year:YYYY {
	return {type:'fiscalYear', year:year}
   }

FISCAL_QUARTER_RULE = fy:FISCAL_YEAR_RULE "-" quarter:("Q1"/"Q2"/"Q3"/"Q4") {
	return {type:'fiscalQuarter', year:fy.year, quarter:quarter}
   }

YEAR_MONTH_RULE = year:YYYY DATE_SEPARATOR month:MM {
    return {
        type: 'month',
        year:year,
        month:month
    }
}

YEAR_QUARTER_RULE = year:YYYY quarter:QUARTER_RULE {
    return {
        type: 'quarter',
        year:year,
        quarter:quarter
    }
}

NULLS = "NULL"i {
		return {type:'null'}
	} / "NOT NULL"i {
    	return {type: 'notnull'}
    }

// next month
THISNEXT = type:(THIS/NEXT) " " interval:INTERVAL_UNIT {
	return {
    	type: type.toLowerCase(),
        interval: interval.toLowerCase()
    }
}

// FY2018
FY = type:"fy"i fy:YYYY quarter:QUARTER_RULE ?{
		return Object.assign({}, {type:'datetime', fy:fy}, quarter)
    }

QUARTER_RULE = DATE_SEPARATOR "Q"i quarter:[1-4] {
	return {quarter:quarter}
}

DAY_KEYWORD = day:("today"i / "yesterday"i / "tomorrow"i) { return day.toLowerCase()}

DAY_OF_WEEK_KEYWORD = day:("monday"i / "tuesday"i / "wednesday"i / "thursday"i / "friday"i / "saturday"i / "sunday"i){ return day.toLowerCase()}

INTERVAL_UNIT = TIME_UNITS / DAY_YEAR_UNITS

// break units as used by the this/next/last expressions
TIME_UNITS = keyword:$(
           SECOND /
           MINUTE /
           HOUR) ("s"i)? {
             return keyword.toLowerCase()
           }
// units used by
DAY_YEAR_UNITS = keyword:$(
           DAY /
           WEEK /
           MONTH /
           QUARTER/
           FISCAL_QUARTER /
           YEAR /
           FISCAL_YEAR) ("s"i)? {
             return keyword.toLowerCase()
           }


// 2019/01/01 08:45:00
DATETIME_RULE = datetime: DATETIME {
    return {
        type: 'on',
        date: datetime
    }
}

DATETIME = date:DATE time:(TIME)? {
	let result = Object.assign({}, date, time)
    return result
}

DATE = year:YYYY mm_rule:MM_RULE {
  return Object.assign({}, { year: year || '' }, mm_rule)
}

MM_RULE = DATE_SEPARATOR month:MM dd_rule:DD_RULE {
	return Object.assign({}, { month: month || '' }, dd_rule)
}

DD_RULE = DATE_SEPARATOR day:DD { return {day:day} }

TIME = SPACE hour:hh TIME_SEPARATOR minute:mm second:ss? {
  let result = {hour: hour, minute: minute, second: second || ''}
  return result
}

ss = TIME_SEPARATOR second: mm {
	return second
}

DATE_SEPARATOR = ("/" / "-")
TIME_SEPARATOR = ":"

LOGIC_SYMBOL = ","

THIS = "this"i
NEXT = "next"i

SECOND = "second"i
MINUTE = "minute"i
HOUR = "hour"i
DAY = "day"i
WEEK ="week"i
MONTH = "month"i
QUARTER = "quarter"i
FISCAL_QUARTER = "fiscal quarter"i
YEAR = "year"i
FISCAL_YEAR = "fiscal year"i

BEFORE = "before"i {return 'before'}
AFTER = "after"i {return 'after'}

DD = value:([0][1-9]/[1][0-9]/[2][0-9]/[3][0-1]) {return value.join('')}
MM = value:([0][1-9]/[1][0-2]) {return value.join('')}
YYYY = value:([0-9][0-9][0-9][0-9]) {return value.join('')}

hh = value:([0][0-9]/[1][0-9]/[2][0-3]) {return value.join('')}
mm = value:([0][0-9]/[1][0-9]/[2][0-9]/[3][0-9]/[4][0-9]/[5][0-9]) {return value.join('')}
`;

export const dateGrammar = [initializer, base, numbers, whitespace].join('');
