# 
#  Data: https://www.usaspending.gov/download_center/award_data_archive
#
SHELL = bash
archive_date=20220608

data/%.parquet: data/%.csv
	echo "copy  (SELECT * from read_csv_auto('data/$*.csv', SAMPLE_SIZE=400000)) to 'data/$*.parquet' (format 'parquet', codec 'ZSTD');" | duckdb

all: \
  data \
	data/FY2022_All_Contracts_Full_$(archive_date)_1.parquet \
	data/FY2022_All_Contracts_Full_$(archive_date)_2.parquet \
	data/FY2022_All_Contracts_Full_$(archive_date)_3.parquet \
	data/FY2022_All_Contracts_Full_$(archive_date)_4.parquet 

data:
	mkdir -p data

data/FY2022_All_Contracts_Full_$(archive_date)_1.csv \
data/FY2022_All_Contracts_Full_$(archive_date)_2.csv \
data/FY2022_All_Contracts_Full_$(archive_date)_3.csv \
data/FY2022_All_Contracts_Full_$(archive_date)_4.csv:
	curl https://files.usaspending.gov/award_data_archive/FY2022_All_Contracts_Full_$(archive_date).zip -o data/full_contracts.zip
	unzip -d data data/full_contracts.zip

	