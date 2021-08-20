# What is a "turtle"

In Malloy, an object which has a name and transforms a shape
is called a "turtle". The word comes from the philosophical phrase
[Turtles All The Way Down](https://en.wikipedia.org/wiki/Turtles_all_the_way_down).

An example of a turtle might look like this

```malloy
   group_by_size is (reduce
    size
    object_count
   )
```

This "turtle" could then be used to build out other computations,
for example

```malloy
  sizes_in_ca is group_by_size [ state : 'CA' ]
```

This is an unusual word, and it may be replaced once we figure out a better word
but right now, you will see the word "turtle" from time to time, and this
is what it means.
