# This script will upload data into BigQuery
#
# 1) Download the data from here: https://www.kaggle.com/grouplens/movielens-20m-dataset
#
# 2) run 
#            bash upload_movielens.sh

BUCKET=movielens_data_upload
DATASET=movielens

gsutil rm -r gs://$BUCKET
gsutil mb gs://$BUCKET

for filename in \
  genome_scores \
  genome_tags  \
  link   \
  movie \
  rating 
do 
  gsutil cp $filename.csv gs://$BUCKET
  bq load --skip_leading_rows=1 --replace=true --max_bad_records=5 --source_format=CSV  \
    --schema `head -1 $filename.csv | sed '-e s/"//g' `  \
     $DATASET.$filename gs://$BUCKET/$filename.csv
done
