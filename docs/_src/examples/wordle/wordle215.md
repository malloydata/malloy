# Puzzle #215
_January 20, 2022_

[⬅️ Previous Puzzle](wordle214.md)   |   [↩️ All Solved Puzzles](wordle5.md)  |  [➡️ Next Puzzle](wordle216.md)

Wordlebot is written in [Malloy](https://github.com/looker-open-source/malloy/). Read about [How Wordlebot is constructed](wordle.md) (only 50 lines of code) and a good example of using data to solve interesting problems.

Query for best starting words.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words
```


### Start with 'SAUCE' today (why not?)

<img src="/malloy/img/wordle215a.png" style="width: 200px">

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

<img src="/malloy/img/wordle215b.png" style="width: 200px">

### Query for words that
   * Contain 'B' and 'O' and 'T'
   * Don't have 'B' in the first spot and don't have 'O' in the third spot or 'T' in the forth spot.
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


<img src="/malloy/img/wordle215c.png" style="width: 200px">

## Solved in 3!

[⬅️ Previous Puzzle](wordle214.md)   |   [↩️ All Solved Puzzles](wordle5.md)  |  [➡️ Next Puzzle](wordle216.md)

### Code For Wordlbot:

```malloy
-- Make a table of 5 letter words
explore: words is table('malloy-data.malloytest.words'){
  query: five_letter_words is {
    where: length(word) = 5 and  word ~ r'^[a-z]{5}$'
    project: word is UPPER(word)
  }
}

-- Cross join numbers
explore: numbers is table('malloy-data.malloytest.numbers'){
  where: num <= 5
}

-- Build a new table of word and each letter in position
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


-- build a word finder that can generate a score best available guess.
explore: wordle is from(->words_and_position){
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
  }
  ->{
    group_by: words_list.word
    aggregate: score is word_count.sum()
  }
}

```
