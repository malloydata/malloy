# Adding Error Explanations

Errors in the Problems window of the vscode extension can have links to a fuller explanation of the error.

There is a two step process to adding an explanation link to an error.

## Add the explanation to the error dictionary

Edit the file [malloydata.github.io:src/documentation/error_dictionary.malloynb](https://github.com/malloydata/malloydata.github.io/blob/main/src/documentation/error_dictionary.malloynb)

An explanation starting with a `##` markdown header will be turned into a link when the docs are generated. You can guess what the tag will be, all letters are lower case and spaces are replaced with dashes, or you can build the docs and copy the link out of the generated HTML.

The target of that link (the code after the `#` in the generated HTML) is the error tag.

## Add the error tag to a message

In the Malloy error logger, if an error message ends in `[xx]`, the `[xx]` is removed from the message and `xx` is stored with the message as an error tag.

In the vscode extension that error tag is added back to the path to the documentation, as in `https://docs.malloydata.dev/documentation/error_dictionary#xx` to make a link which is appended to error messages in the problems window.
