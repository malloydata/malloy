# Change Log

_Breaking changes indicated with \*_

We will use this space to highlight major and/or breaking changes to Malloy.

## v0.2.x

### VS Code helper view windows relocated

To improve discoverability and reduce extra clicking around in VS Code, we've relocated the Help, Connections, and Schema View Windows into the Explorer View. They will only appear when a `.malloy` file is opened.

<img width="1365" alt="Screen Shot 2022-08-08 at 11 32 26 AM" src="https://user-images.githubusercontent.com/7178946/183488595-0c88591d-a162-4272-a937-e15261bf50c5.png">

## v0.0.10

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

## (v0.0.9)

### Deprecation of brackets for lists of items

Prior to v0.0.9, lists of things were contained inside `[ ]`. Going forward, the brackets have been removed. Our hope is that this will be one less piece of punctuation to track, and will make it easier to change from a single item in a list to multiple without adding in brackets.

For example, this syntax:

```malloy
query: table('malloydata-org.faa.airports') -> {
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
query: table('malloydata-org.faa.airports') -> {
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
