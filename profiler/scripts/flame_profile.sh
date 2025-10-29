#!/bin/bash

# Run Node.js with CPU profiling
node --cpu-prof dist/profile.js

# Find the generated .cpuprofile file
PROFILE_FILE=$(ls -t *.cpuprofile 2>/dev/null | head -1)

if [ -n "$PROFILE_FILE" ]; then
  echo ""
  echo "✅ Profile created: $PROFILE_FILE"
  echo ""
  echo "📊 To view flame graph:"
  echo "1. Open Chrome and navigate to: chrome://inspect"
  echo "2. Click \"Open dedicated DevTools for Node\""
  echo "3. Go to the Performance tab"
  echo "4. Click \"Load profile\" and select: $PROFILE_FILE"
  echo ""
else
  echo "❌ No .cpuprofile file was generated"
  exit 1
fi
