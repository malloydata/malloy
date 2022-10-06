# Puzzle #219
_January 24, 2022_

[⬅️ Previous Puzzle](wordle218.md)   |   [↩️ All Solved Puzzles](wordle5.md)

Wordlebot is written in [Malloy](https://github.com/looker-open-source/malloy/). Read about [How Wordlebot is constructed](wordle.md) (only 50 lines of code) and a good example of using data to solve interesting problems.


## Query for the best starting words

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle -> find_words
```

We'll open up with 'SAUCE' again today (skipping those double-letter words this early on).

<img src="/malloy/img/wordle219a.png" style="width: 200px">

## The Second Guess
Nothing on 'SAUCE'--let's look for our top scoring words excluding these characters.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle -> find_words {
  where: word !~ r'[SAUCE]'
}
```

Still feels a bit early for double letters, so we're running with 'DOILY'

<img src="/malloy/img/wordle219b.png" style="width: 200px">

## Round 3/4: More Creative Tie-breaking
 With one green and one yellow match we're down to two possible words.

 ```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle -> find_words {
  where:
    word ~ r'O',
    word ~ r'.[^O].L.',
    word !~ r'[SAUCEDIY]'
}
```

 Today, why don't we see whether 'KN' or 'TR' appear more commonly as starts for words in our dataset.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle -> find_words {
  where: word ~ r'^KN' or word ~ r'^TR'
} -> {
  group_by: start_leters is substr(word, 0, 2)
  aggregate: word_score is sum(score)
}
```

<img src="/malloy/img/wordle219c.png" style="width: 200px">

Our luck on these tie-breakers really hasn't been so great, but all in all another 3.5 day isn't half bad!

[⬅️ Previous Puzzle](wordle218.md)   |   [↩️ All Solved Puzzles](wordle5.md)


### Code For Wordlebot:

```malloy
// Make a table of 5 letter words
source: words is table('bigquery:malloy-data.malloytest.words') {
  query: five_letter_words is {
    where: length(word) = 5 and word ~ r'^[a-z]{5}$'
    project: word is upper(word)
  }
}

// Cross join numbers
source: numbers is table('bigquery:malloy-data.malloytest.numbers') {
  where: num <= 5
}

// Build a new table of word and each letter in position
query: words_and_position is from(words->five_letter_words) {
  // Cross join is missing at the moment
  join_cross: numbers
} -> {
  group_by: word
  nest: letters is {
    order_by: 2
    group_by:
      letter is substr(word, numbers.num, 1)
      position is numbers.num
  }
}

// Build a word finder that can generate a score best available guess
source: wordle is from(-> words_and_position) {
  where: word !~ r'(S|ED)$'
  measure: word_count is count()

  query: find_words is {
    group_by:
      letters.letter
      letters.position
    aggregate: word_count
    nest: words_list is {
      group_by: word
    }
  } -> {
    group_by: words_list.word
    aggregate: score is word_count.sum()
  }
}
```
