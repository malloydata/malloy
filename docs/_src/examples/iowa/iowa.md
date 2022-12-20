# Step 1: Understanding the Iowa Liquor Market Using Malloy
Liquor sales in Iowa are state-controlled, with all liquor wholesale run by the state. All purchases and sales of liquor that stores make are a matter of public record. We are going to explore this data set to better understand the Iowa Liquor market.

All data here is stored in BigQuery, in the table `'bigquery-public-data.iowa_liquor_sales.sales'`.

_The [Malloy data model](source.md) can be reviewed in examples under ['iowa'](https://github.com/malloydata/malloy/blob/docs-release/samples/iowa/iowa.malloy)._

## A quick overview of the dataset:

* **Date/Time information** (`` `date` ``)
* **Store and Location** (`store_name`, `store_address`, `store_location`, `city`, `county`, and `zip_code`)
* **Vendor information** (`vendor_name`, `vendor_number`)
* **Item information** (`item_number`, `item_description`, `category`, `category_name`)
* **Volume Information** (`bottle_volume_ml`, `bottles_sold`, `volume_sold_liters`, `volume_sold_gallons`)
* **Pricing information** (`state_bottle_cost`, `state_bottle_retail`, and `sale_dollars`)
