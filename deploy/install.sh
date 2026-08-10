#!/usr/bin/env bash
# Bootstrap the bare-metal PM2 lane from an already-cloned repository.

set -Eeuo pipefail
IFS=$'\n\t'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
exec bash "$SCRIPT_DIR/update.sh" --install "$@"
