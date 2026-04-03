#!/bin/bash

pid=$(pgrep -f "next dev" 2>/dev/null)

if [ -n "$pid" ]; then
  echo "App is running (PID: $pid)"
  echo "  Local:   http://localhost:3000"
  echo "  Network: http://$(ipconfig getifaddr en0 2>/dev/null || echo 'unknown'):3000"
else
  echo "App is not running. Use ./restart.sh to start it."
fi
