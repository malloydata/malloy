# Bucketing and Mapping: Categories and Bottles

**TLDR:** *This step builds a couple of useful derivations, `category_class` and `bottle_size`.  There as 68 different `category_name`s in this data set, we reduce that to 9.  There are 34 *liter sizes*, we make a new dimension, `bottle_size` that only has 3 possible values.*

Our previous analysis of price per mL brings to mind questions around bottle size. How many different sizes do bottles come in?  Are there standards and uncommon ones?  Do vendors specialize in different bottle sizes?


## Building *category_class*, a simplified version of *category_name*

Using the query below, we can see that there are 68 different category names in the data set.  We can notice there is *80 Proof Vodka*, *Flavored Vodka* and more.  It would be helpful if we just could have all of these categorized together as vodkas.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small"}
query: iowa -> {
  aggregate: distinct_number_of_category_names is count(distinct category_name)
  nest: sizes is {
    group_by: category_name
    aggregate: [ item_count, line_item_count ]
  }
}
```

Malloy provides a simple way to map all these values, using `pick` expressions.  In the [Malloy Model for this Data Set](source.md), you will find the declaration below.  Each pick expression tests `category_name` for a regular expression.  If it matches, it returns the name pick'ed.

```malloy
  category_class is category_name :
    pick 'WHISKIES' when ~ r'(WHISK|SCOTCH|BURBON|RYE)'
    pick 'VODKAS' when ~ r'VODKA'
    pick 'RUMS' when ~ r'RUM'
    pick 'TEQUILAS' when ~ r'TEQUILA'
    pick 'LIQUEURS' when ~ r'(LIQUE|AMARETTO|TRIPLE SEC)'
    pick 'BRANDIES' when ~ r'BRAND(I|Y)'
    pick 'GINS' when ~ r'GIN'
    pick 'SCHNAPPS' when ~ r'SCHNAP'
    else 'OTHER'
```
## Testing the category map

Let's take a look at each category class and see how many individual items it has.  We'll also build a nested query that shows the `category_name`s that map into that category class.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small", "dataStyles": { "names_list": { "renderer": "list_detail" } } }
query: iowa -> {
  group_by: category_class
  aggregate: item_count
  nest: names_list is {
    group_by: category_name
    aggregate: item_count
  }
}
```
## Looking at the entire market by `category_class`

With our new lens, we can now see the top sellers in each `category_class`, allowing us to get an entire market summary with a single simple query.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small"}
query: iowa -> {
  group_by: category_class
  aggregate: total_sale_dollars
  nest: top_sellers_by_revenue
}
```

## Understanding bottle sizes
In this data set, there is a column called `bottle_volume_ml`, which is the bottle size in mL. Let's take a look.

A first query reveals that there are 34 distinct bottle sizes in this data set, and that 750ml, 1750ml and 1000ml are by far the most common.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small"}
query: iowa -> {
  aggregate: distinct_number_of_sizes is count(distinct bottle_volume_ml)
  nest: sizes is {
    group_by: bottle_volume_ml
    aggregate: line_item_count
  }
}
```

Visualizing this query suggests that we might wish to create 3 distinct buckets to approximate small, medium and large bottles.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "medium", "dataStyles": { "sizes": { "renderer": "bar_chart" } } }
query: iowa -> {
  aggregate: distinct_number_of_sizes is count(distinct bottle_volume_ml)
  nest: sizes is {
    group_by: bottle_volume_ml
    aggregate: line_item_count
    where: bottle_volume_ml < 6000
  }
}
```

## Creating a new Dimension for Bottle Size.
Looking at the above chart and table we can see that there are a bunch of small values, several big values at 750 and 1000, and then a bunch of larger values.  We can clean this up by bucketing bottle size into three groups using a Malloy `pick` expression that maps these values to strings.

```malloy
  bottle_size is bottle_volume_ml:
    pick 'jumbo (over 1000ml)' when > 1001
    pick 'liter-ish' when >= 750
    else 'small or mini (under 750ml)'
```
Look at the data through the new mapping.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small"}
query: iowa -> {
  group_by: bottle_size
  aggregate: [ total_sale_dollars, line_item_count, item_count ]
  order_by: bottle_size
}
```
