# Change Log
_Breaking changes indicated with *_

We will use this space to highlight major and/or breaking changes to Malloy.


## 0.0.10

### The apply operator is now ? and not :

In the transition from filters being with an array like syntax ...

```
sourceName :[ fieldName: value1|value2 ]
```

The use of `:` as the apply operator became a readability problem ...

```
sourceName { where: fieldName: value1|value2 }
```

As of this release, use of the `:` as an apply operator will generate a warning,
and in a near future release it will be a compiler error. The correct
syntax for apply is now the `?` operator. As in

```
sourceName { where: fieldName ? value1|value2 }
```

## 0.0.9

### Deprecation of brackets for lists of items

Prior to version 0.0.9, lists of things were contained inside `[ ]`. Going forward, the brackets have been removed. Our hope is that this will be one less piece of punctuation to track, and will make it easier to change from a single item in a list to multiple without adding in brackets.

For example, this syntax:
```malloy
query: table('malloy-data.faa.airports') -> {
  top: 10
  group_by: [
    faa_region
    state
  ]
  aggregate: [
    airport_count is count()
    count_public is count() { where: fac_use = 'PU' },
    average_elevation is round(elevation.avg(),0)
  ]
  where: [
    faa_region: 'ANM' | 'ASW' | 'AWP' | 'AAL' | 'ASO' ,
    major = 'Y' ,
    fac_type = 'AIRPORT'
  ]
}
```

Is now written:
```malloy
query: table('malloy-data.faa.airports') -> {
  top: 10
  group_by:
    faa_region
    state
  aggregate:
    airport_count is count()
    count_public is count() { where: fac_use = 'PU' },
    average_elevation is round(elevation.avg(),0)
  where:
    faa_region: 'ANM' | 'ASW' | 'AWP' | 'AAL' | 'ASO' ,
    major = 'Y' ,
    fac_type = 'AIRPORT'
}
```
