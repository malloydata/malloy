copy (
	with
	crew as (
		select
			tconst,
			{ 'directors': str_split(directors,',')  ,
				'writers' : str_split(writers,',')
			} as crew
		from read_csv_auto('title.crew.tsv.gz', delim='\t', quote='',header=True)
	),
	ratings as (
		SELECT tconst, ROW(averageRating, numVotes) as ratings
		FROM read_csv_auto('title.ratings.tsv.gz', delim='\t', quote='',header=True) as r
	),
	titles as (
		select title.tconst, isAdult, originalTitle, primaryTitle,
		str_split(genres,',') as genres,
		case WHEN regexp_matches(startYear,'[0-9]+') THEN CAST(startYear as integer) END as startYear,
		case WHEN regexp_matches(endYear,'[0-9]+') THEN CAST(endYear as integer) END as endYear,
		case WHEN regexp_matches(runtimeMinutes,'[0-9]+') THEN CAST(runtimeMinutes as integer) END as runtimeMinutes,
		crew.crew,
		ratings.ratings,
		FROM read_csv_auto('title.basics.tsv.gz', delim='\t', quote='',header=True, all_varchar=true) as title
		LEFT JOIN crew on title.tconst = crew.tconst
		LEFT JOIN ratings on title.tconst = ratings.tconst
		WHERE ratings.numVotes > 30000
	)
	select * from titles
) to 'titles.parquet' (FORMAT 'parquet', CODEC 'ZSTD')
