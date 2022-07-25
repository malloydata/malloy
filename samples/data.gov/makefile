all: data data/auto_recalls.csv data/lien_filings.csv data/sf_political_contributions.csv \
		data/sf_restaurant_health_violations.csv \
		data/sf_find_neighborhoods.csv data/whitehouse-waves-2013.csv

data:
	mkdir -p data

data/auto_recalls.csv: data
	curl https://data.transportation.gov/api/views/6axg-epim/rows.csv -o data/auto_recalls.csv

data/lien_filings.csv: data
	curl https://data.ct.gov/api/views/xfev-8smz/rows.csv -o data/lien_filings.csv

data/sf_political_contributions.csv: data
	curl https://data.sfgov.org/api/views/aghq-vgvd/rows.csv? -o data/sf_political_contributions.csv

data/sf_restaurant_health_violations.csv:
	curl https://data.sfgov.org/api/views/pyih-qa8i/rows.csv? -o data/sf_restaurant_health_violations.csv

data/sf_311_cases.csv: data
	curl https://data.sfgov.org/api/views/vw6y-z8j6/rows.csv? -o data/sf_311_cases.csv

data/sf_find_neighborhoods.csv: data
	curl https://data.sfgov.org/api/views/6ia5-2f8k/rows.csv? -o data/sf_find_neighborhoods.csv

# From obamawhitehouse - visitor logs
#  https://obamawhitehouse.archives.gov/goodgovernment/tools/visitor-records
#
data/whitehouse-waves-2013.csv: data
	curl https://obamawhitehouse.archives.gov/sites/default/files/disclosures/whitehouse-waves-2013.csv__0.zip -o data/whitehouse-waves-2013.csv__0.zip
	# unzip whitehouse-waves-2013.csv__0.zip