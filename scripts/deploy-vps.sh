#!/usr/bin/env bash
# Build the gated server bundle locally and ship it to the VPS under pm2.
# The publishable key is public by design and pulled from the server env;
# the secret key never leaves the box.
set -euo pipefail
cd "$(dirname "$0")/.."

PK=$(ssh lionspool-vps "grep -o 'pk_live_[A-Za-z0-9]*' /var/www/lionspool-app/.env")
[ -n "$PK" ] || { echo "No publishable key found on server"; exit 1; }

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="$PK" \
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/sign-in" \
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up" \
NEXT_PUBLIC_ADMIN_EMAILS="mike@hark.digital,thelionspool@gmail.com" \
CLERK_KEYLESS_DISABLED=1 \
npx next build

rsync -az --delete .next/standalone/ lionspool-vps:/var/www/lionspool-app/app/
rsync -az --delete .next/static/ lionspool-vps:/var/www/lionspool-app/app/.next/static/
rsync -az --delete public/ lionspool-vps:/var/www/lionspool-app/app/public/
ssh lionspool-vps 'pm2 restart lionspool 2>/dev/null || pm2 start /var/www/lionspool-app/start.sh --name lionspool; pm2 save'
echo "Deployed."
