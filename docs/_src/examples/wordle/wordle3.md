
```malloy
--! {"isModel": true, "modelPath": "/inline/w1.malloy", "isHidden":true}

source: words is table('malloy-data.malloytest.words_bigger'){
  query: five_letter_words is {
    where: length(word) = 5 and  word ~ r'^[a-z]....$'
    project: word is UPPER(word)
  }
}

source: numbers is table('malloy-data.malloytest.numbers'){
  where: num <= 5

  -- code to fake a cross join
  primary_key: a -- key to fake a cross join
  dimension: a is 'a';
}

source: words_and_letters is from(words->five_letter_words){
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

```malloy
--! {"isModel": true, "modelPath": "/inline/w2.malloy", "source": "/inline/w1.malloy", "isHidden":true}
source: wordle is from(words_and_letters -> words_and_position) {
  where: word !~ r'(S|ED)$'
  measure: word_count is count()
}
```


# Letters and Positions

This query finds the most common letter-position matches.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w2.malloy", "showAs":"html"}
query: wordle -> {
  group_by: [
    letters.letter
    letters.position
  ]
  aggregate: word_count
}
```

## Adding a wordlist

We can see that 'E' in position 5 occurs in 498 words, 'S' in position 1  occurs in 441 words.  Words ending in 'Y' are surprisingly common.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w2.malloy", "showAs":"html"}
query: wordle -> {
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
--! {"isModel": true, "modelPath": "/inline/w4.malloy", "source": "/inline/w1.malloy"}
source: wordle is from(words_and_letters -> words_and_position) {
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
}
```

## How many words with have an 'O' in the second position have a 'Y' and don't have 'SLA'

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w4.malloy", "showAs":"html"}
query: wordle -> find_words {
  where: [
    word ~ r'[Y]',
    word ~ r'.O...',
    word !~ r'[SLA]'
  ]
}
```

## How to pick the next word?

We'd like to pick a word that is going to lead to the most will reveal the most about the most words.
We can produce a word score by taking our find word query and mapping back to words.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w4.malloy", "showAs":"html"}
query: wordle -> find_words -> {
  group_by: words_list.word
  aggregate: score is word_count.sum()
}
```

## This looks pretty useful, lets make `find_words` return a score.

```malloy
--! {"isModel": true, "modelPath": "/inline/w5.malloy", "source": "/inline/w1.malloy"}
source: wordle is from(words_and_letters -> words_and_position) {
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
  } -> {
    group_by: words_list.word
    aggregate: score is word_count.sum()
  }
}
```

## How many words with have an 'O' in the second position have a 'Y' and don't have 'SLA'
The score should give us then best pick.

```malloy
--! {"isRunnable": true,  "isPaginationEnabled": false, "pageSize": 100, "size":"small","source": "/inline/w5.malloy", "showAs":"html"}
query: wordle -> find_words {
  where: [
    word ~ r'[Y]',
    word ~ r'.O...',
    word !~ r'[SLA]'
  ]
}
```
