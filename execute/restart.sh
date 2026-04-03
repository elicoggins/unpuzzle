#!/bin/bash

# Kill any running Next.js dev server and restart it
echo "Stopping existing dev server..."
pkill -f "next dev" 2>/dev/null
sleep 1

echo "Starting dev server..."
cd "$(dirname "$0")/.."
pnpm dev > /dev/null 2>&1 &
echo "Dev server started (PID: $!)"
echo "  http://localhost:3000"
