-- example of how to take a json blob and insert it into a postgres database
--  keeping around because it might be useful as we add new tables.

create type t as (state varchar, aircraft_count int, airport_count int, births int, popular_name varchar);
create table malloytest.state_facts as (
select p.*
from json_populate_recordset(null::t,'[
      {
        "state": "MN",
        "aircraft_count": "83",
        "airport_count": "507",
        "births": "5574819",
        "popular_name": "Ava"
      },
      {
        "state": "LA",
        "aircraft_count": "57",
        "airport_count": "500",
        "births": "5551025",
        "popular_name": "Ava"
      },
      {
        "state": "IA",
        "aircraft_count": "28",
        "airport_count": "319",
        "births": "4108689",
        "popular_name": "Ava"
      },
      {
        "state": "IN",
        "aircraft_count": "62",
        "airport_count": "643",
        "births": "7170553",
        "popular_name": "Emma"
      },
      {
        "state": "NC",
        "aircraft_count": "72",
        "airport_count": "400",
        "births": "8440235",
        "popular_name": "Emma"
      },
      {
        "state": "AR",
        "aircraft_count": "31",
        "airport_count": "299",
        "births": "3330382",
        "popular_name": "Emma"
      },
      {
        "state": "AL",
        "aircraft_count": "58",
        "airport_count": "260",
        "births": "5645599",
        "popular_name": "Emma"
      },
      {
        "state": "MT",
        "aircraft_count": "50",
        "airport_count": "259",
        "births": "942521",
        "popular_name": "Emma"
      },
      {
        "state": "ME",
        "aircraft_count": "12",
        "airport_count": "164",
        "births": "1383204",
        "popular_name": "Emma"
      },
      {
        "state": "VA",
        "aircraft_count": "67",
        "airport_count": "421",
        "births": "6693880",
        "popular_name": "Olivia"
      },
      {
        "state": "NE",
        "aircraft_count": "24",
        "airport_count": "308",
        "births": "2255039",
        "popular_name": "Olivia"
      },
      {
        "state": "ID",
        "aircraft_count": "36",
        "airport_count": "238",
        "births": "1147445",
        "popular_name": "Olivia"
      },
      {
        "state": "UT",
        "aircraft_count": "53",
        "airport_count": "140",
        "births": "2306033",
        "popular_name": "Olivia"
      },
      {
        "state": "AK",
        "aircraft_count": "85",
        "airport_count": "608",
        "births": "407106",
        "popular_name": "Sophia"
      },
      {
        "state": "WI",
        "aircraft_count": "66",
        "airport_count": "543",
        "births": "6088288",
        "popular_name": "Sophia"
      },
      {
        "state": "MI",
        "aircraft_count": "102",
        "airport_count": "489",
        "births": "11643455",
        "popular_name": "Sophia"
      },
      {
        "state": "WA",
        "aircraft_count": "114",
        "airport_count": "484",
        "births": "4631964",
        "popular_name": "Sophia"
      },
      {
        "state": "OR",
        "aircraft_count": "94",
        "airport_count": "441",
        "births": "2671780",
        "popular_name": "Sophia"
      },
      {
        "state": "ND",
        "aircraft_count": "26",
        "airport_count": "436",
        "births": "1059330",
        "popular_name": "Sophia"
      },
      {
        "state": "MD",
        "aircraft_count": "30",
        "airport_count": "229",
        "births": "4468717",
        "popular_name": "Sophia"
      },
      {
        "state": "SD",
        "aircraft_count": "23",
        "airport_count": "180",
        "births": "1049223",
        "popular_name": "Sophia"
      },
      {
        "state": "NH",
        "aircraft_count": "30",
        "airport_count": "112",
        "births": "955057",
        "popular_name": "Sophia"
      },
      {
        "state": "VT",
        "aircraft_count": "6",
        "airport_count": "81",
        "births": "545999",
        "popular_name": "Sophia"
      },
      {
        "state": "DE",
        "aircraft_count": "118",
        "airport_count": "42",
        "births": "615490",
        "popular_name": "Sophia"
      },
      {
        "state": "MS",
        "aircraft_count": "27",
        "airport_count": "243",
        "births": "3969549",
        "popular_name": "Madison"
      },
      {
        "state": "SC",
        "aircraft_count": "28",
        "airport_count": "189",
        "births": "4392042",
        "popular_name": "Madison"
      },
      {
        "state": "DC",
        "aircraft_count": "6",
        "airport_count": "20",
        "births": "1419047",
        "popular_name": "Madison"
      },
      {
        "state": "TX",
        "aircraft_count": "287",
        "airport_count": "1845",
        "births": "21467359",
        "popular_name": "Isabella"
      },
      {
        "state": "CA",
        "aircraft_count": "367",
        "airport_count": "984",
        "births": "28810563",
        "popular_name": "Isabella"
      },
      {
        "state": "IL",
        "aircraft_count": "111",
        "airport_count": "890",
        "births": "15178876",
        "popular_name": "Isabella"
      },
      {
        "state": "FL",
        "aircraft_count": "228",
        "airport_count": "856",
        "births": "9277223",
        "popular_name": "Isabella"
      },
      {
        "state": "PA",
        "aircraft_count": "83",
        "airport_count": "804",
        "births": "16661910",
        "popular_name": "Isabella"
      },
      {
        "state": "OH",
        "aircraft_count": "106",
        "airport_count": "749",
        "births": "14201526",
        "popular_name": "Isabella"
      },
      {
        "state": "NY",
        "aircraft_count": "91",
        "airport_count": "576",
        "births": "23694136",
        "popular_name": "Isabella"
      },
      {
        "state": "MO",
        "aircraft_count": "62",
        "airport_count": "537",
        "births": "6792279",
        "popular_name": "Isabella"
      },
      {
        "state": "OK",
        "aircraft_count": "99",
        "airport_count": "443",
        "births": "4137117",
        "popular_name": "Isabella"
      },
      {
        "state": "GA",
        "aircraft_count": "98",
        "airport_count": "440",
        "births": "8183223",
        "popular_name": "Isabella"
      },
      {
        "state": "CO",
        "aircraft_count": "98",
        "airport_count": "425",
        "births": "3424936",
        "popular_name": "Isabella"
      },
      {
        "state": "KS",
        "aircraft_count": "63",
        "airport_count": "415",
        "births": "3212573",
        "popular_name": "Isabella"
      },
      {
        "state": "NJ",
        "aircraft_count": "47",
        "airport_count": "378",
        "births": "8318769",
        "popular_name": "Isabella"
      },
      {
        "state": "AZ",
        "aircraft_count": "98",
        "airport_count": "319",
        "births": "3328182",
        "popular_name": "Isabella"
      },
      {
        "state": "TN",
        "aircraft_count": "62",
        "airport_count": "285",
        "births": "6313851",
        "popular_name": "Isabella"
      },
      {
        "state": "MA",
        "aircraft_count": "40",
        "airport_count": "225",
        "births": "7576933",
        "popular_name": "Isabella"
      },
      {
        "state": "KY",
        "aircraft_count": "26",
        "airport_count": "202",
        "births": "5352594",
        "popular_name": "Isabella"
      },
      {
        "state": "NM",
        "aircraft_count": "46",
        "airport_count": "181",
        "births": "1640394",
        "popular_name": "Isabella"
      },
      {
        "state": "CT",
        "aircraft_count": "25",
        "airport_count": "153",
        "births": "3361014",
        "popular_name": "Isabella"
      },
      {
        "state": "NV",
        "aircraft_count": "55",
        "airport_count": "128",
        "births": "842854",
        "popular_name": "Isabella"
      },
      {
        "state": "WV",
        "aircraft_count": "13",
        "airport_count": "116",
        "births": "2962442",
        "popular_name": "Isabella"
      },
      {
        "state": "WY",
        "aircraft_count": "15",
        "airport_count": "115",
        "births": "423000",
        "popular_name": "Isabella"
      },
      {
        "state": "HI",
        "aircraft_count": "10",
        "airport_count": "52",
        "births": "950538",
        "popular_name": "Isabella"
      },
      {
        "state": "RI",
        "aircraft_count": "5",
        "airport_count": "28",
        "births": "1148302",
        "popular_name": "Isabella"
      }
    ]') as p
);
