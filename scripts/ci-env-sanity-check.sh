#!/bin/bash

if [ ! -f ".node-version" ]; then
    echo "Error: .node-version file is missing" >&2
    exit 1
fi

if [ ! -s ".node-version" ]; then
    echo "Error: .node-version file is empty" >&2
    exit 1
fi

npm run check-tracking-types

echo "Sanity check passed: runtime and tracking type versions are aligned."
