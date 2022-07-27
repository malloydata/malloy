# DuckDB Example Models

These models are built to work with DuckDB, which is natively supported and does not require explicitly configuration of a connection.

## [Names](https://github.com/looker-open-source/malloy/tree/add_malloy_examples/samples_duckdb/names_duckdb) _(ready to use)_
This dataset a lightly transformed version of the U.S. Social Security Administration [Names Dataset](https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data). A parquet file with the data is provided on the repo.

## [IMDb](https://github.com/looker-open-source/malloy/tree/add_malloy_examples/samples_duckdb/imdb) _(requires some setup)_
IMDb makes data available for download via [their website](https://www.imdb.com/interfaces/). We provide a makefile to help download and prepare the data for use with the provided Malloy models. Make sure to review the README for instructions on how to do this.