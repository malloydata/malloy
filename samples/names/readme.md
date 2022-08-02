# About the Names Dataset

This dataset a lightly transformed version of the U.S. Social Security Administration [Names Dataset](https://catalog.data.gov/dataset/baby-names-from-social-security-card-applications-national-data). Notes on the background and limitations of this dataset can be found [here](https://www.ssa.gov/oact/babynames/background.html).


### Queries

#### :malloy-query{model="./names.malloy" query="by_name" source="names"}
Top 10 names by population

#### :malloy-query{model="./names.malloy" query="by_state" source="names"}
Population by state

#### :malloy-query{model="./names.malloy" query="by_gender" source="names"}
Population by gender

#### :malloy-query{model="./names.malloy" query="by_year" source="names"}
Population by year

#### :malloy-query{model="./names.malloy" query="by_decade" source="names"}
Population by decade

#### :malloy-query{model="./names.malloy" query="name_as_pct_of_pop" source="names"}
Name, population, and the percent each name makes up of the total population

#### :malloy-query{model="./names.malloy" query="male_names" source="names"} / :malloy-query{model="./names.malloy" query="female_names" source="names"}
Top 10 names for M / F reported gender

#### :malloy-query{model="./names.malloy" query="top_names_by_state_by_gender" source="names"}
Top 10 names in each state, for each gender

#### :malloy-query{model="./names.malloy" query="name_dashboard" source="names"}
For the top 10 names, shows `by_decade`, `by_state`, and `by_gender`

#### :malloy-query{model="./names.malloy" query="j_names" source="names"}
Returns the name dashboard, filtered to 'J' names