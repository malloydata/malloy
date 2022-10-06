### Code For Wordlebot:

```malloy
// Make a table of 5 letter words
source: words is table('bigquery:malloy-data.malloytest.words') {
  query: five_letter_words is {
    where: length(word) = 5 and word ~ r'^[a-z]{5}$'
    project: word is UPPER(word)
  }
}

// table with numbers 1 to 5
source: numbers is table('bigquery:malloy-data.malloytest.numbers'){
  where: num <= 5
}

// Build a new table of word and each letter in position
query: words_and_position is from(words -> five_letter_words) {
  join_many: numbers // cross join numbers
} -> {
  group_by: word
  nest: letters is {
    order_by: 2
    group_by:
      letter is substr(word, numbers.num, 1)
      position is numbers.num
  }
}


// build a word finder that can generate a score best available guess.
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
