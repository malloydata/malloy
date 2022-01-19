
```malloy
--! {"isModel": true, "modelPath": "/inline/w1.malloy", "isHidden":true}

explore: words is table('malloy-data.wordle.words'){
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
```

```malloy
--! {"isModel": true, "modelPath": "/inline/w3.malloy", "source": "/inline/w1.malloy", "isHidden":true}
explore: wordle is from(words_and_letters->words_and_position){
  where: word !~ r'(S|ED)$'
  measure: word_count is count()
}
```


# Letters and Positions

We can see that 'E' in position 5 occurs in 397 words, 'S' in position 1  occurs in 343 words.  Words ending in 'Y' are
surprisingly common.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w3.malloy", "showAs":"html"}
query: wordle->{
  group_by: [
    letters.letter
    letters.position
  ]
  aggregate: word_count
}
```

## Adding a wordlist

We can see that 'E' in position 5 occurs in 397 words, 'S' in position 1  occurs in 343 words.  Words ending in 'Y' are
surprisingly common.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w3.malloy", "showAs":"html"}
query: wordle->{
  group_by: [
    letters.letter
    letters.position
  ]
  aggregate: word_count
  nest: words_list is {
    group_by: word
  }
}
```

## Add this to our Model

```malloy
--! {"isModel": true, "modelPath": "/inline/w3.malloy", "source": "/inline/w1.malloy"}
explore: wordle is from(words_and_letters->words_and_position){
  where: word !~ r'(S|ED)$'
  measure: word_count is count()

  query: find_words{
    group_by: [
      letters.letter
      letters.position
    ]
    aggregate: word_count
    nest: words_list is {
      group_by: word
    }
  }
}
```

## How many words with X or Y

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w3.malloy", "showAs":"html"}
query: wordle->find_words{where: word ~ r'[xy]'}
```