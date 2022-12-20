# DuckDB Example Models

These models are built to work with DuckDB, which is natively supported and does not require explicit configuration of a connection.

## [FAA](https://github.com/malloydata/malloy/tree/main/samples/duckdb/faa) _(ready to use)_ **Start here!**
A subset of the NTSB FAA Dataset, which includes information about flights, airports, carriers, and aircrafts.

## [Auto Recalls](https://github.com/malloydata/malloy/tree/main/samples/duckdb/auto_recalls) _(ready to use)_
A database of [National Highway Traffic Safety Administration recalls](https://catalog.data.gov/dataset/recalls-data).

## [Names](https://github.com/malloydata/malloy/tree/main/samples/duckdb/names) _(ready to use)_
This dataset a lightly transformed version of the U.S. Social Security Administration [Names Dataset](https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data). A parquet file with the data is provided.

## [IMDb](https://github.com/malloydata/malloy/tree/main/samples/duckdb/imdb) _(requires some setup)_
IMDb makes data available for download via [their website](https://www.imdb.com/interfaces/). We provide a makefile to help download and prepare the data for use with the provided Malloy models. Make sure to review the README for instructions on how to do this.
