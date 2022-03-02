# Change Log
_Breaking changes indicated with *_

We will use this space to highlight major and/or breaking changes to Malloy.

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
