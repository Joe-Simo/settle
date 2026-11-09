#!/usr/bin/env bash
# Fails if forbidden characters or personal emails appear in tracked or staged files.
set -euo pipefail
files=$(git ls-files -co --exclude-standard | grep -v -E '^(pnpm-lock.yaml|scripts/check-text.sh)$' || true)
bad=0
if grep -n -P '[\x{2013}\x{2014}]' $files; then echo "Found en/em dash characters"; bad=1; fi
if grep -n -i -E 'josephsimo@|icloud\.com|@JoeSimo' $files; then echo "Found a forbidden email or handle"; bad=1; fi
exit $bad
