#!/bin/bash

pid=$(pgrep -f "next dev" 2>/dev/null)

if [ -n "$pid" ]; then
  kill $pid 2>/dev/null
  echo "Dev server stopped (PID: $pid)"
else
  echo "Dev server is not running."
fi
