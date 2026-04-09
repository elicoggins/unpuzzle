#!/usr/bin/env bash
# Removes iCloud Drive conflict copies created during builds.
# Matches patterns like: "out 2/", "out 3/", ".next2/", ".next 2/"

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Scanning $ROOT for iCloud conflict copies..."

# Find directories matching: name ending in a space+digit(s) or just digit(s) suffix
find "$ROOT" -maxdepth 1 -type d \( \
  -regex '.* [0-9]+$' \
  -o -regex '.*[^/][0-9]+$' \
\) ! -name "$(basename "$ROOT")" | while read -r dir; do
  echo "Removing: $dir"
  rm -rf "$dir"
done

echo "Done."
