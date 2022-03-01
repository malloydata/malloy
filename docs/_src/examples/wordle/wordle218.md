# Puzzle #218
_January 23, 2022_

[⬅️ Previous Puzzle](wordle217.md)   |   [↩️ All Solved Puzzles](wordle5.md)  |  [➡️ Next Puzzle](wordle219.md)

Wordlebot is written in [Malloy](https://github.com/looker-open-source/malloy/). Read about [How Wordlebot is constructed](wordle.md) (only 50 lines of code) and a good example of using data to solve interesting problems.

Today was a bit of a kerfuffle.  It turns out that the word list we were using was too small and missing the
word we were searching for.  We found a larger dictionary and uploaded and re-ran.


## Query for the best starting words.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle -> find_words
```

Skipping 'SAREE' and 'SOOTY' to avoid duplicates this early in the game, let's go with 'SAUCE' again.

<img src="/malloy/img/wordle218a.png" style="width: 200px">

## The Second Guess
'C' as yellow in the 4th position.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle -> find_words {
  where:
    word ~ r'C'
    and word ~ r'...[^C].'
    and word !~ r'[SAUE]'
}
```

Wow, lots of double letter words, let's skip them this early in the game and pick 'CHOIR'

<img src="/malloy/img/wordle218b.png" style="width: 200px">

## Bang!  There is is 'CRIMP' in 3 guesses
In three.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle -> find_words {
  where:
    word ~ r'C' and word ~r'I' and word ~r'R'
    and word ~ r'C..[^CI][^R]'
    and word !~ r'[SAUEHO]'
}
```

<img src="/malloy/img/wordle218c.png" style="width: 200px">


[⬅️ Previous Puzzle](wordle217.md)   |   [↩️ All Solved Puzzles](wordle5.md)  |  [➡️ Next Puzzle](wordle219.md)


### Code For Wordlebot:

```malloy
// Make a table of 5 letter words
source: words is table('malloy-data.malloytest.words') {
  query: five_letter_words is {
    where: length(word) = 5 and word ~ r'^[a-z]{5}$'
    project: word is upper(word)
  }
}

// Cross join numbers
source: numbers is table('malloy-data.malloytest.numbers') {
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
