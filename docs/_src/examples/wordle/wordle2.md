
```malloy
--! {"isModel": true, "modelPath": "/inline/w1.malloy", "isHidden":true}

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

explore: words_and_letters is from(words->five_letter_words){
  -- Cross join is missing at the moment
  join_one: numbers with a
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
```

# Understanding Letter Frequency

Starting with the query we built in step one, we built a query that produces a table of words with subtable where
each row is the letter and position in that row.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"medium","source": "/inline/w1.malloy","showAs":"html","dataStyles":{"letters":{"renderer":"list_detailx"}}}
query: words_and_letters->words_and_position
```


## Create a new expore `wordle` to query the data in this form.

```malloy
--! {"isModel": true, "modelPath": "/inline/w2.malloy", "source": "/inline/w1.malloy"}
explore: wordle is from(words_and_letters->words_and_position){
  measure: word_count is count()
}
```

## How many 5 letter words are there?

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w2.malloy", "showAs":"html"}
query: wordle->{aggregate: word_count}
```

## What are the most common letters if 5 letter words?
We can count both the number of words that contain the letter and the number of uses.  Many words have the same
letter more than once.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w2.malloy", "showAs":"html"}
query: wordle->{
  group_by: letters.letter
  aggregate: [
  word_count
      use_count is letters.count()
  ]
}
```

## Common Letters and Positions

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"large","source": "/inline/w2.malloy", "showAs":"html"}
query: wordle->{
  group_by: letters.letter
  aggregate: [
    word_count
    use_count is letters.count()
  ]
  nest: positition_order_bar_chart is {
    group_by: letters.position
    aggregate: word_count
  }
}
```

## Removing Plurals and words that end in 'ED'
We've noticed there are a lots of words that end in 'S' or 'ED' in the dataset, but in our experience they don't often appear in puzzles.  We've eliminated them from our model for now, by filtering them out on the explore level:

```malloy
--! {"isModel": true, "modelPath": "/inline/w3.malloy", "source": "/inline/w1.malloy"}
explore: wordle is from(words_and_letters->words_and_position){
  where: word !~ r'(S|ED)$'
  measure: word_count is count()
}
```

## Now how many 5 letter words are there?

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w3.malloy", "showAs":"html"}
query: wordle->{aggregate: word_count}
```
