# About the IMDb Dataset

IMDb makes data available for download via [their website](https://www.imdb.com/interfaces/).

## Getting the Data and Making it Usable

We provide a *makefile* to help download and prepare the data for use with the provided Malloy models. The IMDB Data is available as TSV files.  For efficiency of querying, we will transform data into parquet format with DuckDB.

## Required Tools
Please install the tools below.

  * [wget](https://www.gnu.org/software/wget/) or [curl](https://curl.se/download.html) - to fetch the data from the server
  * [duckdb CLI](https://duckdb.org/docs/installation/index) to convert the data to parquet files.  _Note: Don't use the Homebrew build as it does not have the parquet extension built in._

## Setup
  Run `make` to download and prepare the data.


## Model Notes
The `movies` source filters only to films with > 10,000 ratings.

## Preview


**People**


| nconst    | primaryName     | birthYear | deathYear | primaryProfession                   | knownForTitles                          |
|-----------|-----------------|-----------|-----------|-------------------------------------|-----------------------------------------|
| nm0000001 | Fred Astaire    | 1899      | 1987      | soundtrack,actor,miscellaneous      | tt0031983,tt0053137,tt0072308,tt0050419 |
| nm0000002 | Lauren Bacall   | 1924      | 2014      | actress,soundtrack                  | tt0117057,tt0038355,tt0037382,tt0071877 |
| nm0000003 | Brigitte Bardot | 1934      | \N        | actress,soundtrack,music_department | tt0049189,tt0056404,tt0057345,tt0054452 |
| nm0000004 | John Belushi    | 1949      | 1982      | actor,soundtrack,writer             | tt0077975,tt0078723,tt0080455,tt0072562 |
| nm0000005 | Ingmar Bergman  | 1918      | 2007      | writer,director,actor               | tt0050976,tt0060827,tt0050986,tt0083922 |

**Movies**

| tconst    | isAdult | originalTitle                                    | primaryTitle            | startYear | endYear | runtimeMinutes |
|-----------|---------|--------------------------------------------------|-------------------------|----------:|--------:|---------------:|
| tt0000012 | 0       | L'arrivée d'un train à La Ciotat                 | The Arrival of a Train  |     1,896 |       ∅ |              1 |
| tt0000439 | 0       | The Great Train Robbery                          | The Great Train Robbery |     1,903 |       ∅ |             11 |
| tt0000417 | 0       | Le voyage dans la lune                           | A Trip to the Moon      |     1,902 |       ∅ |             13 |
| tt0004972 | 0       | The Birth of a Nation                            | The Birth of a Nation   |     1,915 |       ∅ |            195 |
| tt0006864 | 0       | Intolerance: Love's Struggle Throughout the Ages | Intolerance             |     1,916 |       ∅ |            163 |


**Principals**

A mapping table between people and titles, principals shows the principal cast/crew for titles

| tconst    | ordering | nconst    | category        | job                     |   |
|-----------|---------:|-----------|-----------------|-------------------------|:-:|
| tt0000001 |        1 | nm1588970 | self            | \N                      |   |
| tt0000001 |        2 | nm0005690 | director        | \N                      |   |
| tt0000001 |        3 | nm0374658 | cinematographer | director of photography |   |
| tt0000002 |        1 | nm0721526 | director        | \N                      |   |
| tt0000002 |        2 | nm1335271 | composer        | \N                      |   |


## Queries in `imdb.malloy`

### :malloy-query{ model="./1_imdb.malloy" query="by_title" source="movies" }
Title, start year, and number of ratings received, ordered by number of ratings.

### :malloy-query{ model="./1_imdb.malloy" query="by_year" source="movies" }
The number of titles produced per year

### :malloy-query{ model="./1_imdb.malloy" query="by_name" source="movies" }
For each person, the overall number of ratings on titles they were in, and the count of titles.

### :malloy-query{ model="./1_imdb.malloy" query="by_job_category" source="movies" }
Job category by number of titles

### :malloy-query{ model="./1_imdb.malloy" query="by_genre" source="movies" }
For each genre, the count of titles, and percent of all titles that are this genre. Note that a film may have multiple genres.

### :malloy-query{ model="./1_imdb.malloy" query="by_character" source="movies" }
Number of titles for each character name

### :malloy-query{ model="./1_imdb.malloy" query="by_year_and_genre" source="movies" }
For each year, the number of titles plus :malloy-query{ model="./1_imdb.malloy" query="by_genre" source="movies" } nested to show the breakdown by genre.

## About Additional Analyses

**movie_queries.malloy**: a collection of interested queries against the base `imdb.malloy` model.

**movie_filters.malloy**: a set of queries intended to filter other queries (see **movie_dashboard.malloy**)--each produces the unique identifiers (`tconst`) of movies to be used in the filter.

**movie_dashboard.malloy**: the `movies_plus` source adds an image and url link to the base model, then defines a `titles_dashboard` query which can be filtered as desired. For example, `spielberg_dashboard` uses a filtered query from `movie_filters.malloy` to pull back information on all Spielberg movies.

**movie_complex.malloy**: an aptly named collection of more complex queries building on definitions in the above files.
