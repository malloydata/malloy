# Puzzle #215

Wordlebot is writen in [Malloy](https://github.com/looker-open-source/malloy/).

Read about [How Wordlebot is constructed](wordle.md) (only 50 lines of code) and a good example of using data to solve interesting problems.

[Solved Puzzles](wordle5.md)

Query for best Starting words.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words
```


### Start with 'SAUCE' today (why not?)

<img src="https://user-images.githubusercontent.com/1093458/150361987-03d7beb1-69a4-475e-bc0a-d19b3f6e7e16.png" style="width: 200px">

### Query for words that
  * Don't have the letters 'SAUCE'

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words{
  where:
    -- word ~ r'[]'
    -- and word ~ r'.....'
     word !~ r'[SAUCE]'
}
```

### Best next word is 'BOOTY', trust double letters today.

<img src="https://user-images.githubusercontent.com/1093458/150362562-1cf95b86-d668-4f30-9b08-1caeb5d711ae.png" style="width: 200px">

### Query for words that
   * Contain 'B' and 'O' and 'T'
   * Don't have 'B' in the 1th spot and don't have 'O' in the thrid spot or 'T' in the forth spot.
   * Have O in the second spot
   * Don't have the Letters 'SAUCEY'.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words{
  where:
    word ~ r'B' and word ~ r'O' and word ~  r'T'
    and word ~ r'[^B]O[^O][^T].'
    and word !~ r'[SAUCEY]'
}
```

<img src="https://user-images.githubusercontent.com/1093458/150364799-2393cba1-5a86-40de-a0c2-60beba9617c0.png" style="width: 200px">

## Solved in 3!


### Code For Wordlbot:

```malloy

-- Make a table of 5 letter words
explore: words is table('malloy-data.malloytest.words'){
  query: five_letter_words is {
    where: length(word) = 5 and  word ~ r'^[a-z]....$'
    project: word is UPPER(word)
  }
}

-- Cross join numbers
explore: numbers is table('malloy-data.malloytest.numbers'){
  where: num <= 5

  -- code to fake a cross join
  primary_key: a -- key to fake a cross join
  dimension: a is 'a';
}

-- Build a new table of word and each letter in position
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

-- build a word finder that can generate a score best available guess.
explore: wordle is from(words_and_letters->words_and_position){
  where: word !~ r'(S|ED)$'
  measure: word_count is count()

  query: find_words is {
    group_by: [
      letters.letter
      letters.position
    ]
    aggregate: word_count
    nest: words_list is {
      group_by: word
    }
  }->{
    group_by: words_list.word
    aggregate: score is word_count.sum()
  }
}
```
