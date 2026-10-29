#!/usr/bin/env bash
# Pick-reminder tick. Root's crontab on the VPS runs this every 5 minutes:
#   */5 * * * * /var/www/lionspool-app/cron-reminders.sh
# It asks the running app to send whatever reminders are due (the rules live
# in lib/reminders.ts). The app answers 204 when nothing is due, so the log
# only grows when mail actually goes out, or fails to.
set -a
. /var/www/lionspool-app/.env
set +a
out=$(curl -sS -m 120 -X POST -H "Authorization: Bearer ${REMINDERS_SECRET:-}" \
  http://localhost:3001/api/cron/reminders/ 2>&1)
[ -n "$out" ] && echo "$(date -u +%FT%TZ) $out" >> /var/log/lionspool-reminders.log
exit 0
