# Dashboards
Putting it all together we can write a dashboard

```malloy
query: vendor_dashboard is {
  group_by: vendor_count is count(distinct vendor_number)
  aggregate: [
    total_sale_dollars
    total_bottles
  ]
  nest: by_month
  nest: by_class
  nest: by_vendor_bar_chart
  nest: top_sellers_by_revenue
  nest: most_expensive_products
  nest: by_vendor_dashboard is {
    top: 10
    group_by: vendor_name
    aggregate: total_sale_dollars
    nest: by_month
    nest: top_sellers_by_revenue
    nest: most_expensive_products
  }
}
```

## Run Dashboard

Simply add some filters.  Notice the sub-dashboard for each of the Vendors.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: iowa { where: category_class = 'VODKAS' } -> vendor_dashboard
```