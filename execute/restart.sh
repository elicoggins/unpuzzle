#!/bin/bash

# Kill any running Next.js dev server and restart it
echo "Stopping existing dev server..."
pkill -f "next dev" 2>/dev/null
# Also kill any process still holding port 3000 (child processes survive pkill)
lsof -ti:3000 | xargs kill -9 2>/dev/null
sleep 0.5

echo "Starting dev server..."
cd "$(dirname "$0")/.."
pnpm dev --webpack > /dev/null 2>&1 &
echo "Dev server started (PID: $!)"
echo "  http://localhost:3000"
