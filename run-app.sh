#!/usr/bin/env zsh
set -euo pipefail

project_dir="${0:A:h}"
cd "$project_dir"

if [[ -x "$project_dir/.tools/node/bin/npm" ]]; then
  export PATH="$project_dir/.tools/node/bin:$PATH"
fi

exec npm start
