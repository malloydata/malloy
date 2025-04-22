#! /bin/bash

# Check required environment variables
if [ -z "$SERVER_NAME" ] || [ -z "$USERNAME" ] || [ -z "$PASSWORD" ] || [ -z "$DATABASE_NAME" ]; then
    echo "Error: SERVER_NAME, USERNAME, PASSWORD, and DATABASE_NAME environment variables must be set."
    exit 1
fi

for file in "$(dirname "$0")/"*.tsv; do
    base=$(basename "$file" .tsv)

    schema="${base%%.*}"
    table="${base#*.}"

    echo "Importing $file into ${schema}.${table} in database $DATABASE_NAME on server $SERVER_NAME..."

    bcp "[${DATABASE_NAME}].[${schema}].[char_${table}]" in "$file" \
        -S "$SERVER_NAME" \
        -U "$USERNAME" \
        -P "$PASSWORD" \
        -c -t "\t"

    sqlcmd -S "$SERVER_NAME" -d "$DATABASE_NAME" -U "$USERNAME" -P "$PASSWORD" -Q "INSERT INTO [${DATABASE_NAME}].[${schema}].[${table}] SELECT * FROM [${DATABASE_NAME}].[${schema}].[char_${table}];"

    if [ $? -eq 0 ]; then
        echo "Successfully imported $file into ${schema}.${table} ."
    else
        echo "Failed to import $file into ${schema}.${table} ."
        exit 1
    fi

done
