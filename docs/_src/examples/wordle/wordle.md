# A Perfect Solver for Wordle using Data

[Worldle](https://www.powerlanguage.co.uk/wordle/) is an interesting, challenging and fun word game.  If you aren't familiar with it, I suggest that you play it before reading this article

## Step 1 - Raw Materials

## Five letter Words
The first thing we need is a word list.  It turns out that on most unix systems there is a world list can be
found at `/usr/share/dict/words`.  The file has a single word per line, so I just uploaded the entire files (as a CSV)
into BigQuery.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore: words is table('malloy-data.malloytest.words'){}

query: words->{project: *}
```

We are only interested in 5 letter words so create a query for that and
limit the results to 5 letter words.


```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100}
explore: words is table('malloy-data.malloytest.words'){
  query: five_letter_words is {
    where: length(word) = 5  // add a filter
    project: word
  }
}

query: words->five_letter_words
```

Notice that there are a bunch of proper names?  Let's look for only lowercase words as input
and Uppercase words in the output of our query.

```malloy
--! {"isModel": true, "modelPath": "/inline/w1.malloy"}

explore: words is table('malloy-data.malloytest.words'){
  query: five_letter_words is {
    where: length(word) = 5 and  word ~ r'^[a-z]....$'
    project: word is UPPER(word)
  }
}
```

and the query:
```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100, "size":"large","source": "/inline/w1.malloy", "showAs":"html","dataStyles":{"letters":{"renderer":"list_detail"}}}
query: words->five_letter_words
```


## Searching for Words

Regular expressions are great for matching words.  We are going to use three patterns.

### Yellow - This letter exists somewhere in the word.

Word has an X or Y in it.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100, "size":"large","source": "/inline/w1.malloy", "showAs":"html","dataStyles":{"five_letter_words":{"renderer":"list"}}}
query: words->five_letter_words->{
  where: word ~ r'[XY]'
  project: word
}
```

### Green -  The Letter is a particular position or can't be a particular letter

Word has n M in the 4th position and the 5 position is not E or Z

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100, "size":"large","source": "/inline/w1.malloy", "showAs":"html","dataStyles":{"five_letter_words":{"renderer":"list"}}}
query: words->five_letter_words->{
  where: word ~ r'...M[^EZ]'
  project: word
}
```

### Gray - The word does not have the letters

We can use this explore to search for words that match patterns.

```malloy
--! {"isRunnable": true,   "isPaginationEnabled": false, "pageSize": 100, "size":"large","source": "/inline/w1.malloy", "showAs":"html","dataStyles":{"five_letter_words":{"renderer":"list"}}}
query: words->five_letter_words->{
  where: word !~ r'[SLOPE]'
  project: word
}
```
