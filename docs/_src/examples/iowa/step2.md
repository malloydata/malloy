# Iowa Liquor: Basic Calculations

**TLDR**: In this section, we will flesh out our model with a few basic calculations: `total_sale_dollars`, `item_count`, `line_item_count`, `price_per_100ml` and `avg_price_per_100ml`.  These calculations will be use in  subsequent analysis.

*See the complete [Iowa Liquor Malloy Model](source.md)*

## *total_sale_dollars* - What was the total volume of transactions?
The calculation `total_sale_dollars` will show us the total amount, in dollars, that Iowa State stores sold.

```malloy
total_sale_dollars is sale_dollars.sum()
```
Having added this to the model, we can now reference `total_sale_dollars` to see the top items purchased by Liquor stores.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small"}
query: iowa -> {
  group_by: [ vendor_name, item_description ]
  aggregate: total_sale_dollars
}
```


## *item_count* - How many different kinds of items were sold?
 This lets us understand whether a vendor sells one item, or many different kinds of items.

```malloy
item_count is count(distinct item_number)
```

We can see which Vendors have the greatest breadth of products as it relates to sales volume.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small"}
query: iowa -> {
  group_by: [ vendor_name ]
  aggregate: [ item_count, total_sale_dollars ]
}
```

A few observations here: Jim Bean Brands has the greatest variety of items in this dataset. Yahara Bay Distillers Inc sells 275 different items but only has $100K in sales, while Fifth Generation sells only 5 different items, yet has $3M in volume.

## *gross_margin* - How much did the state of Iowa make on this item?
We have both the bottle cost (`state_bottle_cost`) and bottle price (`state_bottle_retail`), allowing us to calculate percent gross margin on a per-item basis, giving us a new a dimension.

```malloy
gross_margin is
  100 * (state_bottle_retail - state_bottle_cost) /
    nullif(state_bottle_retail, 0)
```

Looking at gross margin across top selling items, we see that the gross margin is a *consistent 33.3 percent*.  A quick google search reveals that Iowa state law dictates the state can mark up liquor by up to 50% of the price from the vendor, so this makes sense!

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "small"}
query: iowa -> {
  group_by: [ item_description, state_bottle_retail, state_bottle_cost, gross_margin ]
  aggregate: total_sale_dollars
}
```

## *total_bottles* - How many individual bottles were sold?

```malloy
total_bottles is bottles_sold.sum()
```

## *line_item_count* - How many line items were on the purchase orders?
This is basically what a single record represents in this data set.

```malloy
line_item_count is count()
```

## *price_per_100ml* - How expensive is this booze?
Given the price of a bottle and its size (in ml), we can compute how much 100ml costs.  This becomes an attribute of an individual line item (a dimension, not a measure).

```malloy
price_per_100ml is state_bottle_retail / nullif(bottle_volume_ml, 0) * 100
```

## *avg_price_per_100ml* - How expensive is this class of booze?
Using our newly defined `price_per_100ml` as an attribute of a line item in a purchase order, we might like an average that we can use over a group of line items.  This is a simple example using line_items as the denominator, but an argument could be made to use per bottle something more complex.

```malloy
avg_price_per_100ml is price_per_100ml.avg()
```