# Puzzle #214

Wordlebot is writen in [Malloy](https://github.com/looker-open-source/malloy/).

Read about [How Wordlebot is constructed](wordle.md) (only 50 lines of code) and a good example of using data to solve interesting problems.

[Solved Puzzles](wordle5.md)


Query for best Starting words.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words
```

Start with a word without duplicates to get coverage.  Today we choose 'SLATE'

<img src="https://user-images.githubusercontent.com/1093458/150233754-adc4c730-73ce-4430-8640-07bfc512529a.png" style="width: 200px">

Query for words that Contain 'T', don't have 'T' in the 4th spot and don't have the Letters 'SLAE'. Rank them by the number
of possible space matches.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words{
  where:
    word ~ r'T'
    and word ~ r'...[^T].'
    and word !~ r'[SLAE]'
}
```

'TIGHT" has two Ts so skip it. Next best word..  'TOUCH'

<img src="https://user-images.githubusercontent.com/1093458/150234599-e90ab598-84e7-434f-bcba-5279c96d7ede.png" style="width: 200px">

Query for words that Contain 'T', don't have 'T' in the 1st and 4th spot.  Has O in the second spot.  and don't have the Letters 'SLAEUCH'.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words{
  where:
    word ~ r'T'
    and word ~ r'[^T]O.[^T].'
    and word !~ r'[SLAEUCH]'
}
```

<img src="https://user-images.githubusercontent.com/1093458/150234924-895245c0-0a1c-48be-a14a-7ca23465dca0.png" style="width: 200px">

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "wordle/wordlebot.malloy", "showAs":"html"}
query: wordle->find_words{
  where:
    word ~ r'T'
    and word ~ r'[^TJ]OINT'
    and word !~ r'[SLAEUCH]'
}
```
<img src="https://user-images.githubusercontent.com/1093458/150235059-6621374b-e083-472f-965c-54ca21a8c433.png" style="width: 200px">



## Solved in 4!


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
