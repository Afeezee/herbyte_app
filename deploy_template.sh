#!/usr/bin/env bash
# Deploy Herbyte to Vercel. Assumes the Vercel CLI is installed and
# authenticated (`vercel login`), and the project is linked (`vercel
# link`).
#
# Usage:
#   ./deploy_template.sh                # preview deploy
#   ./deploy_template.sh --prod         # production deploy

set -euo pipefail

echo "==> Type-checking"
npx tsc --noEmit

echo "==> Linting"
npm run lint

echo "==> Building the SPA"
npm run build

if [[ "${1:-}" == "--prod" ]]; then
  echo "==> Deploying to production"
  vercel deploy --prod --yes
else
  echo "==> Deploying preview"
  vercel deploy --yes
fi

echo "Done."
