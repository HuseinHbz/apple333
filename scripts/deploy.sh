#!/usr/bin/env bash
# Compatibility entry point for legacy operators. The audited bare-metal PM2
# workflow lives in deploy/update.sh; Docker remains deploy/bin/update.sh.
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/../deploy/update.sh" "$@"
