# Step 1: Understanding the Iowa Liquor Market Using Malloy
Liquor sales in Iowa are state-controlled, with all liquor wholesale run by the state. All purchases and sales of liquor that stores make are a matter of public record. We are going to explore this data set to better understand the Iowa Liquor market.

All data here is stored in BigQuery, in the table `'bigquery-public-data.iowa_liquor_sales.sales'`.

_The [Malloy data model](source.md) can be reviewed in examples under ['iowa'](https://github.com/looker-open-source/malloy/blob/docs-release/samples/iowa/iowa.malloy)._

## A quick overview of the dataset:

* **Date/Time information** (`` `date` ``)
* **Store and Location** (`store_name`, `store_address`, `store_location`, `city`, `county`, and `zip_code`)
* **Vendor information** (`vendor_name`, `vendor_number`)
* **Item information** (`item_number`, `item_description`, `category`, `category_name`)
* **Volume Information** (`bottle_volume_ml`, `bottles_sold`, `volume_sold_liters`, `volume_sold_gallons`)
* **Pricing information** (`state_bottle_cost`, `state_bottle_retail`, and `sale_dollars`)

## Using a Malloy Query to Examine the Contents of the Table

The table below shows all columns in the data set and their most common or ranges of values. The Malloy query below (or a derivation of it) can be used to examine just about any dataset.

```malloy
--! {"isRunnable": true, "isHidden": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: table('bigquery-public-data.iowa_liquor_sales.sales') -> { index: * } -> {
  nest: string_columns is {
    order_by: cardinality asc
    where: field_type = 'string'
    group_by: column_name is field_name
    aggregate: cardinality is count(distinct field_value)
    nest: values_list_detail is {
      top: 20
      group_by: field_value
      aggregate: rows_matched is weight.sum()
    }
  }
  nest: other_columns is {
    where: field_type != 'string'
    group_by: [
      column_name is field_name
      ranges_of_values is field_value
    ]
  }
}
```

## First 100 Rows of the data set.

```malloy
--! {"isRunnable": true, "runMode": "auto", "source": "iowa/iowa.malloy", "isPaginationEnabled": false, "pageSize": 100, "size": "large"}
query: table('bigquery-public-data.iowa_liquor_sales.sales') -> {
  project: *
  top: 100
}
```
