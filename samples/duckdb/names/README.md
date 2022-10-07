# About the Names Dataset

This dataset a lightly transformed version of the U.S. Social Security Administration [Names Dataset](https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data). Notes on the background and limitations of this dataset can be found [here](https://www.ssa.gov/oact/babynames/background.html).

## Preview

| state | gender |  year | name     | number |
|-------|--------|------:|----------|-------:|
| AK    | F      | 1,910 | Mary     |     14 |
| AK    | F      | 1,910 | Annie    |     12 |
| AK    | F      | 1,910 | Anna     |     10 |
| AK    | F      | 1,910 | Margaret |      8 |
| AK    | F      | 1,910 | Helen    |      7 |
| AK    | F      | 1,910 | Elsie    |      6 |
| AK    | F      | 1,910 | Lucy     |      6 |
| AK    | F      | 1,910 | Dorothy  |      5 |
| AK    | F      | 1,911 | Mary     |     12 |
| AK    | F      | 1,911 | Margaret |      7 |


## Queries in `1_names`

### <!--malloy-query model="./1_names.malloy" source="names" query="by_name"--> `by_name`
Top 10 names by population

### <!--malloy-query model="./1_names.malloy" source="names" query="by_state"--> `by_state`
Population by state

### <!--malloy-query model="./1_names.malloy" source="names" query="by_gender"--> `by_gender`
Population by gender

### <!--malloy-query model="./1_names.malloy" source="names" query="by_year"--> `by_year`
Population by year

### <!--malloy-query model="./1_names.malloy" source="names" query="male_names"--> `male_names` / <!--malloy-query model="./1_names.malloy" source="names" query="male_names"--> `female_names`
Top 10 names for M / F reported gender

### <!--malloy-query model="./1_names.malloy" source="names" query="top_names_by_state_ea_gender"--> `top_names_by_state_ea_gender`
Top 10 names in each state, for each gender

### `j_names`
Returns the name dashboard, filtered to 'J' names. Example of querying against a source vs. defining queries in a source.
