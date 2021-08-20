# Pick Expressions

## A `pick` can be a switch/case statement

If you want to denote a differnt action, depending on a value. In
other programming languages this is done with a `case` or `switch`
statment

```malloy
pick '*****' when rating > 80
pick '****'  when rating > 60
pick '***'   when rating > 40
pick '**'    when rating > 20
else '*'
```

## Pick works with apply and partial comparison

```malloy
rating:
  pick '*****' when > 80
  pick '****'  when > 60
  pick '***'   when > 40
  pick '**'    when > 20
  else '*'
```

## A pick can be a map

```malloy
how_many is thing_count:
  pick 'one' when 1
  pick 'two' when 2
  pick 'three' when 3
  else 'many'
```

## Pick works with alternations

```malloy
color_type is color:
  pick 'simple primary' when 'red' | 'green' | 'blue'
  else 'complex'
```

## Pick can be used to "clean" data

This compressses all the ignored status, collects all the "this actually
shiped" statuses, and because there is no `else`, leaves the other
status values alone.

```malloy
shipping_status:
  pick 'ignore' when 'bad1' | 'bad2' | 'testing'
  pick 'shipped' when 'will call' | 'shipped' | 'shipped with cheese'
```

## Pick can be used to compress data

Another common kind of cleaning is to have a small set you want to group
by and all other values are compressed, an `pick` with no value
can give you that ...

```malloy
status:
  pick when 'good' | 'ok' | 'fine'        -- leave these alone
  else NULL                               -- don't care about the rest
```

