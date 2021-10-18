# Iowa Liquor Malloy Model

This is the malloy model used for the Analysis example.  It should be used as an reference when looking at the [following sections](step2.md).

```malloy
export define iowa is (explore 'bigquery-public-data.iowa_liquor_sales.sales'

  -- dimensions
  gross_margin is 100 * (state_bottle_retail - state_bottle_cost) / state_bottle_retail
  price_per_100ml is state_bottle_retail/NULLIF(bottle_volume_ml,0)*100
  category_class is category_name :
    pick 'WHISKIES' when ~ r'(WHISK|SCOTCH|BOURBON|RYE)'
    pick 'VODKAS' when ~ r'VODKA'
    pick 'RUMS' when ~ r'RUM'
    pick 'TEQUILAS' when ~ r'TEQUILA'
    pick 'LIQUEURS' when ~ r'(LIQUE|AMARETTO|TRIPLE SEC)'
    pick 'BRANDIES' when ~ r'BRAND(I|Y)'
    pick 'GINS' when ~ r'GIN'
    pick 'SCHNAPPS' when ~ r'SCHNAP'
    else 'OTHER'
  bottle_size is bottle_volume_ml:
    pick 'jumbo (over 1000ml)' when > 1001
    pick 'liter-ish' when >= 750
    else 'small or mini (under 750ml)'

  -- measures
  total_sale_dollars is sale_dollars.sum()
  item_count is count(distinct item_number)
  total_bottles is sum(bottles_sold)
  line_item_count is count()
  avg_price_per_100ml is price_per_100ml.avg()

  -- named queries
  by_month is (reduce order by 1
    purchase_month is `date`.week
    total_sale_dollars
  )

  top_sellers_by_revenue is (reduce top 5
    vendor_name
    item_description
    total_sale_dollars
    total_bottles
    avg_price_per_100ml
  )

  most_expensive_products is (reduce
      top 10 order by avg_price_per_100ml desc
    vendor_name
    item_description
    total_sale_dollars
    total_bottles
    avg_price_per_100ml
  )

  by_vendor_bar_chart is (reduce top 10
    vendor_name
    total_sale_dollars
    total_bottles
  )

  by_class is (reduce top 10
    category_class
    total_sale_dollars
    item_count
  )

  by_category is (reduce top 10
    category_name
    total_sale_dollars
    item_count
  )

  by_sku is (reduce
    item_description
    total_sale_dollars
    limit 5
  )

  vendor_dashboard is (reduce
    vendor_count is count(distinct vendor_number)
    total_sale_dollars
    total_bottles
    by_month
    by_class
    by_vendor_bar_chart
    top_sellers_by_revenue
    most_expensive_products
    by_vendor_dashboard is (reduce top 10
      vendor_name
      total_sale_dollars
      by_month
      top_sellers_by_revenue
       most_expensive_products
    )
  )
);
```

## Schema Overview
The schema for the table `bigquery-public-data.iowa_liquor_sales.sales` as well as descriptions of each field can be found on the [Iowa Data site](https://data.iowa.gov/Sales-Distribution/Iowa-Liquor-Sales/m3tr-qhgy).
