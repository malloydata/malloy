
SHELL = bash

all: data/principals.parquet data/titles.parquet data/names.parquet

# Rule to download the files
%.gz:
	mkdir -p data
	curl https://datasets.imdbws.com/$(notdir $@) -o $@

data/principals.parquet: data/title.principals.tsv.gz
	duckdb < build_principals.sql

data/titles.parquet: data/title.crew.tsv.gz data/title.ratings.tsv.gz data/title.basics.tsv.gz

	duckdb < build_titles.sql

data/names.parquet: data/name.basics.tsv.gz
	duckdb < build_names.sql

clean:
	rm -f title.principals.tsv.gz title.crew.tsv.gz title.ratings.tsv.gz title.basics.tsv.gz name.basics.tsv.gz names.parquet titles.parquet principals.parquet