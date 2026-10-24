#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 start.py "$@"
elif command -v node >/dev/null 2>&1; then
  exec node start.mjs "$@"
else
  echo 'Install Python 3.9+ or Node.js 18+ first. No additional packages needed.'
  exit 1
fi
