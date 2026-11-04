#!/usr/bin/env bash
# Run only in the disposable idv-login clone created by the workflow.
set -euo pipefail
target=$1
html=$(cd "$(dirname "$2")" && pwd)/$(basename "$2")
git -C "$target" config user.name 'github-actions[bot]'
git -C "$target" config user.email '41898282+github-actions[bot]@users.noreply.github.com'

for attempt in 1 2 3; do
  git -C "$target" fetch origin \
    +refs/heads/main:refs/remotes/origin/main \
    +refs/heads/cloud-config-staging:refs/remotes/origin/cloud-config-staging
  git -C "$target" checkout --detach --force origin/cloud-config-staging
  # Preserve pending candidate changes. A conflict requires manual resolution.
  git -C "$target" merge --no-edit origin/main
  python3 - "$target/assets/cloudRes.json" "$html" <<'PY'
from pathlib import Path
import base64
import json
import sys
import time

path = Path(sys.argv[1])
cloud = json.loads(path.read_text(encoding='utf-8'))
page = base64.b64encode(Path(sys.argv[2]).read_bytes()).decode('ascii')
if cloud.get('login_base64_page_fever') != page:
    cloud['login_base64_page_fever'] = page
    cloud['lastModified'] = max(int(time.time()), int(cloud.get('lastModified', 0)) + 1)
    cloud.pop('_signature', None)  # The changed candidate must be reviewed and signed again.
    path.write_text(json.dumps(cloud, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
PY
  if ! git -C "$target" diff --quiet -- assets/cloudRes.json; then
    git -C "$target" add assets/cloudRes.json
    git -C "$target" commit -m "chore: stage Fever Vue UI (${GITHUB_SHA:0:7})"
  fi
  # Non-force push rejects concurrent writers; re-fetch and reapply if needed.
  if git -C "$target" push origin HEAD:refs/heads/cloud-config-staging; then
    exit 0
  fi
  echo "Candidate push failed (attempt $attempt); fetching and retrying." >&2
done
exit 1
