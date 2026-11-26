#!/bin/sh
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT"
if [ ! -f .env ]; then python3 scripts/setup-local.py; fi
./mvnw -B verify
scripts/compose.sh up -d --build --wait --wait-timeout 300
python3 scripts/smoke-test.py
