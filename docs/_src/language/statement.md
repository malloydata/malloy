# Model

# define

When building a complex transformation from smaller pieces, there is
a way to create a name for a query.

* `define` _query_ _name_ `is` `(` _query_ `);`

# export

When building a model, it is sometimes usefult to have "internal"
queries which are not useful to a user of the model. Malloy
copies the notion of "modules" and "export" from other
programming languages, requiring an explicit declaration
for symbols which would be visibel outside of a model.


* `export` `define` _query_ _name_ `is` `(` _query_ `);`
