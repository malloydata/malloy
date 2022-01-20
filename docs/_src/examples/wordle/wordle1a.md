#  Letters and Positioning.

The query below produces a table with the numbers 1 to 5

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore: numbers is table('malloy-data.malloytest.numbers'){
  where: num <= 5

  -- code to fake a cross join
  primary_key: a -- key to fake a cross join
  dimension: a is 'a';
}
query: numbers->{project: num}
```


```malloy
--! {"isModel": true, "modelPath": "/inline/w1.malloy", "isHidden": true}
explore: words is table('malloy-data.malloytest.words'){
  query: five_letter_words is {
    where: length(word) = 5 and  word ~ r'^[a-z]....$'
    project: word is UPPER(word)
  }
}

explore: numbers is table('malloy-data.malloytest.numbers'){
  where: num <= 5

  -- code to fake a cross join
  primary_key: a -- key to fake a cross join
  dimension: a is 'a';
}
```

## Cross join these two tables to produce letter posiitioning.
The result is a table with nested data.  Each word contans a sub-table with a letter in each position.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100, "size":"large","source": "/inline/w1.malloy", "showAs":"json","dataStyles":{"letters":{"renderer":"list_detail"}}}
explore: words_and_letters is from(words->five_letter_words){
  -- Cross join is missing at the moment
  join: numbers on a
  dimension: a is 'a' -- key to fake a cross join

  query: words_and_position is {
    group_by: word
    nest: letters is {
      order_by: 2
      group_by: [
        letter is substr(word, numbers.num, 1)
        position is numbers.num

      ]
    }
  }
}
query: words_and_letters->words_and_position
```