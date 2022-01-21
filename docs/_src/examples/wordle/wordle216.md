# Puzzle #216
_January 21, 2022_

[⬅️ Previous Puzzle](wordle215.md)   |   [↩️ All Solved Puzzles](wordle5.md)

Wordlebot is writen in [Malloy](https://github.com/looker-open-source/malloy/). Read about [How Wordlebot is constructed](wordle.md) (only 50 lines of code) and a good example of using data to solve interesting problems.


## Query for the best starting words.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words
```

Start with a word without duplicates to get coverage. We'll run with 'SLATE' as our starter again today.

<img src="/malloy/img/wordle216a.png" style="width: 200px">

## The Second Guess
Oof--no matches. Now what? We'll query for words that don't contain any of these characters, and rank them by the number of possible space matches.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words{
  where:
    word !~ r'[SLATE]'
}
```

'CRONY' looks good, let's run with that.

<img src="/malloy/img/wordle216b.png" style="width: 200px">

## Round 3: Tie Breaking
'CRONY' gave us one match and a yellow tile, so we'll query for words with 'R' in the second positon, and that contain 'C', but not in the first position.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words{
  where:
    word ~ r'C' and word ~ r'R'
    and word ~ r'[^C]R...'
    and word !~ r'[SLATEONY]'
}
```

Just two words left and at this point it's really a matter of luck--we can take a guess at what we think the creators used, but if we want Malloy to make all the decisions for us, as a somewhat nonsensical tiebreaker, why don't we see which letter appears more often in the dataset overall:

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
  query: wordle ->{
    group_by: letters.letter
    aggregate: [
      word_count
      use_count is letters.count()
    ]
  }
  ```

'P' appears a little bit more often than 'B'; we'll go with that.

<img src="/malloy/img/wordle216c.png" style="width: 200px">


## Solved in 3.5?
It doesn't really feel like we can give ourselves this one with equal scores on the two words and an arbitrary tiebreaker at the end, so let's call it 3.5 this time.

[⬅️ Previous Puzzle](wordle215.md)   |   [↩️ All Solved Puzzles](wordle5.md)


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
