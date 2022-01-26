#  Letters and Positioning.

The query below produces a table with the numbers 1 to 5

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore: numbers is table('malloy-data.malloytest.numbers'){
  where: num <= 5
}
query: numbers->{project: num}
```


```malloy
--! {"isModel": true, "modelPath": "/inline/w1.malloy", "isHidden": true}
explore: words is table('malloy-data.malloytest.words'){
  query: five_letter_words is {
    where: length(word) = 5 and  word ~ r'^[a-z]{5}$'
    project: word is UPPER(word)
  }
}

explore: numbers is table('malloy-data.malloytest.numbers'){
  where: num <= 5
}
```

## Cross join these two tables to produce letter positioning.
The result is a table with nested data.  Each word contains a sub-table with a letter in each position.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100, "size":"large","source": "/inline/w1.malloy", "showAs":"json","dataStyles":{"letters":{"renderer":"list_detail"}}}
-- define the query
query: words_and_position is from(words->five_letter_words){
  -- Cross join is missing at the moment
  join_cross: numbers
  }
->{
  group_by: word
  nest: letters is {
    order_by: 2
    group_by: [
      letter is substr(word, numbers.num, 1)
      position is numbers.num
    ]
  }
}

-- run it
query: ->words_and_position
```
