BUCKET=imdb_data_upload
DATASET=imdb

gsutil rm -r gs://$BUCKET
gsutil mb gs://$BUCKET
rm *.tsv *.gz

for filename in name.basics title.akas title.basics title.crew \
  title.episode title.principals title.ratings 
do 
  wget https://datasets.imdbws.com/$filename.tsv.gz
  gunzip $filename.tsv.gz
  gsutil cp $filename.tsv gs://$BUCKET
  bq load --skip_leading_rows=1 --replace=true --source_format=CSV  --quote="" \
    --schema `head -1 $filename.tsv | sed '-e s/\t/,/g' `  \
    --field_delimiter='\t' $DATASET.`echo $filename | sed -e 's/\./_/'`_raw gs://$BUCKET/$filename.tsv
done

rm *.tsv

bq query --replace=true --use_legacy_sql=false --target_dataset=$DATASET --dataset_id=$DATASET <<- "EOF"
  create or replace table name_basics as (
    SELECT 
      * except(primaryProfession, knownForTitles, birthYear),
      NULLIF(safe_cast(birthYear as int64),0) birthYear,
      ARRAY((SELECT AS STRUCT value  
        FROM  UNNEST(split(primaryProfession,',')) as value )) as primaryProfession,
      ARRAY((SELECT AS STRUCT value  
        FROM  UNNEST(split(knownForTitles,',')) as value )) as knownForTitles
    FROM name_basics_raw
  );

  create or replace table title_crew as (
    SELECT 
      * except(directors,writers),
      ARRAY((SELECT AS STRUCT value  
        FROM  UNNEST(split(directors,',')) as value )) as director_ids,
      ARRAY((SELECT AS STRUCT value  
        FROM  UNNEST(split(writers,',')) as value )) as writer_ids
    FROM title_crew_raw
  );

  create or replace table title_ratings as (
    SELECT 
      tconst, 
      cast(averageRating as float64) averageRaging,
      cast(numVotes as int64) numVotes
    FROM title_ratings_raw
  );

  create or replace table title_principals as (
    SELECT 
      * except (characters),
      ARRAY((SELECT AS STRUCT value
        FROM UNNEST(JSON_VALUE_ARRAY(characters)) as value )) as characters
    from title_principals_raw
  );

  create or replace table title_basics as (
    SELECT 
      * except(genres,startYear,endYear),
      NULLIF(safe_cast(startYear as int64),0) startYear,
      ARRAY((SELECT AS STRUCT value  
        FROM  UNNEST(split(genres,',')) as value )) as genres
    FROM title_basics_raw
  );

  create or replace table movies
  as (
    with crew as (
      SELECT 
        tconst,
        ARRAY_AGG((SELECT AS STRUCT
          ARRAY((SELECT AS STRUCT value  
            FROM  UNNEST(split(directors,',')) as value )) as director_ids,
          ARRAY((SELECT AS STRUCT value  
            FROM  UNNEST(split(writers,',')) as value )) as writer_ids
        )) as crew
      FROM title_crew_raw c
      GROUP BY 1
    ),
    ratings as (
      SELECT 
        tconst, 
        (SELECT AS STRUCT
        cast(averageRating as float64) averageRaging,
        cast(numVotes as int64) numVotes
        ) as ratings
      FROM title_ratings_raw
    ),
    principals as (
      SELECT 
        tconst,
        ARRAY_AGG((SELECT AS STRUCT 
          ordering, nconst, category, job,
          ARRAY((SELECT AS STRUCT value
            FROM UNNEST(JSON_VALUE_ARRAY(characters)) as value )) as characters
        )) as principals
      from title_principals_raw
      group by 1
    )
    SELECT 
        basics.* except(genres,startYear,endYear),
        NULLIF(safe_cast(startYear as int64),0) startYear,
        ARRAY((SELECT AS STRUCT value  
          FROM  UNNEST(split(genres,',')) as value )) as genres,
        ratings.ratings,
        principals.principals,
        crew.crew
      FROM title_basics_raw as basics
      LEFT JOIN ratings  ON basics.tconst = ratings.tconst
      LEFT JOIN principals ON basics.tconst = principals.tconst
      LEFT JOIN crew on basics.tconst = crew.tconst
      WHERE titleTYpe = 'movie'
  ) 
EOF

