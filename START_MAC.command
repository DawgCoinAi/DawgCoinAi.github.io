#!/bin/sh
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  python3 start.py "$@"
elif command -v node >/dev/null 2>&1; then
  node start.mjs "$@"
else
  echo 'Install Python 3.9+ or Node.js 18+ first. No additional packages needed.'
fi
printf '\nPress Enter to close this window. '
read -r ignored
