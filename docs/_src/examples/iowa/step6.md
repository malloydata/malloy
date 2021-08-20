# Dashboards
Putting it all together we can write a dashboard

```malloy
  vendor_dashboard is (reduce
    vendor_count is count(distinct vendor_number)
    total_sale_dollars
    total_bottles
    by_month 
    by_class
    by_vendor_bar_chart
    top_sellers_by_revenue
    most_expensive_products
    by_vendor is (reduce top 10
      vendor_name
      total_sale_dollars
      by_category
      by_sku
      by_month 
    )
  )
```

## Run Dashboard

Simply add some filters.  Notice the sub-dashboard for each of the Vendors.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
explore iowa : [category_class: 'VODKAS']
| vendor_dashboard
```