window.SEARCH_SEGMENTS = [
  {
    "titles": [
      "Connecting a Database in the VSCode Extension"
    ],
    "paragraphs": [],
    "path": "/connection_instructions.md"
  },
  {
    "titles": [
      "Connecting a Database in the VSCode Extension",
      "Adding the Connection in VS Code"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Click on the Malloy icon on the left side of VS Code. This opens the Malloy view - a view that allows you to view schemas as you work with Malloy models and edit database connections."
      },
      {
        "type": "p",
        "text": "In the \"CONNECTIONS\" panel, select \"Edit Connections\". This opens the connection manager page."
      },
      {
        "type": "p",
        "text": "Click \"Add Connection\" and fill out the relevant details. See below for database-specific instructions."
      },
      {
        "type": "p",
        "text": "Press \"Test\" on the connection to confirm that you have successfully connected to the database"
      }
    ],
    "path": "/connection_instructions.md"
  },
  {
    "titles": [
      "Connecting a Database in the VSCode Extension",
      "BigQuery"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Authenticating to BigQuery can be done either via OAuth (using your Google Cloud Account) or with a Service Account Key downloaded from Google Cloud"
      }
    ],
    "path": "/connection_instructions.md"
  },
  {
    "titles": [
      "Connecting a Database in the VSCode Extension",
      "BigQuery",
      "Option 1: OAuth"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "When creating the connection in the VS Code Plugin, you can leave the optional fields blank as it will connect using your gcloud project configuration."
      }
    ],
    "path": "/connection_instructions.md"
  },
  {
    "titles": [
      "Connecting a Database in the VSCode Extension",
      "BigQuery",
      "Option 2: Service Account"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Add the relevant database connection information. Once you click save, the password (if you have entered one) will be stored in your system keychain."
      }
    ],
    "path": "/connection_instructions.md"
  },
  {
    "titles": [
      "Connecting a Database in the VSCode Extension",
      "DuckDB"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "DuckDB is available without needing to explicitly configure a connection. It works with local parquet or csv files, which can be referenced in a source. This example has the CSV in the same directory as the .malloy model file: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">baby_names</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;duckdb:babynames.csv&#39;</span><span style=\"color: #000000\">)</span></span></code>"
      },
      {
        "type": "p",
        "text": "Currently, BigQuery, PostgreSQL <em>(in progress)</em>, and DuckDB are supported.  These instructions assume you have already installed the <a href=\"https://marketplace.visualstudio.com/items?itemName=malloydata.malloy-vscode\">Malloy extension</a> in VSCode."
      },
      {
        "type": "p",
        "text": "<em>Note:  DuckDB is natively supported, allowing you to skip these initial steps.</em>"
      },
      {
        "type": "p",
        "text": "Hit \"Save,\" then dive into writing Malloy! We recommend starting with one of our Samples, which can be found <a href=\"https://github.com/malloydata/malloy/tree/main/samples\">here</a> or downloaded from the VS Code Plugin"
      },
      {
        "type": "p",
        "text": "To access BigQuery with the Malloy Plugin, you will need to have a <a href=\"https://cloud.google.com/\">Google Cloud Account</a>, access to BigQuery, and the <a href=\"https://cloud.google.com/sdk/gcloud\">gcloud CLI</a> installed. Once the gcloud CLI is installed, open a terminal and type the following:"
      },
      {
        "type": "p",
        "text": "Add the relevant account information to the new connection, and include the path to the <a href=\"https://cloud.google.com/iam/docs/creating-managing-service-account-keys\">service account key</a>."
      }
    ],
    "path": "/connection_instructions.md"
  },
  {
    "titles": [
      "Connecting a Database in the VSCode Extension",
      "PostgreSQL <em>(in progress)</em>"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>(Development in progress, date/time support is currently incomplete)</em>"
      },
      {
        "type": "p",
        "text": "There are a number of examples on public data using DuckDB available <a href=\"https://github.com/lloydtabb/malloy_examples\">here</a>."
      },
      {
        "type": "p",
        "text": "<em>Replace <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">{</span><span style=\"color: #001080\">my_project_id</span><span style=\"color: #000000\">}</span></span></code> with the <strong>ID</strong> of the BigQuery project you want to use & bill to. If you're not sure what this ID is, open Cloud Console, and click on the dropdown at the top (just to the right of the \"Google Cloud Platform\" text) to view projects you have access to. If you don't already have a project, <a href=\"https://cloud.google.com/resource-manager/docs/creating-managing-projects\">create one</a>.</em>"
      }
    ],
    "path": "/connection_instructions.md"
  },
  {
    "titles": [
      "eCommerce Walkthrough: An Intro to Malloy Syntax & the VSCode Plugin"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy queries compile to SQL. As Malloy queries become more complex, the SQL complexity expands dramatically, while the Malloy query remains concise and easier to read."
      },
      {
        "type": "p",
        "text": "Let’s illustrate this by asking a straightforward question of a simple ecommerce dataset--how many order items have we sold, broken down by their current status?"
      },
      {
        "type": "p",
        "text": "Notice that after you write this, small \"Run | Render\" code lens will appear above the query. Run will show the JSON result, while Render will show a table by default, or a visualization if you've configured one (more on this later). Click the code lens to run the query. This will produce the following SQL:"
      },
      {
        "type": "p",
        "text": "<img src=\"https://user-images.githubusercontent.com/7178946/130125702-7049299a-fe0f-4f50-aaed-1c9016835da7.gif\" alt=\"Kapture 2021-08-18 at 17 07 03\"/>"
      },
      {
        "type": "p",
        "text": "Next question: In 2020, how much did we sell to users in each state? This requires filtering to the year 2020, excluding cancelled and returned orders, as well as joining in the users table."
      },
      {
        "type": "p",
        "text": "At this point we might notice we’re defining a few things we might like to re-use, so let’s add them to the model:"
      },
      {
        "type": "p",
        "text": "Having defined this in the model, the VSCode plugin will give us handy \"Outline\" and \"Schema\" tools in the left menu. \"Outline\" provides an interactive navigator of the model, in order, and \"Schema\" shows all of the attributes (both raw fields in the underlying table, and the dimensions, measures, and named queries you've defined in your model)."
      },
      {
        "type": "p",
        "text": "Our query is now very simple:"
      },
      {
        "type": "p",
        "text": "To further simplify, we can add this and a couple other queries we’ll frequently use to our model. Once you define these, the VSCode plugin will supply a “Run” button next to each query:"
      },
      {
        "type": "p",
        "text": "Allowing us to run the following very simple command next time we want to run any of these queries:"
      },
      {
        "type": "p",
        "text": "Which can be visualized using a data_style"
      },
      {
        "type": "p",
        "text": "The use of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span></span></code> in the above query invokes a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">SELECT</span></span></code> with a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">GROUP</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">BY</span></span></code> in SQL. Malloy also has a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code> transformation, which will <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">SELECT</span></span></code> without a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">GROUP</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">BY</span></span></code>."
      },
      {
        "type": "p",
        "text": "Note that queries can be filtered at any level. A filter on a source applies to the whole source; one before the fields in a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">reduce</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code> transformation applies to that transformation; and one after an aggregate field applies to that aggregate only. See filters documentation for more information on filter expressions. Here's an example with a variety of filter usage:"
      },
      {
        "type": "p",
        "text": "Queries can contain other nested structures, by including additional transformations as fields, so our named query (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sales_by_month_2020</span></span></code>) can also now be called anywhere as a nested structure. Note that these structures can nest infinitely!:"
      },
      {
        "type": "p",
        "text": "Putting a few named queries together as nested structures allows us to produce a dashboard with an overview of sales, having written remarkably little code. Use the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">dashboard</span></span></code> renderer to format the results like this:"
      },
      {
        "type": "p",
        "text": "<em>Note: To see the SQL being generated by your query, open up a New Terminal in the top menu, then select Output, and pick “Malloy” from the menu on the right.</em>"
      },
      {
        "type": "p",
        "text": "<em>The following walk-through covers similar concepts to the <a href=\"https://github.com/malloydata/malloy/#quick-start-videos\">Quick Start</a> videos in the README. You can find the complete source code for this model <a href=\"https://github.com/malloydata/malloy/blob/docs-release/samples/ecommerce/ecommerce.malloy\">here</a>.</em>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">sales_by_state_2020</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> {</span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2020</span><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sales</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.ecomm.order_items&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.ecomm.users&#39;</span><span style=\"color: #000000\">) </span><span style=\"color: #AF00DB\">on</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">user_id</span><span style=\"color: #000000\"> = </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">id</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2020</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">status</span><span style=\"color: #000000\"> != </span><span style=\"color: #A31515\">&#39;Cancelled&#39;</span><span style=\"color: #000000\"> &amp; != </span><span style=\"color: #A31515\">&#39;Returned&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sales</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">sale_price</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;California&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;New York&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;Texas&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">status</span><span style=\"color: #000000\"> != </span><span style=\"color: #A31515\">&#39;Cancelled&#39;</span><span style=\"color: #000000\"> &amp; != </span><span style=\"color: #A31515\">&#39;Processing&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">total_sale_price_2020</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">sale_price</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\">  ? </span><span style=\"color: #098658\">@2020</span><span style=\"color: #000000\"> },</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_items_returned</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">100.0</span><span style=\"color: #000000\"> * (</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">status</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;Returned&#39;</span><span style=\"color: #000000\"> }) / </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.ecomm.order_items&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">status</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state_dashboard</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">total_sales</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">order_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">orders_by_status</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">sales_by_month_2020</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">sales_by_state_2020</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">users</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sales</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">orders_by_status</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">sales_by_month_2020</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/ecommerce.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples"
    ],
    "paragraphs": [],
    "path": "/examples/faa/bigquery.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples",
      "Airport Dashboard"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Where can you fly from SJC? For each destination; Which carriers?  How long have they been flying there?\nAre they on time?"
      }
    ],
    "path": "/examples/faa/bigquery.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples",
      "Carrier Dashboard"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Tell me everything about a carrier.  How many destinations?, flights? hubs?\nWhat kind of planes to they use? How many flights over time?  What are\nthe major hubs?  For each destination, How many flights? Where can you? Have they been\nflying there long?  Increasing or decreasing year by year?  Any seasonality?"
      }
    ],
    "path": "/examples/faa/bigquery.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples",
      "Kayak Example Query"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Suppose you wanted to build a website like Kayak.  Let's assume that the data we have is\nin the future instead of the past.  The query below will fetch all the data needed\nto render a Kayak page in a singe query."
      }
    ],
    "path": "/examples/faa/bigquery.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples",
      "Sessionizing Flight Data."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "You can think of flight data as event data.  The below is a classic map/reduce roll up of the flight data by carrier and day, plane and day, and individual events for each plane."
      }
    ],
    "path": "/examples/faa/bigquery.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples",
      "The Malloy Model"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "All of the queries above are executed against the following model:"
      }
    ],
    "path": "/examples/faa/bigquery.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples",
      "Data Styles"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The data styles tell the Malloy renderer how to render different kinds of results."
      },
      {
        "type": "p",
        "text": "<em>The follow examples all run against the model at the bottom of this page OR you can find the source code <a href=\"https://github.com/malloydata/malloy/blob/docs-release/samples/faa/flights.malloy\">here</a>.</em>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">carrier_dashboard</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span><span style=\"color: #000000\">  ? </span><span style=\"color: #A31515\">&#39;Jetblue&#39;</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">kayak</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;SJC&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">destination</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;LAX&#39;</span><span style=\"color: #811F3F\">|&#39;BUR&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2004-01-01</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\"> ?</span><span style=\"color: #A31515\">&#39;WN&#39;</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2002-03-03</span><span style=\"color: #000000\"> } -&gt; </span><span style=\"color: #001080\">sessionize</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">airport_dashboard</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;SJC&#39;</span><span style=\"color: #000000\"> }</span></span></pre>"
      }
    ],
    "path": "/examples/faa/bigquery.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)"
    ],
    "paragraphs": [],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)",
      "PostgreSQL Setup"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Before you can run these NTSB sample models against a Postgres instance, you need to start up / connect to a database server instance and load it with the appropriate data.  These steps setup a database with the NTSB Flight dataset and respective sample models.  These steps use Docker for convenience, but the instructions can be modified to run a Postgres instance directly."
      }
    ],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)",
      "PostgreSQL Setup",
      "Start a local Postgres instance"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Start a Docker container running Postgres"
      }
    ],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)",
      "PostgreSQL Setup",
      "Load the NTSB dataset into Postgres"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Copy the SQL data file into the container"
      },
      {
        "type": "p",
        "text": "Run the file in the container"
      }
    ],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)",
      "Connect to Postgres in the extension"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Use the connection settings shown below to connect the VS Code extension to your local Postgres instance."
      },
      {
        "type": "p",
        "text": "<img src=\"https://user-images.githubusercontent.com/25882507/179831294-b6a69ef6-f454-48a7-8b93-aec2bff0ff3f.png\" alt=\"postgres-connection-example\"/>"
      }
    ],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)",
      "Modify the example Malloy models to work with Postgres"
    ],
    "paragraphs": [],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)",
      "Modify the example Malloy models to work with Postgres",
      "Change data source references"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<img src=\"https://user-images.githubusercontent.com/25882507/179834102-eef4aee4-973a-4259-bfe4-1487179012b3.png\" alt=\"source_table_reference\"/>"
      }
    ],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "NTSB Flight Database Examples (PostgreSQL)",
      "The Updated Malloy Model"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The follow example code will run against the local Postgres database."
      },
      {
        "type": "p",
        "text": "From the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">malloy</span><span style=\"color: #000000\">/</span></span></code> root directory of the repository, unzip the SQL script that will load the NTSB Flight dataset"
      },
      {
        "type": "p",
        "text": "The sample models from the NTSB Flight Dataset <a href=\"https://malloydata.github.io/malloy/documentation/examples/faa.html#the-malloy-model\">here</a> reference public BigQuery tables using the standard <em>project_name.dataset_name.table_name</em> BigQuery format.  Therefore, all the data source references with this format need to be changed to the Postgres format."
      },
      {
        "type": "p",
        "text": "All source data references prefixed with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">malloy</span><span style=\"color: #000000\">-</span><span style=\"color: #001080\">data</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">faa</span><span style=\"color: #000000\">.</span></span></code> must be changed to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">malloytest</span><span style=\"color: #000000\">.</span></span></code> (since that is the Postgres schema we used above) to conform to Malloy's Postgres <em>schema_name.table_name</em> format (the database name is not required).  Simply find and replace in VS Code or run <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sed</span><span style=\"color: #000000\"> -</span><span style=\"color: #001080\">i</span><span style=\"color: #000000\"> -</span><span style=\"color: #001080\">e</span><span style=\"color: #000000\"> </span><span style=\"color: #A31515\">&#39;s/malloy-data.faa./malloytest./g&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">path</span><span style=\"color: #000000\">/</span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\">/&lt;</span><span style=\"color: #001080\">your_file</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">malloy</span><span style=\"color: #000000\">&gt;</span></span></code>"
      },
      {
        "type": "p",
        "text": "<em>This page adapts the NTSB Flight Database examples <a href=\"https://malloydata.github.io/malloy/documentation/examples/faa.html\">here</a> to work with a Postgres instance rather than requiring BigQuery access.  Note that full support for Postgres is in progress and that date/time support is currently incomplete.</em>"
      }
    ],
    "path": "/examples/faa/postgres.md"
  },
  {
    "titles": [
      "Google Analytics"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Start by defining a source based on a query."
      },
      {
        "type": "p",
        "text": "We can then add a few named queries to the model to easily access or reference elsewhere."
      }
    ],
    "path": "/examples/ga_sessions.md"
  },
  {
    "titles": [
      "Google Analytics",
      "Putting it all together"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>You can find the complete source code for this model <a href=\"https://github.com/malloydata/malloy/blob/docs-release/samples/ga_sessions/ga_sessions.malloy\">here</a>.</em>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">sessions_dashboard</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">ga_sessions</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">by_region</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">by_device</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">by_source</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">by_category</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">hits</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">product</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">v2ProductCategory</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_productRevenue</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">sold_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/ga_sessions.md"
  },
  {
    "titles": [
      "Step 1: Understanding the Iowa Liquor Market Using Malloy"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Liquor sales in Iowa are state-controlled, with all liquor wholesale run by the state. All purchases and sales of liquor that stores make are a matter of public record. We are going to explore this data set to better understand the Iowa Liquor market."
      }
    ],
    "path": "/examples/iowa/iowa.md"
  },
  {
    "titles": [
      "Step 1: Understanding the Iowa Liquor Market Using Malloy",
      "A quick overview of the dataset:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "All data here is stored in BigQuery, in the table <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;bigquery-public-data.iowa_liquor_sales.sales&#39;</span></span></code>."
      },
      {
        "type": "p",
        "text": "<strong>Date/Time information</strong> (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">`date`</span></span></code>)"
      },
      {
        "type": "p",
        "text": "<strong>Store and Location</strong> (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">store_name</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">store_address</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">store_location</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">city</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">county</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">zip_code</span></span></code>)"
      },
      {
        "type": "p",
        "text": "<strong>Vendor information</strong> (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">vendor_name</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">vendor_number</span></span></code>)"
      },
      {
        "type": "p",
        "text": "<strong>Item information</strong> (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">item_number</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">item_description</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category_name</span></span></code>)"
      },
      {
        "type": "p",
        "text": "<strong>Volume Information</strong> (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">bottle_volume_ml</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">bottles_sold</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">volume_sold_liters</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">volume_sold_gallons</span></span></code>)"
      },
      {
        "type": "p",
        "text": "<strong>Pricing information</strong> (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">state_bottle_cost</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">state_bottle_retail</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sale_dollars</span></span></code>)"
      },
      {
        "type": "p",
        "text": "<em>The <a href=\"source.html\">Malloy data model</a> can be reviewed in examples under <a href=\"https://github.com/malloydata/malloy/blob/docs-release/samples/iowa/iowa.malloy\">'iowa'</a>.</em>"
      }
    ],
    "path": "/examples/iowa/iowa.md"
  },
  {
    "titles": [
      "Iowa Liquor Malloy Model"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/source.md"
  },
  {
    "titles": [
      "Iowa Liquor Malloy Model",
      "Schema Overview"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This is the malloy model used for the Analysis example.  It should be used as an reference when looking at the <a href=\"step2.html\">following sections</a>."
      },
      {
        "type": "p",
        "text": "The schema for the table <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">bigquery</span><span style=\"color: #000000\">-</span><span style=\"color: #001080\">public</span><span style=\"color: #000000\">-</span><span style=\"color: #001080\">data</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">iowa_liquor_sales</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">sales</span></span></code> as well as descriptions of each field can be found on the <a href=\"https://data.iowa.gov/Sales-Distribution/Iowa-Liquor-Sales/m3tr-qhgy\">Iowa Data site</a>."
      }
    ],
    "path": "/examples/iowa/source.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This lets us understand whether a vendor sells one item, or many different kinds of items."
      },
      {
        "type": "p",
        "text": "We can see which Vendors have the greatest breadth of products as it relates to sales volume."
      },
      {
        "type": "p",
        "text": "A few observations here: Jim Bean Brands has the greatest variety of items in this dataset. Yahara Bay Distillers Inc sells 275 different items but only has $100K in sales, while Fifth Generation sells only 5 different items, yet has $3M in volume."
      },
      {
        "type": "p",
        "text": "This is basically what a single record represents in this data set."
      },
      {
        "type": "p",
        "text": "Given the price of a bottle and its size (in ml), we can compute how much 100ml costs.  This becomes an attribute of an individual line item (a dimension, not a measure)."
      },
      {
        "type": "p",
        "text": "The calculation <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">total_sale_dollars</span></span></code> will show us the total amount, in dollars, that Iowa State stores sold."
      },
      {
        "type": "p",
        "text": "Having added this to the model, we can now reference <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">total_sale_dollars</span></span></code> to see the top items purchased by Liquor stores."
      },
      {
        "type": "p",
        "text": "We have both the bottle cost (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">state_bottle_cost</span></span></code>) and bottle price (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">state_bottle_retail</span></span></code>), allowing us to calculate percent gross margin on a per-item basis, giving us a new a dimension."
      },
      {
        "type": "p",
        "text": "Using our newly defined <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">price_per_100ml</span></span></code> as an attribute of a line item in a purchase order, we might like an average that we can use over a group of line items.  This is a simple example using line_items as the denominator, but an argument could be made to use per bottle something more complex."
      },
      {
        "type": "p",
        "text": "<strong>TLDR</strong>: In this section, we will flesh out our model with a few basic calculations: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">total_sale_dollars</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">item_count</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">line_item_count</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">price_per_100ml</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">avg_price_per_100ml</span></span></code>.  These calculations will be use in  subsequent analysis."
      }
    ],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations",
      "<em>total_sale_dollars</em> - What was the total volume of transactions?"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations",
      "<em>item_count</em> - How many different kinds of items were sold?"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations",
      "<em>gross_margin</em> - How much did the state of Iowa make on this item?"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Looking at gross margin across top selling items, we see that the gross margin is a <em>consistent 33.3 percent</em>.  A quick google search reveals that Iowa state law dictates the state can mark up liquor by up to 50% of the price from the vendor, so this makes sense!"
      }
    ],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations",
      "<em>total_bottles</em> - How many individual bottles were sold?"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations",
      "<em>line_item_count</em> - How many line items were on the purchase orders?"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations",
      "<em>price_per_100ml</em> - How expensive is this booze?"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "Iowa Liquor: Basic Calculations",
      "<em>avg_price_per_100ml</em> - How expensive is this class of booze?"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>See the complete <a href=\"source.html\">Iowa Liquor Malloy Model</a></em>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">vendor_name</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">item_description</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sale_dollars</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">vendor_name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">item_count</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">total_sale_dollars</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">item_description</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">state_bottle_retail</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">state_bottle_cost</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">gross_margin</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sale_dollars</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/iowa/step2.md"
  },
  {
    "titles": [
      "First Analysis, What are the top Brands and Price Points?"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2a.md"
  },
  {
    "titles": [
      "Definitions"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2a.md"
  },
  {
    "titles": [
      "Most popular vodka by dollars spent"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step2a.md"
  },
  {
    "titles": [
      "Adding a Query to the model."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This particular view of the data is pretty useful, an something we expect to re-use.  We can add this query to the model by incorporating it into the source definition:"
      }
    ],
    "path": "/examples/iowa/step2a.md"
  },
  {
    "titles": [
      "Examining Tequila"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Once the query is in the model we can simply call it by name, adjusting our filtering to ask questions about Tequila instead:"
      }
    ],
    "path": "/examples/iowa/step2a.md"
  },
  {
    "titles": [
      "Nested Subtables: A deeper look at a Vendor offerings"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "These nested subtables allow us to view both the high-level information of \"who are our top vendors\" as well as the supporting detail in one simple Malloy query."
      }
    ],
    "path": "/examples/iowa/step2a.md"
  },
  {
    "titles": [
      "Bucketing the data"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "At the top we see our lowest cost options at under $1/mL, with the more pricey beverages appearing as we scroll down."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">price_per_100ml</span></span></code> calculation, defined in the previous section, combines with our new named query to allow for some interesting analysis. Let's take a look at the entire Tequila category, and see the leaders within each price range.  We'll bucket <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">price_per_100ml</span></span></code> into even dollar amounts, and nest our <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">top_sellers_by_revenue</span></span></code> query to create a subtable for each bucket."
      },
      {
        "type": "p",
        "text": "<strong>TLDR;</strong> We'll use the measures we defined in the last section to write some basic queries to understand the Vodka market, and answer a few questions:  <em>What are the most popular brands?  Which is the most expensive?  Does a particular county favor expensive or cheap Vodka?</em>  We will then learn how to save a named query and use it as a basic <strong>Nested Query</strong>."
      },
      {
        "type": "p",
        "text": "The following sections use these definitions, created in the <a href=\"step2.html\">previous\nsection</a>."
      },
      {
        "type": "p",
        "text": "We start by  <a href=\"../../language/filters.html\">filtering the data</a> to only purchase records where the category name contains <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;VODKA&#39;</span></span></code>.  We group the data by vendor and description, and calculate the various totals. Note that Malloy <a href=\"../../patterns/order_by.html\">automatically orders</a> the results by the first measure descending (in this case)."
      },
      {
        "type": "p",
        "text": "Notice that the greatest sales by dollar volume is <em>Hawkeye Vodka</em>, closely followed by <em>Absolut</em>.  A lot more bottles of <em>Hawkeye</em> were sold, as it is 1/3 the price by volume of <em>Absolut</em>."
      },
      {
        "type": "p",
        "text": "Here we can see that <em>Patron Tequila Silver</em> is the most premium brand, followed by <em>Jose Cuervo</em> as a mid-tier  brand, with <em>Juarez Tequila Gold</em> more of an economy brand."
      },
      {
        "type": "p",
        "text": "The magic happens when we call a named query in the same way we would use any other field <a href=\"nesting.html\">nesting</a>. In the below query, we can see our vendors (sorted automatically by amount purchased, as well as the top 5 items for each vendor."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_name</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;TEQUILA&#39;</span><span style=\"color: #000000\"> } -&gt; </span><span style=\"color: #001080\">top_sellers_by_revenue</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_name</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;VODKA&#39;</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">vendor_name</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">item_description</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sale_dollars</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">total_bottles</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">avg_price_per_100ml</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_name</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;TEQUILA&#39;</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">price_per_100ml_bucket</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">floor</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">price_per_100ml</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_sellers_by_revenue</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_name</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;TEQUILA&#39;</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">vendor_name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sale_dollars</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">avg_price_per_100ml</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_sellers_by_revenue</span><span style=\"color: #000000\"> </span><span style=\"color: #008000\">// entire query is a field</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/iowa/step2a.md"
  },
  {
    "titles": [
      "Bucketing and Mapping: Categories and Bottles"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Our previous analysis of price per mL brings to mind questions around bottle size. How many different sizes do bottles come in?  Are there standards and uncommon ones?  Do vendors specialize in different bottle sizes?"
      }
    ],
    "path": "/examples/iowa/step3.md"
  },
  {
    "titles": [
      "Bucketing and Mapping: Categories and Bottles",
      "Testing the category map"
    ],
    "paragraphs": [],
    "path": "/examples/iowa/step3.md"
  },
  {
    "titles": [
      "Bucketing and Mapping: Categories and Bottles",
      "Understanding bottle sizes"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A first query reveals that there are 34 distinct bottle sizes in this data set, and that 750ml, 1750ml and 1000ml are by far the most common."
      },
      {
        "type": "p",
        "text": "Visualizing this query suggests that we might wish to create 3 distinct buckets to approximate small, medium and large bottles."
      }
    ],
    "path": "/examples/iowa/step3.md"
  },
  {
    "titles": [
      "Bucketing and Mapping: Categories and Bottles",
      "Creating a new Dimension for Bottle Size."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Look at the data through the new mapping."
      },
      {
        "type": "p",
        "text": "Let's take a look at each category class and see how many individual items it has.  We'll also build a nested query that shows the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category_name</span></span></code>s that map into that category class."
      }
    ],
    "path": "/examples/iowa/step3.md"
  },
  {
    "titles": [
      "Bucketing and Mapping: Categories and Bottles",
      "Looking at the entire market by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category_class</span></span></code>"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "With our new lens, we can now see the top sellers in each <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category_class</span></span></code>, allowing us to get an entire market summary with a single simple query."
      },
      {
        "type": "p",
        "text": "In this data set, there is a column called <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">bottle_volume_ml</span></span></code>, which is the bottle size in mL. Let's take a look."
      },
      {
        "type": "p",
        "text": "Looking at the above chart and table we can see that there are a bunch of small values, several big values at 750 and 1000, and then a bunch of larger values.  We can clean this up by bucketing bottle size into three groups using a Malloy <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">pick</span></span></code> expression that maps these values to strings."
      }
    ],
    "path": "/examples/iowa/step3.md"
  },
  {
    "titles": [
      "Bucketing and Mapping: Categories and Bottles",
      "Building <em>category_class</em>, a simplified version of <em>category_name</em>"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Using the query below, we can see that there are 68 different category names in the data set.  We can notice there is <em>80 Proof Vodka</em>, <em>Flavored Vodka</em> and more.  It would be helpful if we just could have all of these categorized together as vodkas."
      },
      {
        "type": "p",
        "text": "Malloy provides a simple way to map all these values, using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">pick</span></span></code> expressions.  In the <a href=\"source.html\">Malloy Model for this Data Set</a>, you will find the declaration below.  Each pick expression tests <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category_name</span></span></code> for a regular expression.  If it matches, it returns the name pick'ed."
      },
      {
        "type": "p",
        "text": "<strong>TLDR:</strong> <em>This step builds a couple of useful derivations, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category_class</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">bottle_size</span></span></code>.  There as 68 different <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">category_name</span></span></code>s in this data set, we reduce that to 9.  There are 34 <em>liter sizes</em>, we make a new dimension, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">bottle_size</span></span></code> that only has 3 possible values.</em>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">distinct_number_of_sizes</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">bottle_volume_ml</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">sizes</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">bottle_volume_ml</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">line_item_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">bottle_volume_ml</span><span style=\"color: #000000\"> &lt; </span><span style=\"color: #098658\">6000</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">bottle_size</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sale_dollars</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">line_item_count</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">item_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">bottle_size</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_class</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">item_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">names_list</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">item_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">distinct_number_of_sizes</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">bottle_volume_ml</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">sizes</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">bottle_volume_ml</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">line_item_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_class</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_sale_dollars</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_sellers_by_revenue</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">distinct_number_of_category_names</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">category_name</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">sizes</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">item_count</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">line_item_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/iowa/step3.md"
  },
  {
    "titles": [
      "Dashboards"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Putting it all together we can write a dashboard"
      }
    ],
    "path": "/examples/iowa/step6.md"
  },
  {
    "titles": [
      "Dashboards",
      "Run Dashboard"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Simply add some filters.  Notice the sub-dashboard for each of the Vendors."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">iowa</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">category_class</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;VODKAS&#39;</span><span style=\"color: #000000\"> } -&gt; </span><span style=\"color: #001080\">vendor_dashboard</span></span></pre>"
      }
    ],
    "path": "/examples/iowa/step6.md"
  },
  {
    "titles": [
      "Name Game"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The Data set consists of name, gender, state and year with the number of people that\nwere born with that name in that gender, state and year."
      }
    ],
    "path": "/examples/names.md"
  },
  {
    "titles": [
      "Name Game",
      "Grouping a query"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy compiles to SQL.  The SQL query for the above command is."
      }
    ],
    "path": "/examples/names.md"
  },
  {
    "titles": [
      "Name Game",
      "Expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Expressions work much the same as they do in SQL.  We can look at population over decade by using a calculation against the year."
      }
    ],
    "path": "/examples/names.md"
  },
  {
    "titles": [
      "Name Game",
      "Cohorts"
    ],
    "paragraphs": [],
    "path": "/examples/names.md"
  },
  {
    "titles": [
      "Name Game",
      "Dashboard"
    ],
    "paragraphs": [],
    "path": "/examples/names.md"
  },
  {
    "titles": [
      "Name Game",
      "Iconic Names by State and Gender"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Calculate the births per 100K for a name in general and a name within a state. Compute and sort by a ratio to figure out relative popularity."
      },
      {
        "type": "p",
        "text": "In SQL there are basically two kinds of <code>SELECT</code> commands: <code>SELECT ... GROUP BY</code> and <code>SELECT</code> without a grouping.\nIn Malloy, these are two different commands.  The command in Malloy for <code>SELECT ... GROUP BY</code> is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span></span></code>.  Since <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">number</span></span></code>\nand <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">year</span></span></code> are reserved words, we have to quote the names with back-tics."
      },
      {
        "type": "p",
        "text": "The command above says query the table <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span></span></code> and <em>project</em> (show)\nall the columns for the first 10 rows."
      },
      {
        "type": "p",
        "text": "<em>You can find the complete source code for this model <a href=\"https://github.com/malloydata/malloy/blob/docs-release/samples/names/names.malloy\">here</a>.</em>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">decade</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">floor</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">`year`</span><span style=\"color: #000000\"> / </span><span style=\"color: #098658\">10</span><span style=\"color: #000000\">) * </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: *</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">names</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">name_dashboard</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #A31515\">&#39;Mich%&#39;</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">names</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">from</span><span style=\"color: #000000\">(</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">decade</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">floor</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">`year`</span><span style=\"color: #000000\"> / </span><span style=\"color: #098658\">10</span><span style=\"color: #000000\">) * </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">gender</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">cohort_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_name</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">births_per_100k</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">floor</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">by_name</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">population</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">() / </span><span style=\"color: #001080\">cohort_population</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">() * </span><span style=\"color: #098658\">100000</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_cohort_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">cohort_population</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">dimension</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">concat</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">by_name</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">name</span><span style=\"color: #000000\">, </span><span style=\"color: #A31515\">&#39;&#39;</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">names</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">gender</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_cohort_population</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">names</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span><span style=\"color: #000000\">  ? </span><span style=\"color: #A31515\">&#39;Michael&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;Lloyd&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;Olivia&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">by_name</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">population</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">births_per_100k</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">names</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">decade</span><span style=\"color: #000000\"> &lt; </span><span style=\"color: #098658\">1970</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">gender</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">births_per_100k</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">births_per_100k</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">births_per_100k</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">50</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_state</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_gender</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">gender</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_name</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">15</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">popularity</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">popularity</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> (</span><span style=\"color: #001080\">by_state</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">births_per_100k</span><span style=\"color: #000000\"> - </span><span style=\"color: #001080\">births_per_100k</span><span style=\"color: #000000\">) / </span><span style=\"color: #001080\">births_per_100k</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/names.md"
  },
  {
    "titles": [
      "A Perfect Solver for Wordle using Data"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle.md"
  },
  {
    "titles": [
      "A Perfect Solver for Wordle using Data",
      "Step 1 - Raw Materials"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We are only interested in 5 letter words so create a query for that and\nlimit the results to 5 letter words."
      },
      {
        "type": "p",
        "text": "Notice that there are a bunch of proper names?  Let's look for only lowercase words as input\nand Uppercase words in the output of our query."
      },
      {
        "type": "p",
        "text": "and the query:"
      }
    ],
    "path": "/examples/wordle/wordle.md"
  },
  {
    "titles": [
      "A Perfect Solver for Wordle using Data",
      "Searching for Words"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Regular expressions are great for matching words.  We are going to use a few patterns."
      }
    ],
    "path": "/examples/wordle/wordle.md"
  },
  {
    "titles": [
      "A Perfect Solver for Wordle using Data",
      "Searching for Words",
      "This letter exists somewhere in the word"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Find words that contain X AND Y."
      }
    ],
    "path": "/examples/wordle/wordle.md"
  },
  {
    "titles": [
      "A Perfect Solver for Wordle using Data",
      "Searching for Words",
      "Letter position: This letter here, that letter NOT there"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Find words that have M in the 4th position and the 5th position is NOT E or Z"
      }
    ],
    "path": "/examples/wordle/wordle.md"
  },
  {
    "titles": [
      "A Perfect Solver for Wordle using Data",
      "Searching for Words",
      "Ruling letters out"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Find words that do NOT contain S,L,O,P, or E"
      },
      {
        "type": "p",
        "text": "<a href=\"https://www.powerlanguage.co.uk/wordle/\">Wordle</a> is an interesting, challenging and fun word game.  If you aren't familiar with it, I suggest that you play it before reading this article"
      },
      {
        "type": "p",
        "text": "The first thing we need is a word list.  It turns out that on most unix systems there is a word list that can be\nfound at <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">/</span><span style=\"color: #001080\">usr</span><span style=\"color: #000000\">/</span><span style=\"color: #001080\">share</span><span style=\"color: #000000\">/</span><span style=\"color: #001080\">dict</span><span style=\"color: #000000\">/</span><span style=\"color: #001080\">words</span></span></code>.  The file has a single word per line, so we've just uploaded the entire files (as a CSV)\ninto BigQuery. If you'd like to use DuckDB (which is natively supported) instead, follow <a href=\"wordle_duckdb.html\">these steps</a>."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">five_letter_words</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[X]&#39;</span><span style=\"color: #000000\"> &amp; ~ </span><span style=\"color: #811F3F\">r&#39;[Y]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">five_letter_words</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLOPE]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.malloytest.words_bigger&#39;</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: * }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.malloytest.words_bigger&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">five_letter_words</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">length</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">word</span><span style=\"color: #000000\">) = </span><span style=\"color: #098658\">5</span><span style=\"color: #000000\"> </span><span style=\"color: #008000\">// add a filter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">five_letter_words</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">five_letter_words</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">five_letter_words</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;...M[^EZ]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle.md"
  },
  {
    "titles": [
      "Letters and Positioning."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The query below produces a table with the numbers 1 to 5"
      }
    ],
    "path": "/examples/wordle/wordle1a.md"
  },
  {
    "titles": [
      "Letters and Positioning.",
      "Cross join these two tables to produce letter positioning."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The result is a table with nested data.  Each word contains a sub-table with a letter in each position."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">numbers</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.malloytest.numbers&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">num</span><span style=\"color: #000000\"> &lt;= </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">numbers</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">num</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">// define the query</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words_and_position</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">from</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">words</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">five_letter_words</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #008000\">// cross join is missing at the moment</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_cross</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">numbers</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">letter</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">substr</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">word</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">numbers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">num</span><span style=\"color: #000000\">, </span><span style=\"color: #098658\">1</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">position</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">numbers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #008000\">// run it</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: -&gt; </span><span style=\"color: #001080\">words_and_position</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle1a.md"
  },
  {
    "titles": [
      "Understanding Letter Frequency"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle2.md"
  },
  {
    "titles": [
      "Understanding Letter Frequency",
      "How many 5 letter words are there?"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle2.md"
  },
  {
    "titles": [
      "Understanding Letter Frequency",
      "What are the most common letters if 5 letter words?"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We can count both the number of words that contain the letter and the number of uses.  Many words have the same\nletter more than once."
      }
    ],
    "path": "/examples/wordle/wordle2.md"
  },
  {
    "titles": [
      "Understanding Letter Frequency",
      "Common Letters and Positions"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle2.md"
  },
  {
    "titles": [
      "Understanding Letter Frequency",
      "Removing Plurals and words that end in 'ED'"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We've noticed there are a lots of words that end in 'S' or 'ED' in the dataset, but in our experience they don't often appear in puzzles.  We've eliminated them from our model for now, by filtering them out on the source level:"
      }
    ],
    "path": "/examples/wordle/wordle2.md"
  },
  {
    "titles": [
      "Understanding Letter Frequency",
      "Now how many 5 letter words are there?"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle2.md"
  },
  {
    "titles": [
      "Understanding Letter Frequency",
      "Create a new source <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">wordle</span></span></code> to query the data in this form."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Starting with the <a href=\"wordle1a.html\">query we built in step one</a>, we built a query that produces a table of words with subtable where\neach row is the letter and position in that row."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word_count</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word_count</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">letter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">use_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">positition_order_bar_chart</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">position</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">letter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">use_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle2.md"
  },
  {
    "titles": [
      "Puzzle #214"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Query for best Starting words."
      },
      {
        "type": "p",
        "text": "Start with a word without duplicates to get coverage.  Today we choose 'SLATE'"
      },
      {
        "type": "p",
        "text": "Query for words that Contain 'T', don't have 'T' in the 4th spot and don't have the Letters 'SLAE'. Rank them by the number\nof possible space matches."
      },
      {
        "type": "p",
        "text": "'TIGHT\" has two Ts so skip it. Next best word..  'TOUCH'"
      },
      {
        "type": "p",
        "text": "Query for words that Contain 'T', don't have 'T' in the 1st and 4th spot.  Has O in the second spot.  and don't have the Letters 'SLAEUCH'."
      }
    ],
    "path": "/examples/wordle/wordle214.md"
  },
  {
    "titles": [
      "Puzzle #214",
      "Solved in 4!"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle214.md"
  },
  {
    "titles": [
      "Puzzle #214",
      "Solved in 4!",
      "Code For Wordlebot:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>January 19, 2022</em>"
      },
      {
        "type": "p",
        "text": "<a href=\"wordle5.html\">↩️ All Solved Puzzles</a>   |   <a href=\"wordle215.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "p",
        "text": "Wordlebot is written in <a href=\"https://github.com/malloydata/malloy/\">Malloy</a>. Read about <a href=\"wordle.html\">How Wordlebot is constructed</a> (only 50 lines of code) and a good example of using data to solve interesting problems."
      },
      {
        "type": "p",
        "text": "<a href=\"wordle5.html\">↩️ All Solved Puzzles</a>   |  <a href=\"wordle215.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;T&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[^T]O.[^T].&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLAEUCH]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;T&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[^TJ]OINT&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLAEUCH]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;T&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;...[^T].&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLAE]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle214.md"
  },
  {
    "titles": [
      "Puzzle #215"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Query for best starting words."
      }
    ],
    "path": "/examples/wordle/wordle215.md"
  },
  {
    "titles": [
      "Puzzle #215",
      "Start with 'SAUCE' today (why not?)"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle215.md"
  },
  {
    "titles": [
      "Puzzle #215",
      "Query for words that"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Don't have the letters 'SAUCE'"
      }
    ],
    "path": "/examples/wordle/wordle215.md"
  },
  {
    "titles": [
      "Puzzle #215",
      "Best next word is 'BOOTY', trust double letters today."
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle215.md"
  },
  {
    "titles": [
      "Puzzle #215",
      "Query for words that"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Contain 'B' and 'O' and 'T'"
      },
      {
        "type": "p",
        "text": "Don't have 'B' in the first spot and don't have 'O' in the third spot or 'T' in the forth spot."
      },
      {
        "type": "p",
        "text": "Have O in the second spot"
      },
      {
        "type": "p",
        "text": "Don't have the Letters 'SAUCEY'."
      }
    ],
    "path": "/examples/wordle/wordle215.md"
  },
  {
    "titles": [
      "Puzzle #215",
      "Solved in 3!"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle215.md"
  },
  {
    "titles": [
      "Puzzle #215",
      "Solved in 3!",
      "Code For Wordlebot:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>January 20, 2022</em>"
      },
      {
        "type": "p",
        "text": "<a href=\"wordle214.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle216.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "p",
        "text": "Wordlebot is written in <a href=\"https://github.com/malloydata/malloy/\">Malloy</a>. Read about <a href=\"wordle.html\">How Wordlebot is constructed</a> (only 50 lines of code) and a good example of using data to solve interesting problems."
      },
      {
        "type": "p",
        "text": "<a href=\"wordle214.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle216.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;B&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;O&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;T&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[^B]O[^O][^T].&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SAUCEY]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// word ~ r&#39;[]&#39;,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// word ~ r&#39;.....&#39;,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SAUCE]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle215.md"
  },
  {
    "titles": [
      "Puzzle #216"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle216.md"
  },
  {
    "titles": [
      "Puzzle #216",
      "Query for the best starting words."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Start with a word without duplicates to get coverage. We'll run with 'SLATE' as our starter again today."
      }
    ],
    "path": "/examples/wordle/wordle216.md"
  },
  {
    "titles": [
      "Puzzle #216",
      "The Second Guess"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Oof--no matches. Now what? We'll query for words that don't contain any of these characters, and rank them by the number of possible space matches."
      },
      {
        "type": "p",
        "text": "'CRONY' looks good, let's run with that."
      }
    ],
    "path": "/examples/wordle/wordle216.md"
  },
  {
    "titles": [
      "Puzzle #216",
      "Round 3: Tie Breaking"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "'CRONY' gave us one match and a yellow tile, so we'll query for words with 'R' in the second position, and that contain 'C', but not in the first position."
      },
      {
        "type": "p",
        "text": "Just two words left and at this point it's really a matter of luck--we can take a guess at what we think the creators used, but if we want Malloy to make all the decisions for us, as a somewhat nonsensical tiebreaker, why don't we see which letter appears more often in the dataset overall:"
      },
      {
        "type": "p",
        "text": "'P' appears a little bit more often than 'B'; we'll go with that."
      }
    ],
    "path": "/examples/wordle/wordle216.md"
  },
  {
    "titles": [
      "Puzzle #216",
      "Solved in 3.5?"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "It doesn't really feel like we can give ourselves this one with equal scores on the two words and an arbitrary tiebreaker at the end, so let's call it 3.5 this time."
      }
    ],
    "path": "/examples/wordle/wordle216.md"
  },
  {
    "titles": [
      "Puzzle #216",
      "Solved in 3.5?",
      "Code For Wordlebot:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>January 21, 2022</em>"
      },
      {
        "type": "p",
        "text": "<a href=\"wordle215.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle217.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "p",
        "text": "Wordlebot is written in <a href=\"https://github.com/malloydata/malloy/\">Malloy</a>. Read about <a href=\"wordle.html\">How Wordlebot is constructed</a> (only 50 lines of code) and a good example of using data to solve interesting problems."
      },
      {
        "type": "p",
        "text": "<a href=\"wordle215.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle217.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;C&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;R&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[^C]R...&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLATEONY]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">letter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">use_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLATE]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle216.md"
  },
  {
    "titles": [
      "Puzzle #217"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle217.md"
  },
  {
    "titles": [
      "Puzzle #217",
      "Query for the best starting words."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Skipping 'SAREE' to avoid duplicates this early in the game, let's go with 'SLATE' again."
      }
    ],
    "path": "/examples/wordle/wordle217.md"
  },
  {
    "titles": [
      "Puzzle #217",
      "The Second Guess"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "One green match--not a bad start. Let's find more words ending in E."
      },
      {
        "type": "p",
        "text": "The 'PRICE' is right, or something..."
      }
    ],
    "path": "/examples/wordle/wordle217.md"
  },
  {
    "titles": [
      "Puzzle #217",
      "Round 3: Tie Breaking"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "That worked nicely for us, we have two green matches and now we need to figure out where 'I' belong(s)."
      },
      {
        "type": "p",
        "text": "Another tie, today with a chance to guess just how into cooking the Wordle creators are. We can use our same letter commonality tie-breaker here; maybe this time we'll look at letter commonality for first position."
      },
      {
        "type": "p",
        "text": "'M' appears to be a little more common as a first letter than 'W' so we went with that."
      }
    ],
    "path": "/examples/wordle/wordle217.md"
  },
  {
    "titles": [
      "Puzzle #217",
      "Solved in 3.5 again"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "There it is, and our solution also happens to describe our reaction after missing that coin-toss! We'll go ahead and call this one 3.5 again based on the last round."
      }
    ],
    "path": "/examples/wordle/wordle217.md"
  },
  {
    "titles": [
      "Puzzle #217",
      "Solved in 3.5 again",
      "Code For Wordlebot:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>January 22, 2022</em>"
      },
      {
        "type": "p",
        "text": "<a href=\"wordle216.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle218.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "p",
        "text": "Wordlebot is written in <a href=\"https://github.com/malloydata/malloy/\">Malloy</a>. Read about <a href=\"wordle.html\">How Wordlebot is constructed</a> (only 50 lines of code) and a good example of using data to solve interesting problems."
      },
      {
        "type": "p",
        "text": "<a href=\"wordle216.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle218.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;I&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;..[^I]CE&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLATPR]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;.INCE&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLATPRM]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">position</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">1</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">letter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">word_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">use_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;....E&#39;</span><span style=\"color: #000000\">,      </span><span style=\"color: #008000\">// GREEN: E at the end</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #0000FF\">not</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[SLAT]&#39;</span><span style=\"color: #000000\">  </span><span style=\"color: #008000\">// GRAY doesn&#39;t have these characters</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle217.md"
  },
  {
    "titles": [
      "Puzzle #218"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Today was a bit of a kerfuffle.  It turns out that the word list we were using was too small and missing the\nword we were searching for.  We found a larger dictionary and uploaded and re-ran."
      }
    ],
    "path": "/examples/wordle/wordle218.md"
  },
  {
    "titles": [
      "Puzzle #218",
      "Query for the best starting words."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Skipping 'SAREE' and 'SOOTY' to avoid duplicates this early in the game, let's go with 'SAUCE' again."
      }
    ],
    "path": "/examples/wordle/wordle218.md"
  },
  {
    "titles": [
      "Puzzle #218",
      "The Second Guess"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "'C' as yellow in the 4th position."
      },
      {
        "type": "p",
        "text": "Wow, lots of double letter words, let's skip them this early in the game and pick 'CHOIR'"
      }
    ],
    "path": "/examples/wordle/wordle218.md"
  },
  {
    "titles": [
      "Puzzle #218",
      "Bang!  There is is 'CRIMP' in 3 guesses"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In three."
      }
    ],
    "path": "/examples/wordle/wordle218.md"
  },
  {
    "titles": [
      "Puzzle #218",
      "Bang!  There is is 'CRIMP' in 3 guesses",
      "Code For Wordlebot:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>January 23, 2022</em>"
      },
      {
        "type": "p",
        "text": "<a href=\"wordle217.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle219.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "p",
        "text": "Wordlebot is written in <a href=\"https://github.com/malloydata/malloy/\">Malloy</a>. Read about <a href=\"wordle.html\">How Wordlebot is constructed</a> (only 50 lines of code) and a good example of using data to solve interesting problems."
      },
      {
        "type": "p",
        "text": "<a href=\"wordle217.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>  |  <a href=\"wordle219.html\">➡️ Next Puzzle</a>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;C&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~</span><span style=\"color: #811F3F\">r&#39;I&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~</span><span style=\"color: #811F3F\">r&#39;R&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;C..[^CI][^R]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SAUEHO]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;C&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;...[^C].&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SAUE]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle218.md"
  },
  {
    "titles": [
      "Puzzle #219"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle219.md"
  },
  {
    "titles": [
      "Puzzle #219",
      "Query for the best starting words"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We'll open up with 'SAUCE' again today (skipping those double-letter words this early on)."
      }
    ],
    "path": "/examples/wordle/wordle219.md"
  },
  {
    "titles": [
      "Puzzle #219",
      "The Second Guess"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Nothing on 'SAUCE'--let's look for our top scoring words excluding these characters."
      },
      {
        "type": "p",
        "text": "Still feels a bit early for double letters, so we're running with 'DOILY'"
      }
    ],
    "path": "/examples/wordle/wordle219.md"
  },
  {
    "titles": [
      "Puzzle #219",
      "Round 3/4: More Creative Tie-breaking"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "With one green and one yellow match we're down to two possible words."
      },
      {
        "type": "p",
        "text": "Today, why don't we see whether 'KN' or 'TR' appear more commonly as starts for words in our dataset."
      },
      {
        "type": "p",
        "text": "Our luck on these tie-breakers really hasn't been so great, but all in all another 3.5 day isn't half bad!"
      }
    ],
    "path": "/examples/wordle/wordle219.md"
  },
  {
    "titles": [
      "Puzzle #219",
      "Round 3/4: More Creative Tie-breaking",
      "Code For Wordlebot:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>January 24, 2022</em>"
      },
      {
        "type": "p",
        "text": "<a href=\"wordle218.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>"
      },
      {
        "type": "p",
        "text": "Wordlebot is written in <a href=\"https://github.com/malloydata/malloy/\">Malloy</a>. Read about <a href=\"wordle.html\">How Wordlebot is constructed</a> (only 50 lines of code) and a good example of using data to solve interesting problems."
      },
      {
        "type": "p",
        "text": "<a href=\"wordle218.html\">⬅️ Previous Puzzle</a>   |   <a href=\"wordle5.html\">↩️ All Solved Puzzles</a>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;^KN&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">or</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;^TR&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">start_leters</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">substr</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">word</span><span style=\"color: #000000\">, </span><span style=\"color: #098658\">0</span><span style=\"color: #000000\">, </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word_score</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">score</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">   </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;O&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">   </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;.[^O].L.&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">   </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SAUCEDIY]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SAUCE]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle219.md"
  },
  {
    "titles": [
      "Letters and Positions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This query finds the most common letter-position matches."
      }
    ],
    "path": "/examples/wordle/wordle3.md"
  },
  {
    "titles": [
      "Letters and Positions",
      "Adding a wordlist"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We can see that 'E' in position 5 occurs in 498 words, 'S' in position 1  occurs in 441 words.  Words ending in 'Y' are surprisingly common."
      }
    ],
    "path": "/examples/wordle/wordle3.md"
  },
  {
    "titles": [
      "Letters and Positions",
      "Add this to our Model"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle3.md"
  },
  {
    "titles": [
      "Letters and Positions",
      "How many words with have an 'O' in the second position have a 'Y' and don't have 'SLA'"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle3.md"
  },
  {
    "titles": [
      "Letters and Positions",
      "How to pick the next word?"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We'd like to pick a word that is going to lead to the most will reveal the most about the most words.\nWe can produce a word score by taking our find word query and mapping back to words."
      }
    ],
    "path": "/examples/wordle/wordle3.md"
  },
  {
    "titles": [
      "Letters and Positions",
      "How many words with have an 'O' in the second position have a 'Y' and don't have 'SLA'"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The score should give us then best pick."
      }
    ],
    "path": "/examples/wordle/wordle3.md"
  },
  {
    "titles": [
      "Letters and Positions",
      "This looks pretty useful, lets make <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">find_words</span></span></code> return a score."
    ],
    "paragraphs": [
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[Y]&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;.O...&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLA]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;[Y]&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;.O...&#39;</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">word</span><span style=\"color: #000000\"> !~ </span><span style=\"color: #811F3F\">r&#39;[SLA]&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">find_words</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words_list</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">word</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">score</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">word_count</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">letter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">position</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">wordle</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">letter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">letters</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">position</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">words_list</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">word</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/examples/wordle/wordle3.md"
  },
  {
    "titles": [
      "Final Model"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Final Data Model - Goto <a href=\"wordle5.html\">Solve Puzzles</a>"
      }
    ],
    "path": "/examples/wordle/wordle4.md"
  },
  {
    "titles": [
      "Solved Puzzles"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Let's solve some puzzles!"
      },
      {
        "type": "p",
        "text": "<em>Wordlebot is writen in <a href=\"https://github.com/malloydata/malloy/\">Malloy</a>. Read about <a href=\"wordle.html\">How Wordlebot is constructed</a> (only 50 lines of code) and a good example of using data to solve interesting problems.</em>"
      },
      {
        "type": "p",
        "text": "<strong><a href=\"wordle214.html\">Wordle 214</a></strong>: <em>Jan 19</em> - Solved in 4"
      },
      {
        "type": "p",
        "text": "<strong><a href=\"wordle215.html\">Wordle 215</a></strong>: <em>Jan 20</em> - Solved in 3"
      },
      {
        "type": "p",
        "text": "<strong><a href=\"wordle216.html\">Wordle 216</a></strong>: <em>Jan 21</em> - Solved in 3.5"
      },
      {
        "type": "p",
        "text": "<strong><a href=\"wordle217.html\">Wordle 217</a></strong>: <em>Jan 22</em> - Solved in 3.5"
      },
      {
        "type": "p",
        "text": "<strong><a href=\"wordle218.html\">Wordle 218</a></strong>: <em>Jan 23</em> - Solved in 3"
      },
      {
        "type": "p",
        "text": "<strong><a href=\"wordle219.html\">Wordle 219</a></strong>: <em>Jan 24</em> - Solved in 3.5"
      }
    ],
    "path": "/examples/wordle/wordle5.md"
  },
  {
    "titles": [
      "Using DuckDB for Wordle Solver"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy natively supports DuckDB, allowing you to run Malloy models against DuckDB tables created from flat files (e.g. CSV, Parquet).\nYou can get started quickly by modifying two source definitions (below) from the Wordle Solver example in the documentation.\nThe below statements redefine the words and numbers sources using DuckDB instead of BigQuery."
      },
      {
        "type": "p",
        "text": "Instead of loading the word list from BigQuery, import the local word file directly into DuckDB:"
      },
      {
        "type": "p",
        "text": "Instead of loading the numbers table from BigQuery, generate the same table using SQL:"
      },
      {
        "type": "p",
        "text": "The rest of the example code will run as expected"
      }
    ],
    "path": "/examples/wordle/wordle_duckdb.md"
  },
  {
    "titles": [
      "Code For Wordlebot:"
    ],
    "paragraphs": [],
    "path": "/examples/wordle/wordle_model.md"
  },
  {
    "titles": [
      "Malloy's Features"
    ],
    "paragraphs": [],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Reusable Analytical Data Model"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Common calculations, table relationships and reusable queries can all be encoded in a Malloy\nData Model.  Malloy queries (equivalent of SQL's <code>SELECT</code>) run against the data model and\nproduce SQL."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Filtering Data"
    ],
    "paragraphs": [],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Reusable Aggregates"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In a Malloy Data Model, an aggregate computation need only be defined once (for example revenue).  Once defined, it can be used\nin any query at any level of granularity or dimensionality. Malloy retains enough information in the data graph\nto perform this calculation no matter how you ask for it. Reusable Aggregates help improve accuracy."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Reusable Dimensional calculations"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Dimensional (Scalar calculations) can also be introduced into the model. Dimensional calculation are useful\nmapping values, bucketing results and data cleanup."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Maintains Relationships"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "SQL's <code>SELECT</code> statement flattens the namespace into a wide table. Malloy retains the graph relationship\nof data lets you access and correctly perform computations and any place in the graph."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Reusable Queries"
    ],
    "paragraphs": [],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Aggregating Subqueries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy easily produces nested results.  Entire dashboards can be fetched in a single query.\nNamed queries of a given shape can easily be nested, visualized and reused."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Pipelines"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy can pipeline operations.  The output of one query can be the input for next."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "Malloy's Features",
      "Metadata, Visualization and Drilling"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Compiling a Malloy query returns metadata about the structure of the results. When combined with the query results, Malloy's rendering library can give a very\nrich user experience, rendering dashboards, visualizations.  Through this metadata\nthe visualization library can rewrite queries to drill through to data detail."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "Why do we need another data language?"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "SQL is complete but ugly: everything is expressible, but nothing is reusable; simple ideas are complex to express; the language is verbose and lacks smart defaults. Malloy is immediately understandable by SQL users, and far easier to use and learn."
      },
      {
        "type": "p",
        "text": "Key features and advantages:"
      },
      {
        "type": "p",
        "text": "Query and model in the same language - everything is reusable and extensible."
      },
      {
        "type": "p",
        "text": "Malloy reads the schema so you don’t need to model everything. Malloy allows creation of re-usable metrics and logic, but there’s no need for boilerplate code that doesn’t add anything new."
      },
      {
        "type": "p",
        "text": "Pipelining: output one query into the next easily for powerful advanced analysis."
      },
      {
        "type": "p",
        "text": "Aggregating Subqueries let you build nested data sets to delve deeper into data quickly, and return complicated networks of data from single queries (like GraphQL)."
      },
      {
        "type": "p",
        "text": "Queries do more: Power an entire dashboard with a single query. Nested queries are batched together, scanning the data only once."
      },
      {
        "type": "p",
        "text": "Indexes for unified suggest/search: Malloy automatically builds search indexes, making it easier to understand a dataset and filter values."
      },
      {
        "type": "p",
        "text": "Built to optimize the database: make the most of BigQuery, utilizing BI engine, caching, reading/writing nested datasets extremely fast, and more."
      },
      {
        "type": "p",
        "text": "Malloy models are purely about data; visualization and “styles” configurations live separately, keeping the model clean and easy to read."
      },
      {
        "type": "p",
        "text": "Aggregates are safe and accurate: Malloy generates distinct keys when they’re needed to ensure it never fans out your data."
      },
      {
        "type": "p",
        "text": "Nested tables are made approachable: you don’t have to model or flatten them; specify a query path and Malloy handles the rest."
      },
      {
        "type": "p",
        "text": "Compiler-based error checking: Malloy understands sql expressions so the compiler catches errors as you write, before the query is run."
      },
      {
        "type": "p",
        "text": "The first step in working with data, often is isolating the data you are interested in.\nMalloy introduces <a href=\"language/filters.html\">simplified filtering</a> for all types and allows these filters to be\napplied.  <a href=\"language/time-ranges.html\">Time calculations</a> are powerful and understandable."
      },
      {
        "type": "p",
        "text": "Queries can be introduced into a Malloy model and accessed by name.  One benefit is that the\nqueries are always accurate.  Think of a Malloy model as a data function library.\nQueries can also be used to create <a href=\"nesting.html\">nested subtables</a> in other queries."
      }
    ],
    "path": "/features.md"
  },
  {
    "titles": [
      "About Malloy"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy is an experimental language for describing data relationships and transformations. It is an analytical language that runs on SQL databases. It provides the ability to define a semantic data model and query it. Malloy currently works with SQL databases BigQuery, Postgres, and DuckDB."
      },
      {
        "type": "p",
        "text": "Queries compile to SQL, optimized for your database."
      },
      {
        "type": "p",
        "text": "Has both a semantic data model and a query language.  The semantic model contains reusable calculations and definitions, making queries short and readable."
      },
      {
        "type": "p",
        "text": "Excels at reading and writing nested data sets."
      },
      {
        "type": "p",
        "text": "Things that are complicated in SQL are simple to express in Malloy. For example: level of detail calculations, percent of total, aggregating against multiple tables across a join safely, date operations, reasonable ordering by default, and more."
      },
      {
        "type": "p",
        "text": "Malloy is a work in progress. Malloy is designed to be a language for anyone who works with SQL--whether you’re an analyst, data scientist, data engineer, or someone building a data application. If you know SQL, Malloy will feel familiar, while more powerful and efficient. Malloy allows you to model as you go, so there is no heavy up-front work before you can start answering complex questions, and you're never held back or restricted by the model."
      }
    ],
    "path": "/index.md"
  },
  {
    "titles": [
      "About Malloy",
      "Try Malloy Today:"
    ],
    "paragraphs": [],
    "path": "/index.md"
  },
  {
    "titles": [
      "About Malloy",
      "Get involved:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Learn the language with zero install using our entirely browser-based <a href=\"https://malloydata.github.io/malloy/fiddle/index.html?q=12+-+Line+Chart+with+two+dimension%3A+Flights+by+Month+and+Length&m=Flights&t=\">Malloy Fiddle</a>."
      },
      {
        "type": "p",
        "text": "Write Malloy in the <a href=\"https://marketplace.visualstudio.com/items?itemName=malloydata.malloy-vscode\">Visual Studio Code extension</a>: build semantic data models, query and transform data, and create simple visualizations and dashboards."
      },
      {
        "type": "p",
        "text": "Build data applications with <a href=\"https://www.npmjs.com/package/@malloydata/malloy\">npm modules</a> in javascript or typescript."
      },
      {
        "type": "p",
        "text": "Explore data with the <a href=\"https://github.com/malloydata/malloy/tree/main/demo/malloy-demo-composer\">Malloy Composer</a>, a demo of a data exploration application built on top of Malloy"
      },
      {
        "type": "p",
        "text": "Join our <a href=\"https://join.slack.com/t/malloy-community/shared_invite/zt-upi18gic-W2saeFu~VfaVM1~HIerJ7w\">Slack community</a>."
      },
      {
        "type": "p",
        "text": "File feature requests/bugs, join discussions, or contribute to Malloy on our <a href=\"https://github.com/malloydata/malloy\">Repo</a>."
      }
    ],
    "path": "/index.md"
  },
  {
    "titles": [
      "The Story of Malloy"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy was designed by a team of people with a lot of experience in\nunderstanding the task of extracting meaning from data. Years of constant\nexposure to SQL resulted in a tremendous sense of wonder at the\npower of SQL ... and a tremendous source of frustration at how\nbad SQL is at representing the types of operations needed to\nget meaningful data out of relational databases, and how\ndifficult it is to maintain and extend a complex set\nof transformations written in SQL."
      },
      {
        "type": "p",
        "text": "Malloy started as a \"clean slate\" thought experiment, if we knew\nall the things we know about data, and about programming with data,\nand about programming languages in general, and we were designing\na query language today, what would it look like."
      },
      {
        "type": "p",
        "text": "In it's earliest form, Malloy looked a lot like SQL, and\nmuch of Malloy continues to be influenced by the overall\ndesign of the SQL language. It was always the intention that there\ncould be a document that would contain both Malloy and SQL\nand those would make sense together, perhaps parallel to\nthe way Javascript and Typescript work together."
      }
    ],
    "path": "/language/about-malloy.md"
  },
  {
    "titles": [
      "Aggregates"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Basic Syntax"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Basic Syntax",
      "Counts"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Basic Syntax",
      "Distinct Counts"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Distinct counts may be used to count the number of distinct values of a particular field within a source."
      }
    ],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Basic Syntax",
      "Sums"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Basic Syntax",
      "Averages"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Basic Syntax",
      "Minima"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Basic Syntax",
      "Maxima"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Ungrouped Aggregates"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Aggregate Locality"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In SQL, some kinds of aggregations are difficult to express because locality of aggregation is restricted to the top level of a query. Malloy\noffers more control over this behavior, allowing these types of analysis to be\nexpressed much more easily."
      }
    ],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Aggregate Locality",
      "The Problem"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Suppose you were interested in learning more about the number of seats on\ncommercial aircraft. First you might look at the average number of seats\non all registered aircraft."
      },
      {
        "type": "p",
        "text": "You're also interested in knowing the average number of seats on the kinds of aircraft that are in use, or in other words, the average number of seats of the aircraft models of registered aircraft."
      }
    ],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Aggregate Locality",
      "The Solution"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Aggregate Locality",
      "Examples"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The following queries show six ways of calculating the average number of seats."
      },
      {
        "type": "p",
        "text": "This table summarizes the meaning of each of these calculations."
      }
    ],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Aggregate Locality",
      "Aggregates that Support Locality"
    ],
    "paragraphs": [],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Aggregates",
      "Aggregate Locality",
      "Aggregates on Fields"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">count</span></span></code> aggregate function may be used to count the number of records appearing in a source."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sum</span></span></code> function may be used to compute the sum of all records of a particular field."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">avg</span></span></code> function may be used to compute the average of all records of a particular field."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">min</span></span></code> function may be used to compute the minimum of all records of a particular field."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">max</span></span></code> function may be used to compute the maximum of all records of a particular field."
      },
      {
        "type": "p",
        "text": "In a query which is grouped by multiple dimensions, it is often useful to be able to perform an aggregate calculation on sub-groups to determine subtotals. The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">()</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">exclude</span></span></code> functions in Malloy allow control over grouping and ungrouping, making this simple:"
      },
      {
        "type": "p",
        "text": "To do this, you would start with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft</span></span></code> table and join in <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span></span></code> to get access to the number of seats, then take\nthe average of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span></span></code>."
      },
      {
        "type": "p",
        "text": "To do this, you might decide to start with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span></span></code> table instead."
      },
      {
        "type": "p",
        "text": "For convenience, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span></code> can be written as <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span></code>."
      },
      {
        "type": "p",
        "text": "The aggregate functions that support locality are <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">count</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sum</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">avg</span></span></code>."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">min</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">max</span></span></code> aggregates do not support aggregate locality because the minimum and maximum values are the same regardless of where they are computed. Local aggregation removes duplicate values (those corresponding to the same row in the aggregate source location), and minimum and maximum values do not change if values are repeated more than once."
      },
      {
        "type": "p",
        "text": "Aggregating \"on a field,\" e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span></code> is exactly equivalent to aggregating that field with respect to its direct parent source, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span></code>. This syntax is supported for the aggregate functions which benefit from aggregate locality and require a field, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">avg</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sum</span></span></code>."
      },
      {
        "type": "p",
        "text": "Malloy supports the standard aggregate functions <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">count</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sum</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">avg</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">min</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">max</span></span></code>. When these are used in a field's definition, they make that field a <a href=\"fields.html#measures\">measure</a>."
      },
      {
        "type": "p",
        "text": "Read more about Ungrouped Aggregates <a href=\"ungrouped-aggregates.html\">here</a>."
      },
      {
        "type": "p",
        "text": "However, this isn't actually the number you were interested in, because this measures the average number of seats across <em>all</em> aircraft models, not just the ones with actively-registered aircraft."
      },
      {
        "type": "p",
        "text": "Unfortunately, SQL doesn't have any native constructs to compute this value, and in practice analysts often resort to complicated <a href=\"https://www.zentut.com/data-warehouse/fact-table/\">fact tables</a> to perform this kind of query."
      },
      {
        "type": "p",
        "text": "Malloy introduces the concept of <em>aggregate locality</em>, meaning that aggregates can be computed with respect to different points in the data graph. In the following query, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">average_seats</span></span></code> is computed with respect to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span></span></code>,\nyielding the the average number of seats on aircraft models of aircraft listed in the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft</span></span></code> table."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">avg_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">average_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_on_source</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_on_field</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_distance</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">models_avg_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_models_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">longest_distance</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">max</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">cheapest_price</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">min</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">sale_price</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">faa_region</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">count_airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">overall_airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">())</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_of_total</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() / </span><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">())*</span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports_in_region</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(), </span><span style=\"color: #001080\">faa_region</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_in_region</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() / </span><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(), </span><span style=\"color: #001080\">faa_region</span><span style=\"color: #000000\">)*</span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">order_id</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">average_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">average_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">average_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_models_avg_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_avg_models_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_aircraft_models_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/aggregates.md"
  },
  {
    "titles": [
      "Apply (:) Operator"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The apply operator takes one expression and applies it to another.\nThe primary us of apply is to \"apply\" a value to a partial comparison,\nbut there are a number of other powerful gestures which use this operator."
      },
      {
        "type": "p",
        "text": "For an expression matching the pattern <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">x</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">expression</span></span></code>, the following table outlines the various meanings."
      },
      {
        "type": "p",
        "text": "In addition it is very common to use <a href=\"time-ranges.html\">Time Ranges</a>\nwith the apply operator, which operate similar to the numeric range\nexample above."
      }
    ],
    "path": "/language/apply.md"
  },
  {
    "titles": [
      "Malloy Quickstart"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "If you'd like to follow along with this guide, you can create a new <code>.malloy</code> file and run these queries there."
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Leading with the Source"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Query Operators"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Query Operators",
      "Multiple Field Operations"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Query Operators",
      "Project"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Everything has a Name"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Many SQL expressions will work unchanged in Malloy, and many functions available in Standard SQL are usable in Malloy as well. This makes expressions fairly straightforward to understand, given a knowledge of SQL."
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Modeling and Reuse"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Ordering and Limiting"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Filtering"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "When working with data, filtering is something you do in almost every query. Malloy's filtering is more powerful and expressive than that of SQL. When querying data, we first isolate the data we are interested in (filter it) and then perform aggregations and calculations on the data we've isolated (shape it). Malloy provides consistent syntax for filtering everywhere within a query."
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Filtering",
      "Filtering the Source"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Filtering",
      "Filtering Query Stages"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A note on filtering the source vs filtering in query stages: The below queries are both valid and produce identical SQL."
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Filtering",
      "Filtering Measures"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Dates and Timestamps"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Dates and Timestamps",
      "Time Literals"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Time literals can be used as values, but are more often useful in filters. For example, the following query\nshows the number of flights in 2003."
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Dates and Timestamps",
      "Truncation"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Dates and Timestamps",
      "Extraction"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Dates and Timestamps",
      "Time Ranges"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Nested Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The next several examples will use this simple source definition:"
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Nested Queries",
      "Aggregating Subqueries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Queries can be nested infinitely, allowing for rich, complex output structures. A query may always include another nested query, regardless of depth."
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Nested Queries",
      "Filtering Nested Queries"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Pipelines and Multi-stage Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Next, we'll use the output of that query as the input to another, where we determine which counties have the highest\npercentage of airports compared to the whole state, taking advantage of the nested structure of the data to to so."
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Joins"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Aggregate Calculations"
    ],
    "paragraphs": [],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Malloy Quickstart",
      "Comments"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In SQL, the <code>SELECT</code> command does two very different things.  A <code>SELECT</code> with a <code>GROUP BY</code> aggregates data according to the <code>GROUP BY</code> clause and produces aggregate calculation against every calculation not in the <code>GROUP BY</code>.  In Malloy, the query operator for this is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span></code>.  Calculation about data in the group are made using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span></code>."
      },
      {
        "type": "p",
        "text": "The second type of <code>SELECT</code> in SQL does not perform any aggregation;  All rows in the input table, unless filtered in some way, show up in the output table. In Malloy, this command is called <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span></code>."
      },
      {
        "type": "p",
        "text": "In the query below, the data will be grouped by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">state</span></span></code> and will produce an aggregate calculation for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airport_count</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">average_elevation</span></span></code>.  <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span></code>. The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span></code> list can contain references to existing aggregate fields or add new aggregate computations."
      },
      {
        "type": "p",
        "text": "Multiple <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span></code> statements can appear in the same query operation.  This can be helpful in rendering when the order of fields in the query output is significant."
      },
      {
        "type": "p",
        "text": "<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code> produces a list of fields.  For every row in the input table, there is a row in the output table."
      },
      {
        "type": "p",
        "text": "Named objects, like columns from a table, and fields defined in a source, can be included in field lists without an <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">is</span></span></code>"
      },
      {
        "type": "p",
        "text": "The basic types of Malloy expressions are <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">string</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">number</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">boolean</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code>."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">:</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">:</span></span></code> statements are synonyms and limits the number of rows returned. Results below are sorted by the first measure descending--in this case, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airport_count</span></span></code>."
      },
      {
        "type": "p",
        "text": "Default ordering can be overridden with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">:</span></span></code>, as in the following query, which shows the states in alphabetical order.  <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">:</span></span></code> can take a field index number or the name of a field."
      },
      {
        "type": "p",
        "text": "Literals of type <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code> are notated with an <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@</span></span></code>, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003-03-29</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@1994-07-14 10:23:59</span></span></code>. Similarly, years (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2021</span></span></code>), quarters (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2020-Q1</span></span></code>), months (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2019-03</span></span></code>), weeks (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@WK2021-08-01</span></span></code>), and minutes (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2017-01-01 10:53</span></span></code>) can be expressed."
      },
      {
        "type": "p",
        "text": "There is a special time literal <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">now</span></span></code>, referring to the current timestamp, which allows for relative time filters."
      },
      {
        "type": "p",
        "text": "Time values can be truncated to a given timeframe, which can be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">second</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">minute</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">hour</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">day</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">week</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">month</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">quarter</span></span></code>, or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">year</span></span></code>."
      },
      {
        "type": "p",
        "text": "Two kinds of time ranges are given special syntax: the range between two times and the range starting at some time for some duration. These are represented like <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003 to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2005</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2004-Q1 fo</span><span style=\"color: #000000\">r </span><span style=\"color: #098658\">6</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">quarters</span></span></code> respectively. These ranges can be used in filters just like time literals."
      },
      {
        "type": "p",
        "text": "Time literals and truncations can also behave like time ranges. Each kind of time literal has an implied duration that takes effect when it is used in a comparison, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003</span></span></code> represents the whole of the year 2003, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2004-Q1</span></span></code> lasts the whole 3 months of the quarter. Similarly, when a time value is truncated, it takes on the\ntimeframe from the truncation, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">month</span></span></code> means the entirety of the current month."
      },
      {
        "type": "p",
        "text": "When a time range is used in a comparison, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">=</span></span></code> checks for \"is in the range\", <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt;</span></span></code> \"is after\", and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&lt;</span></span></code> \"is before.\" So <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">some_time</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">@2003</span></span></code> filters dates starting on January 1, 2004, while <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">some_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2003</span></span></code> filters to dates in the year 2003."
      },
      {
        "type": "p",
        "text": "Here we can see that the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">by_facility</span></span></code> column of the output table contains nested subtables on each row. When interpreting these inner tables, all of the dimensional values from outer rows still apply to each of the inner rows."
      },
      {
        "type": "p",
        "text": "The output from one stage of a query can be passed into another stage using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code>. For example, we'll start with this query which outputs, for California and New York, the total number of airports, as well as the number of airports in each county."
      },
      {
        "type": "p",
        "text": "In this example, the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft</span></span></code> source is joined to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span></span></code>, and aircraft_models is joined via aircraft. These examples explicitly name both keys--this same syntax can be used to write more complex joins."
      },
      {
        "type": "p",
        "text": "Malloy code can include both line and block comments. Line comments, which begin with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">--</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">//</span></span></code>,\nmay appear anywhere within a line, and cause all subsequent characters on that line to be ignored.\nBlock comments, which are enclosed between <code>/*</code> and <code>*/</code>, cause all enclosed characters to be ignored\nand may span multiple lines."
      },
      {
        "type": "p",
        "text": "This guide introduces the basics of querying and modeling with Malloy. Malloy has a rendering system that can render <a href=\"../visualizations/dashboards.html\">results as tables, charts or dashboards</a>, but fundamentally the Malloy just returns data. Buttons on the top right of any \"Query Result\" box allow you to toggle between rendered results (HTML), raw data (JSON), and the SQL generated by the Malloy model."
      },
      {
        "type": "p",
        "text": "Queries are of the form: <em>source</em> <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code> <em>operation</em>"
      },
      {
        "type": "p",
        "text": "In Malloy, the source of a query is either a raw table, a <a href=\"source.html\">modeled source</a>, or another query."
      },
      {
        "type": "p",
        "text": "In this example, the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">()</span></span></code> function provides the query <em>source</em> from a table (or view) in the database.\nThe query <em>operation</em> is explicit about which fields are grouped, aggregated or projected."
      },
      {
        "type": "p",
        "text": "In Malloy, all output fields have names. This means that any time a query\nintroduces a new aggregate computation, it must be named. <em>(unlike SQL,\nwhich allows un-named expressions)</em>"
      },
      {
        "type": "p",
        "text": "Notice that Malloy uses the form \"<em>name</em> <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">is</span></span></code> <em>value</em>\" instead of SQL's \"<em>value</em> <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">as</span></span></code> <em>name</em>\".\nHaving the output column name written first makes it easier for someone reading\nthe code to visualize the resulting query structure."
      },
      {
        "type": "p",
        "text": "One of the main benefits of Malloy is the ability to save common calculations into a data model.  In the example below, we create a <em>source</em> object named <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> and add a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">dimension</span><span style=\"color: #000000\">:</span></span></code> calculation for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">county_and_state</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">:</span></span></code> calculation for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airport_count</span></span></code>.  Dimensions can be used in <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span></code>.  Measures can be used in <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\"> ?</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">having</span><span style=\"color: #000000\"> ?</span></span></code>."
      },
      {
        "type": "p",
        "text": "In Malloy, ordering and limiting work pretty much the same way they do in SQL, though Malloy introduces some <a href=\"order_by.html\">reasonable defaults</a>."
      },
      {
        "type": "p",
        "text": "A filter on a data source table narrows down which data is included to be passed to the query <em>operation</em>. This translates\nto a <code>WHERE</code> clause in SQL.\nIn this case, the data from the table is filtered to just airports in California."
      },
      {
        "type": "p",
        "text": "Filters can also be applied to any query <em>operation</em>. When using a filter in this way, it only applies to\nthe data for that operation alone. (More on this later, in the section on <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> operations in queries.)"
      },
      {
        "type": "p",
        "text": "A filter on an aggregate calculation (a <em>measure</em>) narrows down the data used in that specific calculation. In the example below, the calculations for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">heliports</span></span></code> are filtered separately."
      },
      {
        "type": "p",
        "text": "Working with time in data is often needlessly complex; Malloy has built in constructs to simplify many time-related operations. This section gives a brief introduction to some of these tools, but for more details see the <a href=\"time-ranges.html\">Time Ranges</a> section."
      },
      {
        "type": "p",
        "text": "Numeric values can be extracted from time values, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">day_of_year</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">some_date</span><span style=\"color: #000000\">)</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">minute</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">some_time</span><span style=\"color: #000000\">)</span></span></code>. See the full list of extraction functions <a href=\"time-ranges.html#extraction\">here</a>."
      },
      {
        "type": "p",
        "text": "In Malloy, queries can be <a href=\"nesting.html\">nested</a> to produce subtables on each output row. Such nested queries are called <em>aggregating subqueries</em>, or simply \"nested queries.\" When a query is nested inside another query, each output row of the outer query will have a nested table for the inner query which only includes data limited to that row."
      },
      {
        "type": "p",
        "text": "Filters can be isolated to any level of nesting. In the following example, we limit the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">major_facilities</span></span></code> query to only airports where <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">major</span></span></code> is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;Y&#39;</span></span></code>. This particular filter applies <em>only</em> to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">major_facilities</span></span></code>, and not to other parts of the outer query."
      },
      {
        "type": "p",
        "text": "Note: to pipeline a named query, the syntax to reference that named query is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt; </span><span style=\"color: #001080\">query_name</span></span></code>. An example of this can be found in the <a href=\"query.html#multi-stage-pipelines\">Query Doc</a>."
      },
      {
        "type": "p",
        "text": "<a href=\"join.html\">Joins</a> are declared as part of a source. When joining a source to another, it brings with it all child joins."
      },
      {
        "type": "p",
        "text": "As in SQL, aggregate functions <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">sum</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">count</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">avg</span></span></code> are available, and their use in\nan expression identifies the corresponding field as a <a href=\"fields.html#measures\">measure</a>."
      },
      {
        "type": "p",
        "text": "Aggregates may be computed with respect to any joined source, allowing for a wider variety of measurements to be calculated than is possible in SQL. See the <a href=\"aggregates.html#aggregate-locality\">Aggregate Locality</a> section for more information."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">average_elevation</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">elevation</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county_and_state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">max_elevation</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">max</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">elevation</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">full_name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">elevation</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_month</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">month</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">@2003</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span><span style=\"color: #000000\">; </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">departure_date</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">asc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">departure_date</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">day</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">code</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">full_name</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">city</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;SANTA CRUZ&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">max_elevation</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">max</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">elevation</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2003 to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2005</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;AL&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;KY&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;AIRPORT&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">heliports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;HELIPORT&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">total</span><span style=\"color: #000000\">     </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;NY&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span><span style=\"color: #000000\">; </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">4</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports_in_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports_in_state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_in_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">1</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">day_of_week</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">day</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// The average number of seats on models of registered aircraft</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">models_avg_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// The average number of seats on registered aircraft</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_avg_seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;AIRPORT&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">heliports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;HELIPORT&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">total</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county_and_state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">concat</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">county</span><span style=\"color: #000000\">, </span><span style=\"color: #A31515\">&#39;, &#39;</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">max_elevation</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">max</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">elevation</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">min_elevation</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">min</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">elevation</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_elevation</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">elevation</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.aircraft_models&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_model_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.aircraft&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">on</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_model_code</span><span style=\"color: #000000\"> = </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_model_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">on</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">tail_num</span><span style=\"color: #000000\"> = </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">-&gt;{</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2003-01</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">manufacturer</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">average_seats_per_model</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2003</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">major_facilities</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">major</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;Y&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">concat</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\">, </span><span style=\"color: #A31515\">&#39; (&#39;</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">full_name</span><span style=\"color: #000000\">, </span><span style=\"color: #A31515\">&#39;)&#39;</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;NY&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_5_counties</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/basic.md"
  },
  {
    "titles": [
      "Change Log"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We will use this space to highlight major and/or breaking changes to Malloy."
      }
    ],
    "path": "/language/changelog.md"
  },
  {
    "titles": [
      "Change Log",
      "v0.0.10"
    ],
    "paragraphs": [],
    "path": "/language/changelog.md"
  },
  {
    "titles": [
      "Change Log",
      "v0.0.10",
      "The apply operator is now ? and not :"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In the transition from filters being with an array like syntax ..."
      }
    ],
    "path": "/language/changelog.md"
  },
  {
    "titles": [
      "Change Log",
      "0.0.9"
    ],
    "paragraphs": [],
    "path": "/language/changelog.md"
  },
  {
    "titles": [
      "Change Log",
      "0.0.9",
      "Deprecation of brackets for lists of items"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "For example, this syntax:"
      },
      {
        "type": "p",
        "text": "Is now written:"
      },
      {
        "type": "p",
        "text": "The use of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">:</span></span></code> as the apply operator became a readability problem ..."
      },
      {
        "type": "p",
        "text": "As of this release, use of the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">:</span></span></code> as an apply operator will generate a warning,\nand in a near future release it will be a compiler error. The correct\nsyntax for apply is now the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">?</span></span></code> operator. As in"
      },
      {
        "type": "p",
        "text": "Prior to version 0.0.9, lists of things were contained inside <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">[ ]</span></span></code>. Going forward, the brackets have been removed. Our hope is that this will be one less piece of punctuation to track, and will make it easier to change from a single item in a list to multiple without adding in brackets."
      },
      {
        "type": "p",
        "text": "<em>Breaking changes indicated with *</em>"
      }
    ],
    "path": "/language/changelog.md"
  },
  {
    "titles": [
      "Expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Expressions in Malloy are much like expressions in any other language; they can have variables and operators and function calls in\nthe same syntax users are familiar with. However, Malloy also introduces several other kinds of expressions useful for the task of data analysis and transformation."
      }
    ],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Identifiers"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Mathematical Operators"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Logical Operators"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Logical Operators",
      "Comparison Operators"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Logical Operators",
      "Boolean Operators"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "SQL Functions"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Aggregation"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Filtered Expressions"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Safe Type Cast"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Pick Expressions"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Time Expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy has built in constructs to simplify many time-related operations, which are described here."
      }
    ],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Time Expressions",
      "Time Ranges"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<a id=\"numeric-ranges\"></a>"
      }
    ],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Time Expressions",
      "Time Truncation"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Time Expressions",
      "Time Extraction"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Another very common grouping for time related data is by particular components, and this extraction of a single component as an integer. In Malloy this gesture looks like a function call."
      }
    ],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Time Expressions",
      "Interval extraction"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "To measure the difference between two times, pass a range expression to\none of the below extraction functions. This is Malloy's take on SQL's <code>DATE_DIFF()</code> and <code>TIMESTAMP_DIFF()</code> :"
      }
    ],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Time Expressions",
      "Time Literals"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Special Filter Expression Syntax"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Special Filter Expression Syntax",
      "Partial Comparison"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Special Filter Expression Syntax",
      "Alternation"
    ],
    "paragraphs": [],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Expressions",
      "Special Filter Expression Syntax",
      "Application"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Applying a value to another value applies a default comparison on the two values:"
      },
      {
        "type": "p",
        "text": "Fields may be referenced by name, and fields in joins or nested structures can be described using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">.</span></span></code>s."
      },
      {
        "type": "p",
        "text": "Identifiers that share a name with a keyword in Malloy must be enclosed in back ticks <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">`</span></span></code>, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">`year`</span></span></code>."
      },
      {
        "type": "p",
        "text": "Typical mathematical operators <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">+</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">*</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">/</span></span></code> work as expected, and parentheses may be used to override precedence, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">six</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">10</span><span style=\"color: #000000\"> * (</span><span style=\"color: #098658\">3</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\">) / </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\"> + </span><span style=\"color: #098658\">1</span></span></code>."
      },
      {
        "type": "p",
        "text": "The unary minus / negation operator is also allowed, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">value</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> -</span><span style=\"color: #001080\">cost</span></span></code>."
      },
      {
        "type": "p",
        "text": "Standard comparison operators <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt;</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&lt;</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt;=</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&lt;=</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">=</span></span></code> are available in Malloy. \"Not equals\" is expressed using the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">!=</span></span></code> operator."
      },
      {
        "type": "p",
        "text": "Malloy includes the basic binary boolean operators <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">and</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">or</span></span></code>, as well as the unary <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">not</span></span></code> operator."
      },
      {
        "type": "p",
        "text": "The intention is to be able to call from Malloy any function which\nyou could call from Standard SQL. This is not well implemented at\nthe moment. If you experience type check errors, use the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">::</span><span style=\"color: #001080\">type</span></span></code>\ntypecast to work around the errors in typing."
      },
      {
        "type": "p",
        "text": "Safe type casting may be accomplished with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">::</span><span style=\"color: #001080\">type</span></span></code> syntax."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">pick</span></span></code> construction in Malloy is similar to <code>CASE</code> statements in SQL."
      },
      {
        "type": "p",
        "text": "Pick can be used to \"clean\" data, combining similar dirty values into one clean value. In the following example, the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">pick</span></span></code> statement collects all the \"this actually\nshipped\" statuses, and because there is no <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">else</span></span></code>, leaves the other\nstatus values alone."
      },
      {
        "type": "p",
        "text": "Another common kind of cleaning is to have a small set you want to group\nby and all other values are compressed into <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">null</span></span></code>. A <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">pick</span></span></code> clause with no value\npicks an applied value when the condition is met."
      },
      {
        "type": "p",
        "text": "Ranges between a start and end time can be constructed with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">to</span></span></code> operator, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003 to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2006</span></span></code>. This kind of range is also possible for numbers, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">10</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">20</span></span></code>."
      },
      {
        "type": "p",
        "text": "Time ranges can also be constructed with a start time and duration using the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">for</span></span></code> operator, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003 fo</span><span style=\"color: #000000\">r </span><span style=\"color: #098658\">6</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">years</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">now</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">for</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">20</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">minutes</span></span></code>."
      },
      {
        "type": "p",
        "text": "To truncate a time value to a given timeframe, use the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">.</span></span></code> operator followed by the timeframe, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">event_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">quarter</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span></code>."
      },
      {
        "type": "p",
        "text": "By way of example, if the value of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">time</span></span></code> is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2021-08-06 00:36</span></span></code>, then the below truncations will produce the results on the right:"
      },
      {
        "type": "p",
        "text": "A truncation made this way (unlike a truncation make in SQL with\n<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">TIMESTAMP_TRUNC</span><span style=\"color: #000000\">()</span></span></code>) can also function as a range. The range begins\nat the moment of truncation and the duration is the timeframe unit\nused to specify the truncation, so for example <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span></code>\nwould be a range covering the entire year which contains <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">time</span></span></code>."
      },
      {
        "type": "p",
        "text": "The \"Result\" column uses a value of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2021-08-06 00:55:05</span></span></code> for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">expr</span></span></code>."
      },
      {
        "type": "p",
        "text": "These will return a negative number if <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">t1</span></span></code> is later than <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">t2</span></span></code>."
      },
      {
        "type": "p",
        "text": "For <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">seconds</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">minutes</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">hours</span></span></code>, the returned values is the number of complete seconds/minutes/hours beween the two values. For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">hours</span><span style=\"color: #000000\">(</span><span style=\"color: #098658\">@2022-10-03 10:30:00</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2022-10-03 11:29:00</span><span style=\"color: #000000\">)</span></span></code> would return 0, because the range spans only 59 minutes, despite crossing over the hour boundry from 10 to 11. Likewise, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">minutes</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">now</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\"> + </span><span style=\"color: #098658\">59</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">seconds</span><span style=\"color: #000000\">)</span></span></code> will always return 0, regardless of what time it is."
      },
      {
        "type": "p",
        "text": "For <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">days</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">weeks</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">months</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">quarters</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">years</span></span></code>, the returned value is the number of day/week/month/quarter/year boundaries crossed between the two dates. For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">days</span><span style=\"color: #000000\">(</span><span style=\"color: #098658\">@2022-10-03 11:59</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2022-10-04 00:00</span><span style=\"color: #000000\">)</span></span></code> is 1, because the end time is on the day after the start time, even though only one minute passed between them. So <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">weeks</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">now</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\"> + </span><span style=\"color: #098658\">6</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">days</span><span style=\"color: #000000\">)</span></span></code> will return either 0 or 1 depending on the day of the week."
      },
      {
        "type": "p",
        "text": "Time literals are specified in Malloy with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@</span></span></code> character. A literal\nspecified this way has an implied duration which means a literal\ncan act like a range."
      },
      {
        "type": "p",
        "text": "For example the year <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003</span></span></code> can be used with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">event_time</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">@2003</span></span></code> to test if the\nevent happened in the year 2003."
      },
      {
        "type": "p",
        "text": "Partial comparisons, or \"partials\" are written with a binary comparison operator followed by a value, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt; </span><span style=\"color: #098658\">42</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">!= </span><span style=\"color: #0000FF\">null</span></span></code>. These can be thought of as conditions-as-values, or as functions that return a boolean."
      },
      {
        "type": "p",
        "text": "Conditions can be logically combined with the two alternation operators, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&amp;</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">|</span></span></code>. These are different from <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">and</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">or</span></span></code> in that they operate on conditions which return boolean values, rather than boolean values directly."
      },
      {
        "type": "p",
        "text": "Values can be used directly with the alternation operators, in which case the operator is assumed to be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">=</span></span></code>. For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;NY&#39;</span></span></code> is equivalent to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">= </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | = </span><span style=\"color: #A31515\">&#39;NY&#39;</span></span></code>."
      },
      {
        "type": "p",
        "text": "The apply operator <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">?</span></span></code> \"applies\" a value to another value, condition, or computation. This is most often used with partial comparisons or alternations."
      },
      {
        "type": "p",
        "text": "Applying a value to a condition is like filling in the condition with the given value. For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">height</span><span style=\"color: #000000\"> ? &gt; </span><span style=\"color: #098658\">5</span><span style=\"color: #000000\"> &amp; &lt; </span><span style=\"color: #098658\">10</span></span></code> is equivalent to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">height</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">5</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">height</span><span style=\"color: #000000\"> &lt; </span><span style=\"color: #098658\">10</span></span></code>."
      },
      {
        "type": "p",
        "text": "Many functions available in SQL are available unchanged in Malloy. See <a href=\"https://cloud.google.com/bigquery/docs/reference/standard-sql/syntax\">here</a> for documentation on functions available in BigQuery."
      },
      {
        "type": "p",
        "text": "Aggregations may included in an expression to create <a href=\"fields.html#measures\">measures</a>, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\">)</span></span></code>, or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span></code>. For detailed information, see the <a href=\"aggregates.html\">Aggregates</a> section."
      },
      {
        "type": "p",
        "text": "Aggregate expressions may be filtered, using the <a href=\"filters.html\">usual filter syntax</a>."
      },
      {
        "type": "p",
        "text": "Pick expressions are also compatible with the <a href=\"#apply-operator\">apply operator</a> and partial comparisons."
      },
      {
        "type": "p",
        "text": "A time value can be compared to a range. If the time is within the range it will be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">=</span></span></code>, before the range it will be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&lt;</span></span></code>, and after the range it will be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt;</span></span></code>. If you <a href=\"#apply-operator\">apply</a> a time to a range, (for example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">event_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2003 to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2004</span></span></code>) that will also check if the value is within the range."
      },
      {
        "type": "p",
        "text": "This is extremely useful with the <a href=\"#apply-operator\">apply operator</a>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">?</span></span></code>. To see if two events happen in the same calendar year, for example, the boolean expression in Malloy is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">one_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">other_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span></code>."
      },
      {
        "type": "p",
        "text": "As filtering is an incredibly common operation in data analysis, Malloy has special syntax to make filter expressions succinct and powerful. In addition to regular comparison and boolean operators, Malloy includes <em>partial comparisons</em>, <em>alternation</em>, and <em>application</em>, as described below."
      },
      {
        "type": "p",
        "text": "The <em>union alternation</em> operator <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">|</span></span></code> represents the logical union of two conditions. An expression like <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">x</span><span style=\"color: #000000\"> | </span><span style=\"color: #001080\">y</span></span></code> can be read \"if either <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">x</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">y</span></span></code>.\" For example <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">= </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | = </span><span style=\"color: #A31515\">&#39;NY&#39;</span></span></code> represents the condition \"is either CA or NY\"."
      },
      {
        "type": "p",
        "text": "The <em>conjunction alternation</em> operator <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&amp;</span></span></code> represents the logical conjunction of two conditions. An expression like \"<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">x</span><span style=\"color: #000000\"> &amp; </span><span style=\"color: #001080\">y</span></span></code> can be read \"if both <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">x</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">y</span></span></code>.\" For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt; </span><span style=\"color: #098658\">5</span><span style=\"color: #000000\"> &amp; &lt; </span><span style=\"color: #098658\">10</span></span></code> represents the condition \"is greater than 5 and less than 10\"."
      },
      {
        "type": "p",
        "text": "Values can be applied to <a href=\"#pick-expressions\">pick expressions</a> to make them more succinct."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">distance_2003</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\">) { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2003</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ca_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">county</span><span style=\"color: #000000\"> != </span><span style=\"color: #0000FF\">null</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">distance_summary</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">concat</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">total_distance</span><span style=\"color: #000000\">::</span><span style=\"color: #267F99\">string</span><span style=\"color: #000000\">, </span><span style=\"color: #A31515\">&#39; miles&#39;</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/expressions.md"
  },
  {
    "titles": [
      "Fields"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Fields constitute all kinds of data in Malloy. They\ncan represent dimensional attributes sourced directly from\ntables in a database, constant values to be used in later analysis, computed metrics derived from other fields, or even nested structures created from aggregating subqueries."
      }
    ],
    "path": "/language/fields.md"
  },
  {
    "titles": [
      "Fields",
      "Defining Fields"
    ],
    "paragraphs": [],
    "path": "/language/fields.md"
  },
  {
    "titles": [
      "Fields",
      "Field Names"
    ],
    "paragraphs": [],
    "path": "/language/fields.md"
  },
  {
    "titles": [
      "Fields",
      "Kinds of Fields"
    ],
    "paragraphs": [],
    "path": "/language/fields.md"
  },
  {
    "titles": [
      "Fields",
      "Kinds of Fields",
      "Dimensions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Dimensions are fields representing scalar values. All fields\ninherited directly from a table are dimensions."
      },
      {
        "type": "p",
        "text": "Dimensions are defined using expressions that contain no\naggregate functions."
      }
    ],
    "path": "/language/fields.md"
  },
  {
    "titles": [
      "Fields",
      "Kinds of Fields",
      "Measures"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Measures are fields representing aggregated data over\nmultiple records."
      }
    ],
    "path": "/language/fields.md"
  },
  {
    "titles": [
      "Fields",
      "Kinds of Fields",
      "Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Queries represent a pipelined data transformation including a source and one or more transformation stages. When queries are defined as part of a source or query stage, their source is implicit."
      },
      {
        "type": "p",
        "text": "A named query's pipeline can always begin with another named query."
      },
      {
        "type": "p",
        "text": "Fields defined in sources are reusable. A field is a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">dimension</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">measure</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span></span></code>.  When these are used in a query, these fields are invoked with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span></span></code>.   The definitions are the same  whether part of a source or a query stage. In either case, they are defined using the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">is</span></span></code> keyword."
      },
      {
        "type": "p",
        "text": "Field names must start with a letter or underscore, and can only contain letters, numbers, and underscores. Field names which conflict with keywords must be enclosed in back ticks, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`year`</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span></code>."
      },
      {
        "type": "p",
        "text": "Dimensions may be used in both <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">reduce</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code>\nqueries."
      },
      {
        "type": "p",
        "text": "Measures may not be used in <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code> queries. However, any measures that appear in a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">reduce</span></span></code> query stage are \"dimensionalized\" as part of the query, and are therefore usable as dimensions in subsequent stages."
      },
      {
        "type": "p",
        "text": "<strong>In a source</strong>"
      },
      {
        "type": "p",
        "text": "<strong>In a query stage</strong>"
      },
      {
        "type": "p",
        "text": "The right hand side of this kind of definition can be any\nfield expression. See the <a href=\"expressions.html\">Expressions</a>\nsection for more information."
      },
      {
        "type": "p",
        "text": "Named queries (see <a href=\"#queries\">below</a>) can also be defined as\npart of a source or query stage. When a named query is defined in a query stage, it is known as a \"nested query\" or an \"aggregating\nsubquery.\" See the <a href=\"nesting.html\">Nesting</a> section for a\ndetailed discussion of nested queries."
      },
      {
        "type": "p",
        "text": "Malloy includes three different <em>kinds</em> of fields: <em>dimensions</em>, <em>measures</em>, and <em>queries</em>."
      },
      {
        "type": "p",
        "text": "See the <a href=\"nesting.html\">Nesting</a> section for more details about named queries."
      }
    ],
    "path": "/language/fields.md"
  },
  {
    "titles": [
      "Filters"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Filtering which data is used in a query is an incredibly important aspect of data analysis. Malloy makes it easy to target specific parts of a query to apply individual filters."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Filter Syntax"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Regardless of the placement of a filter, the syntax looks the same."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Filter Placement"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A filter can be applied to the source of a query, to just one stage of a query, or even to a particular field or expression (measure or nested query)."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Filter Placement",
      "Filtering a Query's Source"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "When filtering a query's source, the filter applies to the whole query."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Filter Placement",
      "Filtering in a Query Stage"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A filter can also be applied to an individual query stage."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Filter Placement",
      "Filtering Aggregate Calculations"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Any measure can be filtered by adding a where clause."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Filter Placement",
      "Filtering Complex Measure"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Even complex measures can be filtered.  A common use case is to create a filtered\nmeasure and then create that as a percent of total."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Filter Placement",
      "Filtering Nested Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Even complex measures can be filtered.  A common use case is to create a filtered\nmeasure and then create that as a percent of total."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Common Patterns in Filters"
    ],
    "paragraphs": [],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Common Patterns in Filters",
      "Comparisons"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "All the usual comparison operators behave as expected, and are some of the most common kinds of filters."
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Common Patterns in Filters",
      "Combining Filters"
    ],
    "paragraphs": [],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Common Patterns in Filters",
      "Ranges"
    ],
    "paragraphs": [],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Common Patterns in Filters",
      "String \"Like\" Matching"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In the right hand (pattern) string, the following syntax is used:"
      },
      {
        "type": "p",
        "text": "A percent sign <code>%</code> matches any number of characters"
      },
      {
        "type": "p",
        "text": "An underscore <code>_</code> matches a single character"
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Common Patterns in Filters",
      "Regular Expressions"
    ],
    "paragraphs": [],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Common Patterns in Filters",
      "Alternation"
    ],
    "paragraphs": [],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Filters",
      "Examples of Filter Expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Use this table as a quick reference for common types of filter expressions."
      },
      {
        "type": "p",
        "text": "Logically, the comma-separated list of filters are <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">and</span></span></code>ed together, though in reality different conditions are checked in different places in the generated SQL, depending on what types of computation occurs in the expression."
      },
      {
        "type": "p",
        "text": "Filters can be logically combined using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">and</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">or</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">not</span></span></code>."
      },
      {
        "type": "p",
        "text": "A range of numeric or time values can be constructed\nwith the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">to</span></span></code>operator, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">10</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">100</span></span></code>. The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">~</span></span></code> operator will check to\nsee if a value is within a range."
      },
      {
        "type": "p",
        "text": "When comparing strings, the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">=</span></span></code> operator checks for pure equality, whereas the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">~</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">!~</span></span></code> operators, <code>LIKE</code> and <code>NOT LIKE</code>."
      },
      {
        "type": "p",
        "text": "When the right hand side of a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">~</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">!~</span></span></code> operator is a regular expression,\nMalloy checks whether the left hand side matches that regular expression. In Standard SQL, Malloy uses the <code>REGEXP_COMPARE</code> function."
      },
      {
        "type": "p",
        "text": "Each filter be any expression of type <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">boolean</span></span></code>, whether that's a boolean field <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">is_commercial_flight</span></span></code>, a comparison <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">distance</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">1000</span></span></code>, or any of the other kinds of boolean expressions that Malloy supports. For examples see <a href=\"#examples-of-filter-expressions\">the table below</a>, or for detailed information on the kinds of expressions Malloy supports, see the <a href=\"expressions.html\">Expressions</a> section."
      },
      {
        "type": "p",
        "text": "This section describes some of the more common patterns used in filter expressions. For a more detailed description of the possible kinds of expressions, see the <a href=\"expressions.html\">Expressions</a> section."
      },
      {
        "type": "p",
        "text": "Checking equality against multiple possible values is extremely common, and can be achieved succinctly using the <a href=\"expressions.html#application\">apply operator</a> and <a href=\"expressions.html#alternation\">alternation</a>."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">// add a couple of measures to the `flights` source</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">delayed_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_delay</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">30</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">percent_delayed</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">delayed_flights</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ca_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ca_delayed_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">delayed_flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ca_percent_delayed</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">percent_delayed</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ny_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;NY&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ny_delayed_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">delayed_flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;NY&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ny_percent_delayed</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">percent_delayed</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;NY&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">1000</span><span style=\"color: #000000\"> } -&gt; { </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;UA&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;AA&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ca_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ny_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;NY&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_km_from_ca</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\"> / </span><span style=\"color: #098658\">0.621371</span><span style=\"color: #000000\">) { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">// add a couple of measures to the `flights` source</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">delayed_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_delay</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">30</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">delay_stats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">delayed_flights</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">percent_delayed</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">delayed_flights</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ca_stats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">delay_stats</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ny_stats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">delay_stats</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;NY&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/filters.md"
  },
  {
    "titles": [
      "Imports"
    ],
    "paragraphs": [],
    "path": "/language/imports.md"
  },
  {
    "titles": [
      "Imports",
      "Import Locations"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Imported files may be specified with relative or absolute URLs."
      },
      {
        "type": "p",
        "text": "In order to reuse or extend a source from another file, you can include all the\nexported sources from another file using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">import</span><span style=\"color: #000000\"> </span><span style=\"color: #A31515\">&quot;path/to/some/file.malloy&quot;</span></span></code>."
      },
      {
        "type": "p",
        "text": "For example, if you wanted to create a file <code>samples/flights_by_carrier.malloy</code> with a query from the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span></span></code> source, you could write:"
      }
    ],
    "path": "/language/imports.md"
  },
  {
    "titles": [
      "Joins"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Joins in Malloy differ from SQL joins.  When two sources are joined,\nMalloy retains the graph nature and hierarchy of the the data relationships. This is unlike\nSQL, which flattens everything into a single table space."
      },
      {
        "type": "p",
        "text": "In Malloy, syntaxes for join are:"
      },
      {
        "type": "p",
        "text": "Malloy's joins are left outer by default.\nSince Malloy deals in graphs, some SQL Join types don't make sense (RIGHT JOIN, for example)."
      }
    ],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Joins",
      "Join Types"
    ],
    "paragraphs": [],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Joins",
      "Join Types",
      "Foreign Key to Primary Key"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The easiest, most error-proof way to perform a join is using the following syntax:"
      }
    ],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Joins",
      "Naming Joined Sources"
    ],
    "paragraphs": [],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Joins",
      "In-line Joins"
    ],
    "paragraphs": [],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Joins",
      "Using Fields from Joined Sources"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Measures and queries defined in joined sources may be used in addition to dimensions."
      }
    ],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Joins",
      "Join Example"
    ],
    "paragraphs": [],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Joins",
      "Inner Joins"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Inner join are essentially left joins with an additional condition that the parent table has matches in the joined table. The example below functions logically as an INNER JOIN, returning only users that have at least one row in the orders table, and only orders that have an associated user."
      },
      {
        "type": "p",
        "text": "Examples of the above, with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">orders</span></span></code> as the implied source:"
      },
      {
        "type": "p",
        "text": "<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">:</span></span></code> - the table we are joining has one row for each row in the source table."
      },
      {
        "type": "p",
        "text": "<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">join_many</span><span style=\"color: #000000\">:</span></span></code> - the table we are joining has many rows for each row in the source table"
      },
      {
        "type": "p",
        "text": "<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">join_cross</span><span style=\"color: #000000\">:</span></span></code> - the join is a cross product and there will be many rows in each side of the join."
      },
      {
        "type": "p",
        "text": "<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: &lt;</span><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">&gt; </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> &lt;</span><span style=\"color: #001080\">foreign_key</span><span style=\"color: #000000\">&gt;</span></span></code>"
      },
      {
        "type": "p",
        "text": "To join based on a foreign key through the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">primary_key</span></span></code> of a joined source, use <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">with</span></span></code> to specify an expression, which could be as simple as a field name in the source. This expression is matched against the declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">primary_key</span></span></code> of the joined source. Sources without a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">primary_key</span></span></code> cannot use <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">with</span></span></code> joins."
      },
      {
        "type": "p",
        "text": "This is simply a shortcut, when joining based on the primary key of a joined source. It is exactly equivalent to the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">on</span></span></code> join written like this."
      },
      {
        "type": "p",
        "text": "If no alias is specified using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">is</span></span></code>, the name of the join will be the name of the source being joined."
      },
      {
        "type": "p",
        "text": "To give the joined source a different name within the context source, use <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">is</span></span></code> to alias it."
      },
      {
        "type": "p",
        "text": "Sources do not need to be modeled before they are used in a join, though the join must be named using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">is</span></span></code>."
      },
      {
        "type": "p",
        "text": "When a source is joined in, its fields become nested within the parent source. Fields from joined sources can be referenced using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">.</span></span></code>:"
      },
      {
        "type": "p",
        "text": "This example demonstrates the definition of several different joins in a model and their use in a query.\nEntire subtrees of data can be joined.  In the example below, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft</span></span></code> joins <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_models</span></span></code>.  <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span></span></code>\njoins aircraft (which already has a join to aircraft manufacturer).  The tree nature of the join relationship\nretained."
      },
      {
        "type": "p",
        "text": "<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">manufacturer</span></span></code>"
      },
      {
        "type": "p",
        "text": "<a href=\"aggregates.html\">Aggregate calculations</a> navigate this graph to deduce\nthe locality of computation, so they are always computed correctly regardless of join pattern, avoiding the fan and chasm traps."
      },
      {
        "type": "p",
        "text": "For more examples and how to reason about aggregation across joins, review the <a href=\"aggregates.html\">Aggregates</a> section."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">-&gt;{</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">carrier_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">-&gt;{</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.aircraft_models&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_model_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_model_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #008000\">/* Individual airplanes */</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.aircraft&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_model_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #008000\">/* The airports that the aircraft fly to and from */</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin_airport</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">origin</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination_airport</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">destination</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">-&gt;{</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">manufacturer</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_model_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/join.md"
  },
  {
    "titles": [
      "Nested Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Nested queries, more formally known as \"aggregating subqueries\" are queries included in other queries. A nested query produces a subtable per row in the query in which it is embedded. In Malloy, queries can be named and referenced in other queries. The technical term \"aggregating subquery\" is a bit of a mouthful, so we more often refer to it as a \"nested query.\""
      },
      {
        "type": "p",
        "text": "When a named query is nested inside of another query, it produces an aggregating subquery and the results include a nested subtable."
      }
    ],
    "path": "/language/nesting.md"
  },
  {
    "titles": [
      "Nested Queries",
      "Nesting Nested Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Aggregating subqueries can be nested infinitely, meaning that a nested query can contain another nested query."
      }
    ],
    "path": "/language/nesting.md"
  },
  {
    "titles": [
      "Nested Queries",
      "Filtering Nested Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Filters can be applied at any level within nested queries."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;NY&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;MN&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_5_counties</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">major_facilities</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">major</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;Y&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">concat</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\">, </span><span style=\"color: #A31515\">&#39; - &#39;</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">full_name</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_5_counties</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/nesting.md"
  },
  {
    "titles": [
      "Ordering and Limiting"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Often when querying data the amount of data returned to look at is much smaller than the full result set, so the ordering of the data makes a big difference in what you actually see. To make things easier, Malloy has some smart defaults in the way it presents data.  For the most part, you don't have to think too much about it, but in order to understand it, this document will show you how Malloy makes decisions about what to show you."
      }
    ],
    "path": "/language/order_by.md"
  },
  {
    "titles": [
      "Ordering and Limiting",
      "Implicit Ordering"
    ],
    "paragraphs": [],
    "path": "/language/order_by.md"
  },
  {
    "titles": [
      "Ordering and Limiting",
      "Implicit Ordering",
      "Rule 1: Newest first"
    ],
    "paragraphs": [],
    "path": "/language/order_by.md"
  },
  {
    "titles": [
      "Ordering and Limiting",
      "Implicit Ordering",
      "Rule 2: Largest first"
    ],
    "paragraphs": [],
    "path": "/language/order_by.md"
  },
  {
    "titles": [
      "Ordering and Limiting",
      "Explicit Ordering"
    ],
    "paragraphs": [],
    "path": "/language/order_by.md"
  },
  {
    "titles": [
      "Ordering and Limiting",
      "Limiting"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In the following example, Rule 1 doesn't apply, so the default behavior is to sort by first aggregate, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flight_count</span></span></code> with the largest values first."
      },
      {
        "type": "p",
        "text": "You can be explicit about result ordering by using the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">order</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">by</span></span></code> clause."
      },
      {
        "type": "p",
        "text": "In the following example, the results are ordered by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">carrier</span></span></code> in reverse alphabetical order."
      },
      {
        "type": "p",
        "text": "Like in SQL, Malloy's <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">order</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">by</span></span></code> always defaults to ascending order when <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">desc</span></span></code> is omitted. This is true for any column of any type. In the example below,\nthe results are ordered by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">carrier</span></span></code> in alphabetical order."
      },
      {
        "type": "p",
        "text": "In Malloy, you can limit the number of results returned using a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">n</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">n</span></span></code>.  Both are provided for readability."
      },
      {
        "type": "p",
        "text": "In the example below, the results are limited to 2 rows, which are sorted by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">dep_month</span></span></code> with newest results first (due to Rule 1)."
      },
      {
        "type": "p",
        "text": "The following uses the <a href=\"../examples/faa.html\">NTSB Flight Model</a> for examples."
      },
      {
        "type": "p",
        "text": "If a query stage has a <a href=\"fields.html#dimensions\">dimensional</a> column that represents a point in time, it is usually the most\nimportant concept in the query.  Because the most recent data is usually the most relevant, Malloy sorts the newest data first."
      },
      {
        "type": "p",
        "text": "If there is a <a href=\"fields.html#measures\">measure</a> involved, Malloy sorts larger values first."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_month</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">month</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_month</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">month</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/order_by.md"
  },
  {
    "titles": [
      "The Malloy Language"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy is a language designed to provide a concise, powerful, and\nreadable vocabulary to express the kinds of data transformations\nneeded to extract useful information from a relational database.\nMalloy is essentially a Domain-specific Language (DSL) where the\n\"domain\" is \"exploration and transformation of SQL datasets.\""
      },
      {
        "type": "p",
        "text": "This section is designed to be an explorable reference to the underlying language."
      },
      {
        "type": "p",
        "text": "<a href=\"../language/basic.html\">Malloy Quickstart</a> An overview and introduction to the language with lots of examples and explanation."
      },
      {
        "type": "p",
        "text": "<a href=\"{{ '/documentation/malloy_by_example.html' | relative_url }}\">Malloy by Example</a> A faster-paced introduction to the language."
      },
      {
        "type": "p",
        "text": "<a href=\"about-malloy.html\">About Malloy</a> – Why Malloy was created and why it looks the way it does"
      },
      {
        "type": "p",
        "text": "<a href=\"query.html\">Queries</a> – How to write data transformations in Malloy"
      },
      {
        "type": "p",
        "text": "<a href=\"statement.html\">Models</a> – How to work more efficiently by building reusable models"
      }
    ],
    "path": "/language/overview.md"
  },
  {
    "titles": [
      "Queries"
    ],
    "paragraphs": [],
    "path": "/language/query.md"
  },
  {
    "titles": [
      "Queries",
      "Sources"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Defined as part of a source:"
      },
      {
        "type": "p",
        "text": "Nested inside another query stage:"
      }
    ],
    "path": "/language/query.md"
  },
  {
    "titles": [
      "Queries",
      "Pipelines"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A each stage of a pipeline performs transformation on the the source or a previous stage."
      },
      {
        "type": "p",
        "text": "A stage can do one of:"
      },
      {
        "type": "p",
        "text": "Example of a Reduction:"
      },
      {
        "type": "p",
        "text": "Example of a Projection:"
      },
      {
        "type": "p",
        "text": "Note that the operations in a stage are not order-sensitive like SQL; they can be arranged in any order."
      }
    ],
    "path": "/language/query.md"
  },
  {
    "titles": [
      "Queries",
      "Pipelines",
      "Multi-Stage Pipelines"
    ],
    "paragraphs": [],
    "path": "/language/query.md"
  },
  {
    "titles": [
      "Queries",
      "Fields"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In a query stage, fields (dimensions, measures, or\nqueries) may be specified either by referencing an existing\nname or defining them inline."
      }
    ],
    "path": "/language/query.md"
  },
  {
    "titles": [
      "Queries",
      "Filters"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Filters specified at the top level of query stage apply to\nthe whole stage."
      },
      {
        "type": "p",
        "text": "At the query level"
      },
      {
        "type": "p",
        "text": "or in the stage."
      }
    ],
    "path": "/language/query.md"
  },
  {
    "titles": [
      "Queries",
      "Ordering and Limiting"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Query stages may also include ordering and limiting\nspecifications."
      },
      {
        "type": "p",
        "text": "The leading <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code> is used when the source is a query:"
      },
      {
        "type": "p",
        "text": "a Reduction: a query containing <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span></span></code>/<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span></span></code> which includes aggregation and/or a group_by to reduce the grain of the data being transformed"
      },
      {
        "type": "p",
        "text": "a Projection: select fields without reducing using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code>."
      },
      {
        "type": "p",
        "text": "This example shows a pipeline with 3 stages, the multiple stages chained using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code>. Each stage generates a CTE in the SQL (click \"SQL\" on the right to see what this looks like.)"
      },
      {
        "type": "p",
        "text": "This can also be broken into multiple named queries. The syntax to refer to a top-level query (not defined inside a source) like this for purposes of pipelining is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt; </span><span style=\"color: #001080\">source_query_name</span></span></code>. Used in context:"
      },
      {
        "type": "p",
        "text": "When referencing existing fields, wildcard expressions <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">*</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">**</span></span></code>, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">some_join</span><span style=\"color: #000000\">.*</span></span></code> may be used."
      },
      {
        "type": "p",
        "text": "The basic syntax for a query in Malloy consists of a source and a \"pipeline\" of one or more <em>stages</em> separated by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code>. The shape of the data defined in the original source is transformed by each stage."
      },
      {
        "type": "p",
        "text": "The source of a query can be a table, a <a href=\"source.html\">source</a>, or a <a href=\"statement.html#queries\">named query</a>."
      },
      {
        "type": "p",
        "text": "<strong>A query against a table</strong>"
      },
      {
        "type": "p",
        "text": "<strong>A query against a source</strong>"
      },
      {
        "type": "p",
        "text": "<strong>A query starting from another query</strong>"
      },
      {
        "type": "p",
        "text": "<strong>Implicit Sources</strong>\nWhen a query is defined as part of a source or nested inside another query stage, the source is implicit."
      },
      {
        "type": "p",
        "text": "A reference to a <a href=\"nesting.html\">named query</a> (which defines its own pipeline) can be the first stage in a pipeline."
      },
      {
        "type": "p",
        "text": "See the <a href=\"fields.html\">Fields</a> section for more information\nabout the different kinds of fields and how they can be\ndefined."
      },
      {
        "type": "p",
        "text": "Filters may also be applied to a <a href=\"\">query's source</a>, an <a href=\"source.html#filtering-sources\">entire source</a>, or to a <a href=\"expressions.html\">measure</a>."
      },
      {
        "type": "p",
        "text": "See the <a href=\"filters.html\">Filters</a> section for more information."
      },
      {
        "type": "p",
        "text": "For detailed information on ordering and limiting, see the <a href=\"order_by.html\">Ordering and Limiting</a> section."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; { </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: *</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> &gt; </span><span style=\"color: #098658\">@2003</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">declare</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()     </span><span style=\"color: #008000\">-- declare defines a measure or dimension for use within query</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count_as_a_percent_of_total</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> * </span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/query.md"
  },
  {
    "titles": [
      "Sources"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy separates a query from the source of the data. A source can be thought of as a table and a collection of computations and relationships which are relevant to that table. These computations can consist of measures (aggregate functions), dimensions (scalar calculations) and query definitions;  joins are relationships between sources."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Sources"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A source can be any of the following:"
      },
      {
        "type": "p",
        "text": "A SQL table or view"
      },
      {
        "type": "p",
        "text": "Another Malloy source"
      },
      {
        "type": "p",
        "text": "A Malloy query"
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Sources",
      "Sources from Tables or Views"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A source can be created from a SQL table or view from a connected database."
      },
      {
        "type": "p",
        "text": "When defining a source in this way, all the columns from\nthe source table are available for use in field definitions\nor queries."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Sources",
      "Sources from Other Sources"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A source can also be created from another source in order\nto add fields, impose filters, or restrict available fields.\nThis is useful for performing in-depth analysis without altering\nthe base source with modifications only relevant in that specific context."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Sources",
      "Sources from Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A Query can be used as a source.\nIn Malloy, every query has a shape like that of a source,\nso the output fields of a query can be used to define a new\nsource."
      },
      {
        "type": "p",
        "text": "When defining a source from a query, the query can either\nbe defined inline or referenced by name."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Sources",
      "Sources from SQL Blocks"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Sources can be created from a SQL block, e.g."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Source Refinement"
    ],
    "paragraphs": [],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Source Refinement",
      "Filtering Sources"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "When a source is defined, filters which apply to any query against the new source may be added."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Source Refinement",
      "Primary Keys"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "To be used in joins to other sources, a source must\nhave a primary key specified."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Source Refinement",
      "Joins"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "When sources are joined as part of their definition, queries can reference fields in the joined sources without having to specify the join relationship each time."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Source Refinement",
      "Adding Fields"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Fields—dimensions, measures, and queries—may be defined as\npart of the source, allowing for them to be used in any\nquery against the source."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Source Refinement",
      "Renaming Fields"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Fields from a source may be renamed in the context of the\nnew source. This is useful when the original name is not descriptive, or has a different meaning in the new context."
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "Sources",
      "Source Refinement",
      "Limiting Access to Fields"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "When you add fields to or modify a source we call this refinements. This can  include adding filters, specifying a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">primary</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">key</span></span></code>, adding fields and\njoins, renaming fields, or limiting which fields are\navailable."
      },
      {
        "type": "p",
        "text": "The list of fields available in a source  can be limited. This can be done either by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">accept</span></span></code>ing a list of fields to include (in which case any other field from the source is excluded, i.e. an \"allow list\") or by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">except</span></span></code>ing a list of fields to exclude (any other field is included, i.e. a \"deny list\"). These cannot be used in conjunction with one another."
      },
      {
        "type": "p",
        "text": "<strong>Inline query as a source</strong>"
      },
      {
        "type": "p",
        "text": "<strong>Named query as a source</strong>"
      },
      {
        "type": "p",
        "text": "For more information about named queries appearing in models, see the <a href=\"statement.html\">Models</a> section."
      },
      {
        "type": "p",
        "text": "See the <a href=\"join.html\">Joins</a> section for more information on working with joins."
      },
      {
        "type": "p",
        "text": "<strong>Accepting fields</strong>"
      },
      {
        "type": "p",
        "text": "<strong>Excepting fields</strong>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">sql</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_sql_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> ||</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">SELECT</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    first_name,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    last_name,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    gender</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">FROM</span><span style=\"color: #000000\"> malloy-</span><span style=\"color: #0000FF\">data</span><span style=\"color: #000000\">.ecomm.users</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">LIMIT</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">;;</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">limited_users</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">from_sql</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">my_sql_query</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">user_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">limited_users</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">user_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier_facts</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">lifetime_flights_bucketed</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">lifetime_flights</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">long_sfo_flights</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination</span><span style=\"color: #000000\">; </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\">; </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_flights</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">carrier_stats</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier_facts</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">lifetime_flights_bucketed</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">lifetime_flights</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #008000\">// Columns from the source table are available</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">origin</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/source.md"
  },
  {
    "titles": [
      "SQL Blocks"
    ],
    "paragraphs": [],
    "path": "/language/sql_blocks.md"
  },
  {
    "titles": [
      "SQL Blocks",
      "Sources from SQL Blocks"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Sources can be created from a SQL block, e.g."
      },
      {
        "type": "p",
        "text": "Sometimes it is useful to add SQL statements into a Malloy file. You can do so by using the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">sql</span><span style=\"color: #000000\">:</span></span></code> keyword in combination with SQL literals, which are enclosed between an\nopening <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">||</span></span></code> and a closing <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">;;</span></span></code>."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">sql</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_sql_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> ||</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">SELECT</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    first_name,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    last_name,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    gender</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">FROM</span><span style=\"color: #000000\"> malloy-</span><span style=\"color: #0000FF\">data</span><span style=\"color: #000000\">.ecomm.users</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">LIMIT</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">;;</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">sql</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">my_sql_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> ||</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">SELECT</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    first_name,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    last_name,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    gender</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">FROM</span><span style=\"color: #000000\"> malloy-</span><span style=\"color: #0000FF\">data</span><span style=\"color: #000000\">.ecomm.users</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #0000FF\">LIMIT</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">;;</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">limited_users</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">from_sql</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">my_sql_query</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">user_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">limited_users</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">user_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/sql_blocks.md"
  },
  {
    "titles": [
      "How Malloy Generates SQL"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Basic structure of a Malloy Query:"
      },
      {
        "type": "p",
        "text": "This maps to the below SQL query structure:"
      }
    ],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This document is intended to serve as a reference for those who already know SQL and may find it helpful to map Malloy concepts and syntax to SQL."
      }
    ],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Components of a Query"
    ],
    "paragraphs": [],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Expressions"
    ],
    "paragraphs": [],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Expressions",
      "Working with Time"
    ],
    "paragraphs": [],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Not Supported and/or Coming Soon"
    ],
    "paragraphs": [],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Full Query Examples"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Many of the above concepts are best understood in the context of complete queries."
      }
    ],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Full Query Examples",
      "The Basics"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We’ll start with a relatively simple SQL query:"
      },
      {
        "type": "p",
        "text": "In Malloy, this is expressed:"
      }
    ],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Full Query Examples",
      "More Complex Example"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In Malloy, this can be expressed in a query:"
      },
      {
        "type": "p",
        "text": "Note that if we intend to query these tables and re-use these field definitions frequently, thinking about placing reusable definitions into the model will begin to save us a lot of time in the future."
      }
    ],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "SQL to Malloy",
      "Full Query Examples",
      "Subqueries / CTEs:"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "How much of our sales come from repeat customers vs loyal, repeat customers? Written in SQL:"
      },
      {
        "type": "p",
        "text": "The above Malloy code will produce this SQL:"
      },
      {
        "type": "p",
        "text": "In Malloy, the user_facts CTE becomes a source of its own, defined from a query using <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">from</span><span style=\"color: #000000\">()</span></span></code>. Any aggregates in this query (for now, just lifetime_orders) become dimensions of that source."
      },
      {
        "type": "p",
        "text": "Many SQL functions supported by the database can simply be used unchanged in Malloy. In certain cases we have implemented what we feel are improvements and simplifications of certain SQL functions. This is intended to serve as a quick reference, more complete documentation can be found <a href=\"https://malloydata.github.io/malloy/documentation/language/expressions.html\">here</a>."
      },
      {
        "type": "p",
        "text": "The <a href=\"https://malloydata.github.io/malloy/documentation/language/expressions.html#time-expressions\">Time Expressions</a> reference contains substantially more detail and examples."
      },
      {
        "type": "p",
        "text": "Feature requests are tracked using <a href=\"https://github.com/malloydata/malloy/issues\">Issues on Github</a>."
      },
      {
        "type": "p",
        "text": "One can also define a <a href=\"https://malloydata.github.io/malloy/documentation/language/sql_blocks.html\">SQL block</a> to be used as a source in Malloy."
      }
    ],
    "path": "/language/sql_to_malloy.md"
  },
  {
    "titles": [
      "Models"
    ],
    "paragraphs": [],
    "path": "/language/statement.md"
  },
  {
    "titles": [
      "Models",
      "Sources"
    ],
    "paragraphs": [],
    "path": "/language/statement.md"
  },
  {
    "titles": [
      "Models",
      "Queries"
    ],
    "paragraphs": [],
    "path": "/language/statement.md"
  },
  {
    "titles": [
      "Models",
      "Queries",
      "Referencing a modeled query"
    ],
    "paragraphs": [],
    "path": "/language/statement.md"
  },
  {
    "titles": [
      "Models",
      "Queries",
      "Running a named query with a filter"
    ],
    "paragraphs": [],
    "path": "/language/statement.md"
  },
  {
    "titles": [
      "Models",
      "Queries",
      "Adding a limit on the Query"
    ],
    "paragraphs": [],
    "path": "/language/statement.md"
  },
  {
    "titles": [
      "Models",
      "Queries",
      "Putting it all together"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "First, we'll create a brand new query:"
      },
      {
        "type": "p",
        "text": "Now we'll compose a query which contains both modeled and ad-hoc components:"
      },
      {
        "type": "p",
        "text": "Malloy recognizes modeling as a key aspect of data analytics and provides tools that allow for modularity and reusability of definitions. Whereas in SQL, queries generally define all metrics inline, requiring useful snippets to be saved and managed separately, in Malloy,\n<em>dimensions</em>, <em>measures</em>, and <em>queries</em> can be saved and attached to a modeled source."
      },
      {
        "type": "p",
        "text": "A Malloy model file can contain several <em>sources</em>, which can be thought of as a table and a collection of computations and relationships which are relevant to that table."
      },
      {
        "type": "p",
        "text": "See <a href=\"source.html\">here</a> for more information on sources."
      },
      {
        "type": "p",
        "text": "See <a href=\"query.html\">here</a> for more information on queries."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">by_carrier</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;SFO&#39;</span><span style=\"color: #000000\"> } -&gt; </span><span style=\"color: #001080\">by_carrier</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;SFO&#39;</span><span style=\"color: #000000\"> } -&gt; </span><span style=\"color: #001080\">by_carrier</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">average_distance_in_km</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">distance_km</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_carriers</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">by_carrier</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">average_distance_in_km</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">distance_km</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/statement.md"
  },
  {
    "titles": [
      "Malloy time range expressions"
    ],
    "paragraphs": [],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Range expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "There are two forms of range expressions"
      }
    ],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Range shortcuts"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Because grouping and filtering by specific time ranges is such a common operation for a data transformation task, Malloy has a number of expressive short cuts. The full power of the underlying SQL engine is also available for any type of truncation or extraction not supported by these shortcuts."
      }
    ],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Truncation"
    ],
    "paragraphs": [],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Truncation",
      "Truncations as ranges"
    ],
    "paragraphs": [],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Extraction"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Another very common grouping for time related data is by particular components, and this extraction of a single component as an integer. In Malloy this gesture looks like a function call."
      }
    ],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Interval extraction"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "To measure the difference between two times, pass a range expression to\none of these extraction functions:"
      },
      {
        "type": "p",
        "text": "These will return a negative number if t1 is later than t2."
      }
    ],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Literals"
    ],
    "paragraphs": [],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Malloy time range expressions",
      "Literals",
      "Time Units"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "These are the time units currently supported by Malloy."
      },
      {
        "type": "p",
        "text": "Malloy supports two time-related types, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code>.\nBoth of these can be used with these techniques, though the exact\ntruncations or extractions available will vary depending on the\ndata type (e.g. it would make no sense to attempt to truncate a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code> object by <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">minute</span></span></code>)."
      },
      {
        "type": "p",
        "text": "To create truncation, use the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">.</span></span></code> operator followed by the desired timeframe."
      },
      {
        "type": "p",
        "text": "By way of example, if the value of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">expr</span></span></code> is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2021-08-06 00:36</span></span></code>, then the below truncations will produce the results on the right:"
      },
      {
        "type": "p",
        "text": "A truncation made this way (unlike a truncation make in SQL with\n<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">TIMESTAMP_TRUNC</span><span style=\"color: #000000\">()</span></span></code>) can also function as a range. The range begins\nat the moment of truncation and the duration is the timeframe unit\nused to specify the truncation, so for example <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">eventDate</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span></code>\nwould be a range covering the entire year which contains <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">eventDate</span></span></code>"
      },
      {
        "type": "p",
        "text": "The \"Result\" column uses a value of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">2021</span><span style=\"color: #000000\">-08-06 00:</span><span style=\"color: #098658\">55</span><span style=\"color: #000000\">:05</span></span></code> for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">expr</span></span></code>."
      },
      {
        "type": "p",
        "text": "Time literals are specified in Malloy with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@</span></span></code> character. A literal\nspecified this way has an implied duration which means a literal\ncan act like a range."
      },
      {
        "type": "p",
        "text": "For example the year <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003</span></span></code> can be used with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">eventTime</span><span style=\"color: #000000\"> : </span><span style=\"color: #098658\">@2003</span></span></code> to test if the\nevent happened in the year 2003."
      },
      {
        "type": "p",
        "text": "<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">second</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">minute</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">hour</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">week</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">month</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">quarter</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">year</span></span></code>"
      },
      {
        "type": "p",
        "text": "<em>expr</em> <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">to</span></span></code> <em>expr</em> ( <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2001 to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2003</span></span></code>)"
      },
      {
        "type": "p",
        "text": "<em>expr</em> <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">for</span></span></code> <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">N</span></span></code> <em>units</em> ( <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">now</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">for</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">15</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">minutes</span></span></code> )"
      },
      {
        "type": "p",
        "text": "A timestamp can be compared to a range. If the time stamp is within\nthe range it will be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">=</span></span></code>. Before the range it will be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&lt;</span></span></code> and after\nthe range it will be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt;</span></span></code>. If you <a href=\"apply.html\">apply</a> a range, (for example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">eventDate</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">@2003 to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2004</span></span></code>) that will also check if the value is within the range."
      },
      {
        "type": "p",
        "text": "This is extremely useful with the <a href=\"apply.html\">Apply operator</a>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">?</span></span></code>. To see if two events happen in the same calendar year, for example, the boolean expression in Malloy is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">oneEvent</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">otherEvent</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span></code>"
      }
    ],
    "path": "/language/time-ranges.md"
  },
  {
    "titles": [
      "Types"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "All fields in Malloy have a type. Today, these types are\nmostly scalar, with a few notable exceptions."
      }
    ],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Scalar Types"
    ],
    "paragraphs": [],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Scalar Types",
      "Numbers"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Today, no other forms of literal numbers (e.g. numbers in other\nbases, numbers with thousand separators, exponential notation, etc.) are legal."
      }
    ],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Scalar Types",
      "Strings"
    ],
    "paragraphs": [],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Scalar Types",
      "Dates and Timestamps"
    ],
    "paragraphs": [],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Scalar Types",
      "Booleans"
    ],
    "paragraphs": [],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Scalar Types",
      "Bytes"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Bytestrings are represented by the <code>bytes</code> type\nin Malloy."
      },
      {
        "type": "p",
        "text": "There is currently no syntax for specifying <code>bytes</code> literals or casting to the <code>bytes</code> type."
      }
    ],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Intermediate Types"
    ],
    "paragraphs": [],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Intermediate Types",
      "Regular Expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In the future, the literal regular expressions will likely\nbe simply slash-enclosed, e.g <code>/.*/</code>."
      }
    ],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Intermediate Types",
      "Ranges"
    ],
    "paragraphs": [],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Intermediate Types",
      "Alternations and Partials"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Scalar values, regular expressions, and\nranges may also be used in alternations, in which case the\ncondition is assumed to be that of equality, matching, and\ninclusion respectively."
      }
    ],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Types",
      "Nullability"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "All numbers in Malloy are of type <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">number</span></span></code>, including BigQuery's <code>INTEGER</code>, <code>INT64</code>, <code>FLOAT</code>, and <code>FLOAT64</code> types."
      },
      {
        "type": "p",
        "text": "Literal <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">number</span></span></code>s consist of one or more digits optionally followed\nby a decimal point <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">.</span></span></code> and more digits, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">42</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">3.14</span></span></code>."
      },
      {
        "type": "p",
        "text": "Negative numbers are represented using the unary minus\noperator, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-</span><span style=\"color: #098658\">7</span></span></code>."
      },
      {
        "type": "p",
        "text": "In Malloy, strings of any length are represented by the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">string</span></span></code> type."
      },
      {
        "type": "p",
        "text": "Literal strings in Malloy are enclosed in single quotes <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;</span></span></code>, and may include the escape sequences <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">\\\\</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">\\.</span></span></code>, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;</span><span style=\"color: #EE0000\">\\&#39;</span><span style=\"color: #A31515\">Hello, world</span><span style=\"color: #EE0000\">\\&#39;</span><span style=\"color: #A31515\">&#39;</span></span></code>."
      },
      {
        "type": "p",
        "text": "Malloy has two time types, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code>."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">boolean</span></span></code> type covers both the <code>BOOLEAN</code> and <code>BOOL</code> types from BigQuery."
      },
      {
        "type": "p",
        "text": "In Malloy, the boolean literals are written <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">true</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">false</span></span></code>."
      },
      {
        "type": "p",
        "text": "Literal regular expressions are enclosed in single quotation\nmarks <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;</span></span></code> and preceded by either <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">/</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">r</span></span></code>, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #811F3F\">/&#39;.*&#39;</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #811F3F\">r&#39;.*&#39;</span></span></code>. Both syntaxes are semantically equivalent."
      },
      {
        "type": "p",
        "text": "There are three types of ranges today: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">string</span></span></code> ranges, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code> ranges, and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code> ranges. The most basic ranges\nare of the form <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">start</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">end</span></span></code> and represent the inclusive range between <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">start</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">end</span></span></code>, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">10</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">20</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2004-01 to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">@2005-05</span></span></code>."
      },
      {
        "type": "p",
        "text": "In the future, other ranges may be allowed, such as <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">string</span></span></code> ranges."
      },
      {
        "type": "p",
        "text": "Today, all Malloy types include the value <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">null</span></span></code>, however\nin the future Malloy may have a concept of nullable vs.\nnon-nullable types."
      },
      {
        "type": "p",
        "text": "Both the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code> types may have an associated\n<em>timeframe</em>, which can be <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">year</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">quarter</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">month</span></span></code>,\n<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">week</span></span></code>, or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">day</span></span></code>, and for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code>s only, additionally\n<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">hour</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">minute</span></span></code>, or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">second</span></span></code>."
      },
      {
        "type": "p",
        "text": "Literals for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">date</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">timestamp</span></span></code> are preceded by the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@</span></span></code> character, e.g. <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@2003</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">@1983-11-23 10:00:10</span></span></code>. For all\nvariations of time literals and information about their interaction with comparison operators, see the <a href=\"time-ranges.html#literals\">Time Ranges</a> section."
      },
      {
        "type": "p",
        "text": "The following types are not assignable to fields, and are\ntherefore considered <em>intermediate types</em>, in that they are\nprimarily used to represent part of a computation that\nyields a regular scalar type, often <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">boolean</span></span></code>."
      },
      {
        "type": "p",
        "text": "Values of type <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #267F99\">string</span></span></code> may be compared against regular\nexpressions using either the <a href=\"apply.html\">apply operator</a>,<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">name</span><span style=\"color: #000000\">: </span><span style=\"color: #811F3F\">r&#39;c.*&#39;</span></span></code> or the like operator, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> ~ </span><span style=\"color: #811F3F\">r&#39;c.*&#39;</span></span></code>."
      },
      {
        "type": "p",
        "text": "Ranges may be used in conjunction with the <a href=\"apply.html\">apply operator</a> to test whether a value falls within a given range."
      },
      {
        "type": "p",
        "text": "<em>Partials</em> represent a \"part of\" a comparison.\nSpecifically, a partial is a comparison missing its\nleft-hand side, and represents the condition of the\ncomparison yielding <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">true</span></span></code> if a given value were to be\nfilled in for that missing left-hand side. For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&gt; </span><span style=\"color: #098658\">10</span></span></code> is a partial that represents the condition \"is greater\nthan ten.\" Likewise, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">!= </span><span style=\"color: #A31515\">&#39;CA&#39;</span></span></code> is a partial that represents the condition of not being equal to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;CA&#39;</span></span></code>."
      },
      {
        "type": "p",
        "text": "<em>Alternations</em> are combinations of partials representing\neither the logical union (\"or\") or conjunction (\"and\") of\ntheir conditions. Alternations are represented using the\nunion alternation operator <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">|</span></span></code> and the conjunction\nalternation operator <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">&amp;</span></span></code>."
      },
      {
        "type": "p",
        "text": "For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">= </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | = </span><span style=\"color: #A31515\">&#39;NY&#39;</span></span></code> represents the condition of being equal to 'CA' or <em>alternatively</em> being equal to 'NY'. On the other hand, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">!= </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> &amp; != </span><span style=\"color: #A31515\">&#39;NY&#39;</span></span></code> represents the condition of being not equal to 'CA' <em>as well as</em> being not equal to 'NY'."
      },
      {
        "type": "p",
        "text": "For example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #811F3F\">r&#39;N.*&#39;</span></span></code> represents the condition of being equal to 'CA' or starting with 'N', and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #098658\">10</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">20</span><span style=\"color: #000000\"> | </span><span style=\"color: #098658\">20</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">to</span><span style=\"color: #000000\"> </span><span style=\"color: #098658\">30</span></span></code> represents the condition of being <em>either</em> between 10 and 20 <em>or</em> 20 and 30."
      },
      {
        "type": "p",
        "text": "Alternations and partials may be used in conjunction with the <a href=\"apply.html\">apply operator</a> to test whether a value meets the given condition."
      }
    ],
    "path": "/language/types.md"
  },
  {
    "titles": [
      "Ungrouped Aggregates"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In a query which is grouped by multiple dimensions, it is often useful to be able to perform an aggregate calculation on sub-groups."
      },
      {
        "type": "p",
        "text": "The main difference is that in a nested query, it is legal to name a grouping dimension from an outer query which contains the inner query."
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">()</span></span></code> function will perform the specified aggregate computation, ignoring the grouping in the\ncurrent_query to provide an overall value."
      },
      {
        "type": "p",
        "text": "When the optional grouping dimension argument is provided, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">()</span></span></code> will preserve grouping by the named dimensions (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">faa_region</span></span></code>), but will not group by un-named dimensions (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">state</span></span></code>)."
      },
      {
        "type": "p",
        "text": "Dimensions named in <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">()</span></span></code> must be included in a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span></span></code> in the current query."
      },
      {
        "type": "p",
        "text": "Similar to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">al</span><span style=\"color: #000000\">()</span></span></code>,  <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #795E26\">exclude</span><span style=\"color: #000000\">()</span></span></code> allows you to control which grouping dimensions are\nused to compute <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aggregateExpression</span></span></code>. In this case, dimensions which should NOT be used are listed. For example, these two aggregates will do the exact same thing:"
      }
    ],
    "path": "/language/ungrouped-aggregates.md"
  },
  {
    "titles": [
      "Ungrouped Aggregates",
      "<strong>all(aggregateExpression)</strong>"
    ],
    "paragraphs": [],
    "path": "/language/ungrouped-aggregates.md"
  },
  {
    "titles": [
      "Ungrouped Aggregates",
      "<strong>all(aggregateExpression, groupingDimension, ...)</strong>"
    ],
    "paragraphs": [],
    "path": "/language/ungrouped-aggregates.md"
  },
  {
    "titles": [
      "Ungrouped Aggregates",
      "<strong>exclude(aggregateExpression, groupingDimension)</strong>"
    ],
    "paragraphs": [
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">faa_region</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports_in_state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports_in_region</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(), </span><span style=\"color: #001080\">faa_region</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports_in_state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">faa_region</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">percent_of_total</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() / </span><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">())*</span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">faa_region</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">count_airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">count_in_region_exclude</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">exclude</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(), </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">count_in_region_all</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">all</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(), </span><span style=\"color: #001080\">faa_region</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/language/ungrouped-aggregates.md"
  },
  {
    "titles": [
      "Malloy by Example"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This document will assumes a working knowledge of SQL and will rapidly take you through some of\nMalloy's key language features."
      },
      {
        "type": "p",
        "text": "Malloy is currently available as a VS Code extension and can query BigQuery and Postgres SQL databases."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Projection: SELECT with no GROUP BY"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In SQL"
      },
      {
        "type": "p",
        "text": "Equivalent in Malloy"
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Reduction: SELECT with GROUP BY and/or aggregation"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In SQL"
      },
      {
        "type": "p",
        "text": "Equivalent in Malloy"
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Using this Guide"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "For every Malloy Query you can see the formatted result, or raw result as JSON, or the SQL used to produce the result."
      },
      {
        "type": "p",
        "text": "Click tab to to see the  HTML, JSON or SQL result:  <img src=\"https://user-images.githubusercontent.com/1093458/154121968-6436d94e-94b2-4f16-b982-bf136a3fcf40.png\" style=\"width:142px\"> 👈👈"
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Source: A data source for queries"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Querying against a Source"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Dimensional calculations are no different from columns"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Defining Named Queries inside a Source"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A source can also contain a set of useful queries relating to that source."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Executing Named Queries"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Filtering a Source"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Filtering Measures"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The input to an aggregate computation can be filtered."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Composing with Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "For the next section assume the following source declaration."
      },
      {
        "type": "p",
        "text": "Queries can contain multiple nested queries."
      },
      {
        "type": "p",
        "text": "Queries can be nested to any level of depth."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Refining a Named Query"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "is the same as"
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Refining a Named Query",
      "You can add a measure or dimension"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Refining a Named Query",
      "You can nest another query"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Composing with Queries"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Changing the inner and outer query in the example above reveals very different information."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Joining"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Joining",
      "Carrier table"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Joining",
      "Flights table"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Declare a Join"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Declare a Join",
      "Query the joined tables"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Aggregates can be computed from anywhere in the Join Tree"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "More Complex Joins"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Calculations work properly regardless of where you are in the graph"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Pipelines"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The output of a query can be used as the source for the next query."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Un-nesting in a pipeline flattens the table"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Pipelines can be named as queries in sources"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Pipelines can do pretty complex things.  They can be built into source objects."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Refining Sources"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Sources based on Queries"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Sources based on Queries",
      "Named Query"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Sources based on Queries",
      "Source based on a query"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Sources based on Queries",
      "Querying the Summary source"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Other Interesting Language Features:"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "Other Interesting Language Features:",
      "Group by on Joined Subtrees"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "SQL SELECT vs Malloy's <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span></span></code>"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The statement to run a query in Malloy is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">:</span></span></code>. There are two types of queries in Malloy, reductions which have <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span></code> statements, and projections which have <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span></code> statements and do not group or aggregate results."
      },
      {
        "type": "p",
        "text": "A <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">:</span></span></code> is a declared aggregate calculation (think function that operates across the table) which can be used in <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span></code> elements in a query stage"
      },
      {
        "type": "p",
        "text": "A <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">dimension</span><span style=\"color: #000000\">:</span></span></code> is a declared scalar calculation which that can be used in <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span></code> or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span></code> elements of a query stage"
      },
      {
        "type": "p",
        "text": "Note that the source is implied, so the query operator (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code>) and source are not needed to define the named query."
      },
      {
        "type": "p",
        "text": "The simplest form of a query in Malloy is the name of a source, the query operator <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code>, and the name of one of its contained queries."
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The refinement gesture <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">{}</span></span></code> extends an existing object, creating a new version with added properties"
      },
      {
        "type": "p",
        "text": "For example we can add a limit and an order by to <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">by_state</span></span></code>"
      },
      {
        "type": "p",
        "text": "The most common join pattern is a foreign key join. Malloy uses the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\">:</span></span></code>\nto declare these and generates more efficient SQL when these joins are used."
      },
      {
        "type": "p",
        "text": "In the example below, we use a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\">:</span></span></code> join for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">carriers</span></span></code> and then model the more complex relationship with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span></span></code> originating from each <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airport</span></span></code> using  <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">on</span><span style=\"color: #000000\">:</span></span></code>."
      },
      {
        "type": "p",
        "text": "Many <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span></span></code> have the same\n<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airport</span></span></code> as their origin so we use <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">join_many</span><span style=\"color: #000000\">:</span></span></code>."
      },
      {
        "type": "p",
        "text": "Queries can be chained together (pipelined), the output of one becoming the input of the next one, by simply adding another <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">-&gt;</span></span></code> operator and a new query definition."
      },
      {
        "type": "p",
        "text": "As with a query, a source can be extended with the refinement gesture <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">{}</span></span></code> to create a new version of the source with additional properties."
      },
      {
        "type": "p",
        "text": "<a href=\"https://github.com/malloydata/malloy/\">Install Instructions</a>"
      },
      {
        "type": "p",
        "text": "Malloy separates a query from the source of the data. A source can be thought of as a table and a collection of computations and relationships which are relevant to that table.  (<a href=\"language/source.html\">Source Documentation</a>)."
      },
      {
        "type": "p",
        "text": "<a href=\"language/fields.html\">Fields</a> can be defined as part of a source."
      },
      {
        "type": "p",
        "text": "Queries can be run against <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">:</span></span></code> objects and can utilize the modeled fields from that source, as well as introduce new ones. (<a href=\"language/query.html\">Query Documentation</a>)"
      },
      {
        "type": "p",
        "text": "You can filter a source by adding a filter expression using the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span></code> keyword and then use this refined version of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> to run the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">by_state</span></span></code> query.  (<a href=\"language/filters.html\">Filter Documentation</a>)"
      },
      {
        "type": "p",
        "text": "Malloy allows you to create nested subtables easily in a query.\nIn the case below, the top level query groups by state and nested query groups by facility type.\nThis mechanism is really useful for understanding data and creating complex data structures. (<a href=\"language/nesting.html\">Nesting Documentation</a>)"
      },
      {
        "type": "p",
        "text": "First let's model some simple tables... (<a href=\"language/join.html\">Join Documentation</a>)"
      },
      {
        "type": "p",
        "text": "<em>simple source declaration used in example below</em>"
      },
      {
        "type": "p",
        "text": "<em>simple source declaration used in example below</em>"
      },
      {
        "type": "p",
        "text": "Join carriers to flights.  Each flight has one carrier so we use <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">:</span></span></code>.\n(<a href=\"language/join.html\">Join Documentation</a>)"
      },
      {
        "type": "p",
        "text": "(<a href=\"language/aggregates.html\">Aggregate Documentation</a>)"
      },
      {
        "type": "p",
        "text": "This query is very difficult to express in SQL. Malloy's understanding of source relationships allows it to compute aggregate computations at any node of the join path,unlike SQL which can only do aggregate computation at the. outermost level.\n(<a href=\"language/aggregates.html\">Aggregate Documentation</a>)"
      },
      {
        "type": "p",
        "text": "<em>Assume the following query as a starting point.</em>"
      },
      {
        "type": "p",
        "text": "<em>documentation bug: name should not be commented out</em> (<a href=\"language/source.html\">Source Documentation</a>)"
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another",
      "SQL BLocks (<a href=\"language/sql_block.html\">SQL Block Documentation</a>)"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another",
      "Named Queries from SQL Blocks (<a href=\"language/sql_block.html\">SQL Block Documentation</a>)"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another",
      "Case statement improved with  <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">pick</span></span></code> (<a href=\"language/expressions.html#pick-expressions\">Expression Documentation</a>)"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another",
      "Date/Timestamp filters and Timezones (<a href=\"expressions.html#time-ranges\">Time Documentation</a>)"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another",
      "Nested data and Symmetric aggregates  (<a href=\"language/aggregates.html\">Aggregates Documentation</a>)"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another",
      "Import (<a href=\"language/imports.html\">Import Documentation</a>)"
    ],
    "paragraphs": [],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Malloy by Example",
      "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span></code> property embeds one query in another",
      "Data styles and rendering (<a href=\"visualizations/dashboards.html\">Rendering Documentation</a>)"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span></span></code> source</em>"
      },
      {
        "type": "p",
        "text": "<em>using the above declared <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">airports</span></span></code> source</em>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\">  {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;SEAPLANE BASE&#39;</span><span style=\"color: #000000\">   </span><span style=\"color: #008000\">// &lt;- run the query with an added filter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"><span style=\"color: #000000\">-&gt; </span><span style=\"color: #001080\">by_state</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;HELIPORT&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\">           </span><span style=\"color: #008000\">// &lt;-- declared in source</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_elevation_in_meters</span><span style=\"color: #000000\"> </span><span style=\"color: #008000\">// &lt;-- declared in source</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">by_state</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">heliport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;HELIPORT&#39;</span><span style=\"color: #000000\"> } </span><span style=\"color: #008000\">// &lt;-- add a filter</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">total_distance</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_distance</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_facts</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">flights_by_origin</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_facts</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">flights_by_year</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state_and_county</span><span style=\"color: #000000\"> </span><span style=\"color: #008000\">// &lt;-- declared in source</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">1</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">by_facility_type</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">avg_elevation</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #008000\">/* q_airport_facts is */</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">origin</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">num_flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.carriers&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">-&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: *</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\">-&gt; </span><span style=\"color: #001080\">by_facility_type</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_5_states</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility_type</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">id2</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">tail_num</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">destination</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">dep_delay</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt;  {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">carrier_count</span><span style=\"color: #000000\">  </span><span style=\"color: #008000\">// &lt;-- 3 levels</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">total_distance</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">avg_elevation_in_meters</span><span style=\"color: #000000\">         </span><span style=\"color: #008000\">// &lt;-- symmetric calculation</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">top_5_states</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">carrier_count</span><span style=\"color: #000000\">   </span><span style=\"color: #008000\">// &lt;-- calculation in joined table</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_3_carriers</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">total_distance</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">avg_distance</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">faa_region</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_5_states</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;HELIPORT&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_3_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">faa_region</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_state_and_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">4</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_facility_type</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;HELIPORT&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_3_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">limit</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">3</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"><span style=\"color: #000000\">-&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">top_3_county</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">county</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports_in_state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">airports_in_county</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">top_3_county</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_of_state</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">top_3_county</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">airport_count</span><span style=\"color: #000000\">/</span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.airports&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">code</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">full_name</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">faa_region</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">elevation</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/malloy_by_example.md"
  },
  {
    "titles": [
      "Cohort Analysis"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "To understand this, we're going to use Social Security Administrations birth/name data."
      },
      {
        "type": "p",
        "text": "We can see that in the population of the the people named 'Billie', the cohort of the Billies born in\nTexas makes up 18% of the total population of Billies."
      },
      {
        "type": "p",
        "text": "We could run this same query, but instead look by decade to see when the Billies where born.\nUsing the query below we can see that 26% of all Billies were born in the 1930s."
      }
    ],
    "path": "/patterns/cohorts.md"
  },
  {
    "titles": [
      "Cohort Analysis",
      "Names as Cohorts"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We have a table with <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">name</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">gender</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">`year`</span></span></code>, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">state</span></span></code> and the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">`number`</span></span></code> of people born with those\ncharacteristics."
      },
      {
        "type": "p",
        "text": "One of the most powerful way of understanding what is happening using data is to use <em>cohort analysis</em>.\nFundamentally, cohort analysis is used to group people into sets and to analyze the success,\nattributes or characteristics of that group as compared to the population in general."
      },
      {
        "type": "p",
        "text": "In the simplest form, a cohort calculation is a <a href=\"percent_of_total.html\">percentage of total calculation</a>.\nFor example, if we were interested in the name 'Billie' as it relates to location. We could look\ncould filter on 'Billie' and look a states as it relates to total population."
      },
      {
        "type": "p",
        "text": "In the above example, the population was <em>People named Billie</em> and we used <em>state</em> or <em>year</em> for our cohort (grouping).\nLets flip it around and look at people born with a particular name as a cohort and the other attributes to limit our population.\nLet's limit our population to California in 1990 and look at the most cohorts (people with a given name).  We are also going\nto measure a little differently.  Instead of looking at a percentage, let's look at births per 100,000 people."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;Billie&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">decade</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">floor</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">`year`</span><span style=\"color: #000000\"> / </span><span style=\"color: #098658\">10</span><span style=\"color: #000000\">) * </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">decade</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">total_population</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">decade_as_percent_of_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> * </span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">decade_as_percent_of_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;CA&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`year`</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">1990</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">name</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">total_population</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">births_per_100k</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">FLOOR</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> * </span><span style=\"color: #098658\">100000.0</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">births_per_100k</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;bigquery-public-data.usa_names.usa_1910_2013&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;Billie&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">`number`</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">total_population</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">state_as_percent_of_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">total_population</span><span style=\"color: #000000\"> * </span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">state_as_percent_of_population</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">desc</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/patterns/cohorts.md"
  },
  {
    "titles": [
      "Foreign Sums"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy allows you to compute sums, averages correctly based on your join tree.  This example has flights, joining to aircraft, joining to aircraft_model.\n<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">aircraft_model</span></span></code> has the number of seats specified on this model of aircraft.  Code below computes sums and averages at various places in the join tree."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">// join 3 tables, flights, aircraft and aircraft models.</span></span>\n<span class=\"line\"><span style=\"color: #008000\">// `flights` is individual flights</span></span>\n<span class=\"line\"><span style=\"color: #008000\">// `aircraft` is the plane that made the flight</span></span>\n<span class=\"line\"><span style=\"color: #008000\">// `aircraft_models` is data about the kind of aircraft</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.aircraft_models&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_model_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.aircraft&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft_model_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2003-01</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// number of flights</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// number of planes</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// number of different aircraft_models</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">aircraft_model_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// count each seat once for each flight.</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">seats_for_sale</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// count the seat once for each plane</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">seats_on_all_planes</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">sum</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// average number of seats on each model by model</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">average_seats_per_model</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\">.</span><span style=\"color: #795E26\">avg</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/patterns/foreign_sums.md"
  },
  {
    "titles": [
      "Percent of Total"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In order to compute a percentage of total, you essentially have to run two queries, one for\nthe total and one where you wish to apply the calculation.  In Malloy, you can run these queries at\nat the same time and combine them."
      },
      {
        "type": "p",
        "text": "Let's suppose we wanted to look at our flight data by carrier and compute the percentage of all\nflight performed by a particular carrier."
      }
    ],
    "path": "/patterns/percent_of_total.md"
  },
  {
    "titles": [
      "Percent of Total",
      "Query for all flights ever made"
    ],
    "paragraphs": [],
    "path": "/patterns/percent_of_total.md"
  },
  {
    "titles": [
      "Percent of Total",
      "Query for Flights By Carrier"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We can use a wildcard against the nested query to to make this pattern easier to write."
      },
      {
        "type": "p",
        "text": "The results are returned as a single row in a table with two columns, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flight_count</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">main_query</span></span></code>."
      },
      {
        "type": "p",
        "text": "Using a pipeline with a <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">project</span></span></code> calculation to combine (essentially cross joining) the queries back into a single table.\nWe also add an additional column, the percentage of total calculation."
      }
    ],
    "path": "/patterns/percent_of_total.md"
  },
  {
    "titles": [
      "Percent of Total",
      "Use <em>project</em> to flatten the table and cross join"
    ],
    "paragraphs": [],
    "path": "/patterns/percent_of_total.md"
  },
  {
    "titles": [
      "Percent of Total",
      "Using a <em>wildcard</em> against the Nested Query"
    ],
    "paragraphs": [],
    "path": "/patterns/percent_of_total.md"
  },
  {
    "titles": [
      "Percent of Total",
      "In Malloy, can make both calculations at once with <a href=\"nesting.html\"><em>nested subtables</em></a>."
    ],
    "paragraphs": [
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count_as_a_percent_of_total</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> * </span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.*</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_count_as_a_percent_of_total</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> / </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> * </span><span style=\"color: #098658\">100.0</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/patterns/percent_of_total.md"
  },
  {
    "titles": [
      "Pivot Limits"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Or really, limiting results based on secondary queries."
      },
      {
        "type": "p",
        "text": "Let's suppose we wanted to look flight data but only at only the top 5 carriers and only the top 5 destinations."
      }
    ],
    "path": "/patterns/pivot_limits.md"
  },
  {
    "titles": [
      "Pivot Limits",
      "Carriers by destination produces 1958 rows"
    ],
    "paragraphs": [],
    "path": "/patterns/pivot_limits.md"
  },
  {
    "titles": [
      "Pivot Limits",
      "Query for the top 5 carriers"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Query to find the most interesting carriers."
      }
    ],
    "path": "/patterns/pivot_limits.md"
  },
  {
    "titles": [
      "Pivot Limits",
      "Top 5 Destinations"
    ],
    "paragraphs": [],
    "path": "/patterns/pivot_limits.md"
  },
  {
    "titles": [
      "Pivot Limits",
      "Run all three queries together as Aggregating Subqueries."
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Produces a table with a single row and three columns.  Each column essentially contains a table"
      },
      {
        "type": "p",
        "text": "Project produces a cross join of the tables.  The filter essentially does an inner join, limiting the main queries results to\ndimensional values that are produce in the filtering queries."
      }
    ],
    "path": "/patterns/pivot_limits.md"
  },
  {
    "titles": [
      "Pivot Limits",
      "Render the results as a pivot table"
    ],
    "paragraphs": [],
    "path": "/patterns/pivot_limits.md"
  },
  {
    "titles": [
      "Pivot Limits",
      "Project the main query and use the <em>top</em> nested queries to limit the results"
    ],
    "paragraphs": [
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_carriers</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_destinations</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">:</span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span><span style=\"color: #000000\"> = </span><span style=\"color: #001080\">top_carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">destination_code</span><span style=\"color: #000000\"> = </span><span style=\"color: #001080\">top_destinations</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination_pivot</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_carriers</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_destinations</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">:</span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span><span style=\"color: #000000\"> = </span><span style=\"color: #001080\">top_carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">destination_code</span><span style=\"color: #000000\"> = </span><span style=\"color: #001080\">top_destinations</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">project</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\">.*</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">main_query</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_carriers</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">nickname</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">top_destinations</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">5</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/patterns/pivot_limits.md"
  },
  {
    "titles": [
      "Sessionized Data"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Flight data contains time, carrier, origin, destination and the plane that made the flight (<code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">tail_num</span></span></code>).  Take the\nflight data and sessionize it by carrier and date.  Compute statistics and the session, plane and flight level.\nRetain the original flight events."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;WN&#39;</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">and</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> ? </span><span style=\"color: #098658\">@2002-03-03</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flight_date</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">day</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">daily_flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">per_plane_data</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">20</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">plane_flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_legs</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">order_by</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">2</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">tail_num</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">dep_minute</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">minute</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">origin</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">destination</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">dep_delay</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        </span><span style=\"color: #001080\">arr_delay</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/patterns/sessionize.md"
  },
  {
    "titles": [
      "Year Over Year Analysis"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "There are a couple of different ways to go about this in Malloy."
      }
    ],
    "path": "/patterns/yoy.md"
  },
  {
    "titles": [
      "Year Over Year Analysis",
      "Method 1: Pivoting a Visualization"
    ],
    "paragraphs": [],
    "path": "/patterns/yoy.md"
  },
  {
    "titles": [
      "Year Over Year Analysis",
      "Method 2: Filtered Aggregates"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Filters make it easy to reuse aggregate calculations for trends analysis."
      }
    ],
    "path": "/patterns/yoy.md"
  },
  {
    "titles": [
      "Year Over Year Analysis",
      "Method 2: Filtered Aggregates",
      "Using Relative Timeframes"
    ],
    "paragraphs": [],
    "path": "/patterns/yoy.md"
  },
  {
    "titles": [
      "Year Over Year Analysis",
      "Method 2: Filtered Aggregates",
      "Declaring and reusing common expressions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We can rewrite the query so it is more reusable.  The declarations after the source are temporary additions to this order_items table for the sake of just this query."
      },
      {
        "type": "p",
        "text": "Compare performance of different years on the same scale.  Line charts take the X-Axis, Y-Axis and Dimensional Axis as parameters.\nIn this Case, the X-Axis is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">month_of_year</span></span></code>, the Y-Axis is <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flight_count</span></span></code> and the Dimensional Axis is the year."
      },
      {
        "type": "p",
        "text": "Often you want to show up-to-date information.  You can write timeframes relatively so the queries always show\ncurrent data.  Read more about it in the <a href=\"filter_expressions.html\">filters</a> section."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">year_over_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">month_of_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">month</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">inventory_items</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.ecomm.inventory_items&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">id</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.ecomm.order_items&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">inventory_items</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">inventory_item_id</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">inventory_items</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">product_category</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">last_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">1</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">prior_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">years</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_change</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">round</span><span style=\"color: #000000\">(</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      (</span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">1</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> } - </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">years</span><span style=\"color: #000000\"> })</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        / </span><span style=\"color: #795E26\">nullif</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\">  ? </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">years</span><span style=\"color: #000000\"> }, </span><span style=\"color: #098658\">0</span><span style=\"color: #000000\">) * </span><span style=\"color: #098658\">100</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #098658\">1</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    )</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">// common calculation for flights</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">-&gt;{</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flights_in_2002</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2002</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">flights_in_2003</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2003</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_change</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">round</span><span style=\"color: #000000\">(</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      (</span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2003</span><span style=\"color: #000000\"> } - </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2002</span><span style=\"color: #000000\"> })</span></span>\n<span class=\"line\"><span style=\"color: #000000\">        / </span><span style=\"color: #795E26\">nullif</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2003</span><span style=\"color: #000000\"> }, </span><span style=\"color: #098658\">0</span><span style=\"color: #000000\">) * </span><span style=\"color: #098658\">100</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #098658\">1</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    )</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">-- common calculation for order_items</span></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">inventory_items</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.ecomm.inventory_items&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">primary_key</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">id</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">source</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.ecomm.order_items&#39;</span><span style=\"color: #000000\">) {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">join_one</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">inventory_items</span><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">with</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">inventory_item_id</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span>\n<span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">order_items</span><span style=\"color: #000000\">{</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">measure</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #008000\">// these caclulations can be used in multipe parts of the query</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">last_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">1</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">prior_year</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">order_item_count</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">created_at</span><span style=\"color: #000000\"> ? </span><span style=\"color: #001080\">now</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">year</span><span style=\"color: #000000\"> - </span><span style=\"color: #098658\">2</span><span style=\"color: #000000\"> </span><span style=\"color: #0000FF\">years</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">} -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">inventory_items</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">product_category</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">last_year</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">prior_year</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">percent_change</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">round</span><span style=\"color: #000000\">(</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      (</span><span style=\"color: #001080\">last_year</span><span style=\"color: #000000\"> - </span><span style=\"color: #001080\">prior_year</span><span style=\"color: #000000\">) / </span><span style=\"color: #795E26\">nullif</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">last_year</span><span style=\"color: #000000\">, </span><span style=\"color: #098658\">0</span><span style=\"color: #000000\">) * </span><span style=\"color: #098658\">100</span><span style=\"color: #000000\">,</span></span>\n<span class=\"line\"><span style=\"color: #000000\">      </span><span style=\"color: #098658\">1</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    )</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/patterns/yoy.md"
  },
  {
    "titles": [
      "Sample Models"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Code snippets will appear throughout the Malloy documentation, many of which rely on a number of sample models based on publicly available datasets."
      }
    ],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "FAA"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This set of models points at a publicly available FAA flights dataset including information on flights, airports, aircrafts and aircraft models from 2000 to 2005. A wide variety of patterns and features are used in this model and any of our examples in documentation are based on this dataset, so it's a great place to start as you get to know Malloy."
      }
    ],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "Iowa Liquor"
    ],
    "paragraphs": [],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "Ecommerce"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This model points to a dataset for a fictitious ecommerce business. It has a  clean and typical schema for a transactional dataset. It also includes an example of an interesting brand affinity analysis (people who buy x also buy y)."
      }
    ],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "GA Sessions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy is ideally suited to working with nested data, and this is the place to see why. See how easily data at any level of nesting can be accessed and aggregated without needlessly complex queries or use of CTEs."
      }
    ],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "Hacker News"
    ],
    "paragraphs": [],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "Names"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "A look at baby names in the United States by gender, state, and year, since 1910. Includes an example of cohorting names by aggregating safely across different levels of nesting."
      }
    ],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "The Met"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Looks at a catalog of over 200,000 public domain items from The Met (The Metropolitan Museum of Art). The catalog includes metadata about each piece of art, along with an image or images of the artifact."
      }
    ],
    "path": "/samples.md"
  },
  {
    "titles": [
      "Sample Models",
      "Wordlebot"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Liquor sales in Iowa are state-controlled, with all liquor wholesale run by the state. All purchases and sales of liquor that stores make are a matter of public record. A walkthrough of exploring and modeling this dataset can be found <a href=\"examples/iowa/iowa.html\">here</a>; this makes a great introduction to Malloy."
      },
      {
        "type": "p",
        "text": "This is just a fun dataset. Includes examples of using regular expressions to parse data, <a href=\"language/expressions#pick-expressions\">pick</a> (Malloy's improvement upon CASE statements), and <a href=\"language/imports.html\">imports</a> to spin off a specific analysis of posts about FAANG companies."
      },
      {
        "type": "p",
        "text": "Let Wordlebot solve Wordle for you (or if you're like us, see if it can beat you after you've played!). This is an example of an advanced analysis to solve a tricky problem. We have a walkthrough and examples of how we used the model to solve Wordle puzzles available <a href=\"examples/wordle/wordle.html\">here</a>."
      }
    ],
    "path": "/samples.md"
  },
  {
    "titles": [
      "The Tao of Malloy"
    ],
    "paragraphs": [],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "Malloy …"
    ],
    "paragraphs": [],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… feels familiar to someone coming from SQL"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Our primary users will all be familiar with SQL. We should make their life no harder than it needs to be. That said, Malloy is actually describing a different type of operation than SQL does, and so in some places we are deliberately different from SQL because we want people to be unfamiliar, to learn how Malloy works."
      },
      {
        "type": "p",
        "text": "The intention was always that there is some context, command line or editor, which handles a single document with mixed Malloy and SQL, either because they are one merged language, or there is some JSX-like escaping between the contexts."
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… feels concise, but not cryptic"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This is the most common point of disagreement as we talk about how to express things. There is no one right answer to this. We have a preference for brevity, every single feature we wrestle with trying to get the most clarity from the least language surface."
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… is composable"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "If you find a piece of code that works, you should be able to select it, paste it somewhere with a name, and use it by name."
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… is an algebra for computations with relational data"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy comprehends data as a network of relationships and so computations like aggregation have a useful and mathematical meaning. Malloy gestures should read like a mathematical formula which means one clear thing."
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… is NOT an attempt to make the language look like English sentences"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Maybe AppleScript or COBOL would be at the extreme end of this. More of a kind of math, less like a natural language."
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… is curated"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "There are not four different ways to express things depending on which programming language or style you came from. There is one, and it is carefully chosen to match the task of data transformation, discovery and presentation."
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… is helpful"
    ],
    "paragraphs": [],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… is still an experiment"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "We had some theoretical insights that there was a better way to interact with data than SQL, and Malloy is the current snapshot of that thinking, but we are not done. We have a number of features which are not yet in the language, which we expect to have an impact on the language, and maybe even on these rules. The language is still young and needs room to grow."
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "The Tao of Malloy",
      "… is an expression of empathy towards explorers and explainers of data"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The Malloy user is not someone who writes one sentence in Malloy, and then never sees the language again. Malloy is an invitation into a \"way\" for people who are passionate about decision making based on data, and good decision making is iterative, and ongoing."
      },
      {
        "type": "p",
        "text": "For example <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">name</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">expression</span></span></code>, vs <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">expression</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">as</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">name</span></span></code>. In SQL the naming on an expression sits as a casual afterthought \"oh by the way, give this really important expression a name\". In Malloy, the name of a thing is important, you are building complex things from smaller pieces. When you look at a model, you will often want to scan the file looking for names, they belong on the left hand side."
      },
      {
        "type": "p",
        "text": "However, we in general try to have the \"feel\" of SQL. We use <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">()</span></span></code> for structuring instead of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">{}</span></span></code> like LookML or JavaScript do, or indentation like Python does. We use <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">is</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">define</span></span></code> instead of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">:</span></span></code> like LookML or <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">=</span></span></code> like JavaScript. We use SQL words for things (like <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">join</span></span></code>) where it makes sense."
      },
      {
        "type": "p",
        "text": "Malloy tries to \"do the right thing\" that most people want, by default, while still allowing non default expressions to be written. The treatment of <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #0000FF\">null</span></span></code> and booleans, and the sorting rules for \"reduce\" stages would be two examples of this."
      },
      {
        "type": "p",
        "text": "<em>Tao is the natural order of the universe whose character one's human intuition must discern in order to realize the potential for individual wisdom. This intuitive knowing of \"life\" cannot be grasped as a concept; it is known through actual living experience of one's everyday being.</em> — <a href=\"https://en.wikipedia.org/wiki/Tao\">Wikipedia \"Tao\"</a>"
      }
    ],
    "path": "/tao.md"
  },
  {
    "titles": [
      "Bar Charts"
    ],
    "paragraphs": [],
    "path": "/visualizations/bar_charts.md"
  },
  {
    "titles": [
      "Bar Charts",
      "Two Measures"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "This chart looks at flights and counts the number of aircraft owned by each carrier.  It also, using a gradient,\nshows the number of flights made per plane."
      },
      {
        "type": "p",
        "text": "Data Style"
      }
    ],
    "path": "/visualizations/bar_charts.md"
  },
  {
    "titles": [
      "Bar Charts",
      "Two Dimensions"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "In this case we are going to look at carriers by flight count and stack the destination.  We are only going to look at flights\nwith the destination SFO, OAK or SJC."
      },
      {
        "type": "p",
        "text": "Data Style"
      },
      {
        "type": "p",
        "text": "We could flip the dimensions around and look at the airports' flights by carrier."
      },
      {
        "type": "p",
        "text": "There are two types of bar charts.  <em>Two measure bar charts</em> (gradient bar charts) and <em>Two Dimension Bar</em> Charts (stacked bar charts)."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;SFO&#39;</span><span style=\"color: #000000\">| </span><span style=\"color: #A31515\">&#39;OAK&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;SJC&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_carrier</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;SFO&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;OAK&#39;</span><span style=\"color: #000000\"> | </span><span style=\"color: #A31515\">&#39;SJC&#39;</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">top</span><span style=\"color: #000000\">: </span><span style=\"color: #098658\">10</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_carrier</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">destination</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_carrier</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">aircraft_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">tail_num</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights_per_aircraft</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">() / </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">tail_num</span><span style=\"color: #000000\">)</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/visualizations/bar_charts.md"
  },
  {
    "titles": [
      "Line Charts"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Line charts take two or three parameters."
      },
      {
        "type": "p",
        "text": "First parameter -  X-axis is time field or numeric expression"
      },
      {
        "type": "p",
        "text": "Second parameter - Y-axis is a numeric expression"
      },
      {
        "type": "p",
        "text": "Third (optional) Pivot is dimensional field (numeric or string)"
      },
      {
        "type": "p",
        "text": "Data Style is <code>'line_chart'</code>"
      },
      {
        "type": "p",
        "text": "Style"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">departures_by_month</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">departure_month</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">month</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #795E26\">table</span><span style=\"color: #000000\">(</span><span style=\"color: #A31515\">&#39;malloy-data.faa.flights&#39;</span><span style=\"color: #000000\">) -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carriers_by_month</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">departure_month</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\">.</span><span style=\"color: #0000FF\">month</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">()</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/visualizations/charts_line_chart.md"
  },
  {
    "titles": [
      "Rendering Results"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Malloy simply returns the data when running a query.  In the VS Code extension, this is rendered as an HTML table, JSON, or can show the generated SQL by  toggling in the top right of the Query Results window."
      },
      {
        "type": "p",
        "text": "To set up a styles file for a Malloy model:"
      },
      {
        "type": "p",
        "text": "Specify styles"
      },
      {
        "type": "p",
        "text": "While the above approach is preferred, the extension additionally allows the renderer to utilize naming conventions as a shortcut for visualization specification. For example:"
      },
      {
        "type": "p",
        "text": "These naming convention shortcuts currently include:"
      },
      {
        "type": "p",
        "text": "Styles apply to standalone queries as well as when nested."
      }
    ],
    "path": "/visualizations/dashboards.md"
  },
  {
    "titles": [
      "Rendering Results",
      "Example Model"
    ],
    "paragraphs": [],
    "path": "/visualizations/dashboards.md"
  },
  {
    "titles": [
      "Rendering Results",
      "Shows results as a Dashboard"
    ],
    "paragraphs": [],
    "path": "/visualizations/dashboards.md"
  },
  {
    "titles": [
      "Rendering Results",
      "Example"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Data Style:"
      }
    ],
    "path": "/visualizations/dashboards.md"
  },
  {
    "titles": [
      "Rendering Results",
      "Additional Charting with Vega Lite"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Create a new file with the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">.</span><span style=\"color: #001080\">styles</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">json</span></span></code> suffix (for example, <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">styles</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">json</span></span></code>)."
      },
      {
        "type": "p",
        "text": "Reference your styles document in your <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #000000\">.</span><span style=\"color: #001080\">malloy</span></span></code> file, by adding <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #008000\">--! styles ecommerce.styles.json</span></span></code> to the first line."
      },
      {
        "type": "p",
        "text": "Will render as a Bar Chart because of the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">bar_chart</span></span></code> suffix."
      },
      {
        "type": "p",
        "text": "Dashboard: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">_dashboard</span></span></code>"
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">dashboard</span></span></code> style can be invoked either through the styles file or the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">_dashboard</span></span></code> suffix."
      },
      {
        "type": "p",
        "text": "Add styles for <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">by_fac_type</span></span></code> and <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">by_county</span></span></code>"
      },
      {
        "type": "p",
        "text": "The extension additionally includes the <a href=\"https://vega.github.io/vega-lite/\">Vega-Lite</a> rendering library for charting, allowing visualization of results. This rendering library is a separate layer from Malloy's data access layer. The preferred approach to specify visualization in the extension is to use a styles file."
      },
      {
        "type": "p",
        "text": "We recommend looking at the individual visualization documents in this section as well as the <a href=\"{{ '/documentation/samples.html' | relative_url }}\">sample models</a> for examples of how this looks in action."
      },
      {
        "type": "p",
        "text": "<a href=\"{{ '/documentation/visualizations/bar_charts.html' | relative_url }}\">Bar Chart</a>: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">_bar_chart</span></span></code>"
      },
      {
        "type": "p",
        "text": "<a href=\"{{ '/documentation/visualizations/charts_line_chart.html' | relative_url }}\">Line Chart</a>: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">_line_chart</span></span></code>"
      },
      {
        "type": "p",
        "text": "<a href=\"{{ '/documentation/visualizations/scatter_charts.html' | relative_url }}\">Scatter Chart</a>: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">_scatter_chart</span></span></code>"
      },
      {
        "type": "p",
        "text": "<a href=\"{{ '/documentation/visualizations/shape_maps.html' | relative_url }}\">Shape Map</a>: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">_shape_map</span></span></code>"
      },
      {
        "type": "p",
        "text": "<a href=\"{{ '/documentation/visualizations/segment_maps.html' | relative_url }}\">Segment Map</a>: <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">_segment_map</span></span></code>"
      },
      {
        "type": "p",
        "text": "The <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">vega</span></span></code> renderer allows much more customization of rendering than the default visualization options provided in the Extension, using the <a href=\"https://vega.github.io/vega-lite/\">Vega-Lite</a> library. For examples of using these in Malloy, check out the <code class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #001080\">flights_custom_vis</span></span></code> model and styles files in the FAA <a href=\"{{ '/documentation/samples.html' | relative_url }}\">Sample Models</a> download."
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county_dashboard</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">by_state_and_county</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">county_dashboard</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; </span><span style=\"color: #001080\">by_state_and_county</span></span></pre>"
      }
    ],
    "path": "/visualizations/dashboards.md"
  },
  {
    "titles": [
      "Scatter Charts"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Scatter charts compare two numeric values. The data styles for the subsequent examples is:"
      }
    ],
    "path": "/visualizations/scatter_charts.md"
  },
  {
    "titles": [
      "Scatter Charts",
      "Run as a nested subtable"
    ],
    "paragraphs": [],
    "path": "/visualizations/scatter_charts.md"
  },
  {
    "titles": [
      "Scatter Charts",
      "Run as a trellis"
    ],
    "paragraphs": [
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin_code</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">seats_by_distance_scatter_chart</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">distance</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">route_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">concat</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">origin_code</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">destination_code</span><span style=\"color: #000000\">))</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">seats_by_distance_scatter_chart</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">seats</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">aircraft</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">aircraft_models</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">seats</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">distance</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">distance</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">route_count</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">count</span><span style=\"color: #000000\">(</span><span style=\"color: #795E26\">distinct</span><span style=\"color: #000000\"> </span><span style=\"color: #795E26\">concat</span><span style=\"color: #000000\">(</span><span style=\"color: #001080\">origin_code</span><span style=\"color: #000000\">, </span><span style=\"color: #001080\">destination_code</span><span style=\"color: #000000\">))</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/visualizations/scatter_charts.md"
  },
  {
    "titles": [
      "Segment Maps"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The plugin currently supports US maps. Segment maps take as input 4 columns: start latitude , start longitude, end latitude, and  end longitude of the segment.  The model and data styles for the subsequent examples are:"
      },
      {
        "type": "p",
        "text": "and data styles are"
      }
    ],
    "path": "/visualizations/segment_maps.md"
  },
  {
    "titles": [
      "Segment Maps",
      "Run as a simple query"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "Departing from Chicago"
      }
    ],
    "path": "/visualizations/segment_maps.md"
  },
  {
    "titles": [
      "Segment Maps",
      "Run as a trellis"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "By calling the configured map as a nested query, a trellis is formed."
      }
    ],
    "path": "/visualizations/segment_maps.md"
  },
  {
    "titles": [
      "Segment Maps",
      "Run as a trellis, repeated with different filters"
    ],
    "paragraphs": [
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2003-02 an</span><span style=\"color: #000000\">d </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;ORD&#39;</span><span style=\"color: #000000\"> } -&gt; </span><span style=\"color: #001080\">routes_map</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">ord_segment_map</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">routes_map</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;ORD&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">sfo_segment_map</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">routes_map</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;SFO&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">jfk_segment_map</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">routes_map</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> ? </span><span style=\"color: #A31515\">&#39;JFK&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span>\n<span class=\"line\"></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flights</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">dep_time</span><span style=\"color: #000000\"> = </span><span style=\"color: #098658\">@2003-02 an</span><span style=\"color: #000000\">d </span><span style=\"color: #001080\">origin</span><span style=\"color: #000000\">.</span><span style=\"color: #001080\">code</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;ORD&#39;</span><span style=\"color: #000000\"> } -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">carrier</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">flight_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span><span style=\"color: #001080\">routes_map</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/visualizations/segment_maps.md"
  },
  {
    "titles": [
      "Shape Maps"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "The plugin currently supports US maps and state names. The model and data styles for the subsequent examples are:"
      },
      {
        "type": "p",
        "text": "Data Styles"
      }
    ],
    "path": "/visualizations/shape_maps.md"
  },
  {
    "titles": [
      "Shape Maps",
      "Run as a simple query"
    ],
    "paragraphs": [],
    "path": "/visualizations/shape_maps.md"
  },
  {
    "titles": [
      "Shape Maps",
      "Run as a trellis"
    ],
    "paragraphs": [
      {
        "type": "p",
        "text": "By calling the configured map as a nested subtable, a trellis is formed."
      }
    ],
    "path": "/visualizations/shape_maps.md"
  },
  {
    "titles": [
      "Shape Maps",
      "Run as a trellis, repeated with different filters"
    ],
    "paragraphs": [
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; { </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_state</span><span style=\"color: #000000\"> }</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">faa_region</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">by_state</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      },
      {
        "type": "code",
        "text": "<pre class=\"language-malloy\" style=\"background-color: #FBFBFB\"><span class=\"line\"><span style=\"color: #AF00DB\">query</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airports</span><span style=\"color: #000000\"> -&gt; {</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">group_by</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">faa_region</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">aggregate</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">airport_count</span></span>\n<span class=\"line\"><span style=\"color: #000000\">  </span><span style=\"color: #AF00DB\">nest</span><span style=\"color: #000000\">:</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">heliports</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">by_state</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;HELIPORT&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">    </span><span style=\"color: #001080\">seaplane_bases</span><span style=\"color: #000000\"> </span><span style=\"color: #AF00DB\">is</span><span style=\"color: #000000\"> </span><span style=\"color: #001080\">by_state</span><span style=\"color: #000000\"> { </span><span style=\"color: #AF00DB\">where</span><span style=\"color: #000000\">: </span><span style=\"color: #001080\">fac_type</span><span style=\"color: #000000\"> = </span><span style=\"color: #A31515\">&#39;SEAPLANE BASE&#39;</span><span style=\"color: #000000\"> }</span></span>\n<span class=\"line\"><span style=\"color: #000000\">}</span></span></pre>"
      }
    ],
    "path": "/visualizations/shape_maps.md"
  }
]