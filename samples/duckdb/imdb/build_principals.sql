
copy (
	SELECT 
		tconst, ordering, nconst, category, job,
		str_split(characters,',') as characters
	FROM read_csv_auto('data/title.principals.tsv.gz', delim='\t', quote='',header=True)
) to 'data/principals.parquet' (FORMAT 'parquet', CODEC 'ZSTD')