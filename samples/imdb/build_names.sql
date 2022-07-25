copy (
  SELECT 
    *
  FROM read_csv_auto('data/name.basics.tsv.gz', delim='\t', quote='',header=True, all_varchar=true) as names
) to 'data/names.parquet' (FORMAT 'parquet', CODEC 'ZSTD') 