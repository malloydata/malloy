## First Analysis, What are the top Brands and Price Points?

**TLDR;** We'll use the measures we defined in the last section to write some basic queries to understand the Vodka market, and answer a few questions:  *What are the most popular brands?  Which is the most expensive?  Does a particular county favor expensive or cheap Vodka?*  We will then learn how to save a named query and use it as a basic **Nested Query**.

## Definitions
The following sections use these definitions, created in the [previous
section](step2.md).

```malloy
source: iowa is table('bigquery-public-data.iowa_liquor_sales.sales'){
  measure: [
    total_sale_dollars is sale_dollars.sum()
    total_bottles is sum(bottles_sold)
    price_per_100ml is state_bottle_retail / nullif(bottle_volume_ml, 0) * 100
    avg_price_per_100ml is price_per_100ml.avg()
  ]
}
```

## Most popular vodka by dollars spent
We start by  [filtering the data](../../language/filters.md) to only purchase records where the category name contains `'VODKA'`.  We group the data by vendor and description, and calculate the various totals. Note that Malloy [automatically orders](../../patterns/order_by.md) the results by the first measure descending (in this case).

Notice that the greatest sales by dollar volume is *Hawkeye Vodka*, closely followed by *Absolut*.  A lot more bottles of *Hawkeye* were sold, as it is 1/3 the price by volume of *Absolut*.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: iowa { where: category_name ~ r'VODKA' } -> {
  top: 5
  group_by: vendor_name, item_description
  aggregate: total_sale_dollars, total_bottles, avg_price_per_100ml
}
```

## Adding a Query to the model.
This particular view of the data is pretty useful, an something we expect to re-use.  We can add this query to the model by incorporating it into the source definition:

```malloy
source: iowa is table('bigquery-public-data.iowa_liquor_sales.sales'){
  measure: [
    total_sale_dollars is sale_dollars.sum()
    total_bottles is sum(bottles_sold)
    price_per_100ml is state_bottle_retail / nullif(bottle_volume_ml, 0) * 100
    avg_price_per_100ml is price_per_100ml.avg()
  ]

  query: top_sellers_by_revenue is {
    top: 5
    group_by: vendor_name, item_description
    aggregate: total_sale_dollars, total_bottles, avg_price_per_100ml
  }
}
```

## Examining Tequila

Once the query is in the model we can simply call it by name, adjusting our filtering to ask questions about Tequila instead:


```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "medium"}
query: iowa { where: category_name ~ r'TEQUILA' } -> top_sellers_by_revenue
```

Here we can see that *Patron Tequila Silver* is the most premium brand, followed by *Jose Cuervo* as a mid-tier  brand, with *Juarez Tequila Gold* more of an economy brand.

## Nested Subtables: A deeper look at a Vendor offerings
The magic happens when we call a named query in the same way we would use any other field [nesting](nesting.md). In the below query, we can see our vendors (sorted automatically by amount purchased, as well as the top 5 items for each vendor.


```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "medium"}
query: iowa { where: category_name ~ r'TEQUILA' } -> {
  group_by: vendor_name
  aggregate: total_sale_dollars, avg_price_per_100ml
  nest: top_sellers_by_revenue // entire query is a field
}
```

These nested subtables allow us to view both the high-level information of "who are our top vendors" as well as the supporting detail in one simple Malloy query.

## Bucketing the data
The `price_per_100ml` calculation, defined in the previous section, combines with our new named query to allow for some interesting analysis. Let's take a look at the entire Tequila category, and see the leaders within each price range.  We'll bucket `price_per_100ml` into even dollar amounts, and nest our `top_sellers_by_revenue` query to create a subtable for each bucket.

At the top we see our lowest cost options at under $1/mL, with the more pricey beverages appearing as we scroll down.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "medium"}
query: iowa { where: category_name ~ r'TEQUILA' } -> {
  group_by: price_per_100ml_bucket is floor(price_per_100ml)
  nest: top_sellers_by_revenue
}
```
