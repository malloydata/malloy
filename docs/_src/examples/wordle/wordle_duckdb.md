# Using DuckDB for Wordle Solver
Malloy natively supports DuckDB, allowing you to run Malloy models against DuckDB tables created from flat files (e.g. CSV, Parquet).
You can get started quickly by modifying two source definitions (below) from the Wordle Solver example in the documentation.
The below statements redefine the words and numbers sources using DuckDB instead of BigQuery.

Instead of loading the word list from BigQuery, import the local word file directly into DuckDB:

```
// INSTEAD OF THIS
// source: words is table('malloy-data.malloytest.words_bigger')

// USE THIS
sql: words_sql is  {
  connection: "duckdb"
  select: """
    SELECT *
    FROM read_csv_auto('/usr/share/dict/words', ALL_VARCHAR=1)
  """
}

source: words is from_sql(words_sql) {
  dimension: word is column0
  query: five_letter_words is {
    where: length(word) = 5
    project: word
  }
}
```

Instead of loading the numbers table from BigQuery, generate the same table using SQL:

```
// INSTEAD OF THIS
// source: numbers is table('malloy-data.malloytest.numbers') {
//   where: num <= 5
// }

// USE THIS
sql: nums_sql is  ||
  WITH recursive nums AS
   (SELECT 1 AS num
    UNION ALL
    SELECT num + 1 AS num
    FROM nums
    WHERE nums.num < 5)
  SELECT *
  FROM nums
  ;;
  on "duckdb"

source: numbers is from_sql(nums_sql) {}
```

The rest of the example code will run as expected
