#!/usr/bin/env bash
# Restore a backup into a DISPOSABLE database and run sanity checks
# (launch plan A9: "a restore from backup succeeds on a test server").
#
# Required:
#   RESTORE_DATABASE_URL  connection string of an EMPTY, disposable database
#   RESTORE_CONFIRM_HOST  must equal that database's host name (typo guard)
#   $1                    path to a .dump (or .dump.age with AGE_IDENTITY_FILE)
#
# Refuses the production database outright (no override).
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${RESTORE_CONFIRM_HOST:?RESTORE_CONFIRM_HOST is required}"
FILE="${1:?usage: restore-test.sh <backup file>}"

host="$(printf '%s' "$RESTORE_DATABASE_URL" | sed -E 's#^[a-z]+://([^@]*@)?([^:/?]+).*#\2#')"
case "$RESTORE_DATABASE_URL" in
  *hvbbactmgfhecqbetlhg*) echo "REFUSED: this is the production database" >&2; exit 2 ;;
esac
if [ "$host" != "$RESTORE_CONFIRM_HOST" ]; then
  echo "REFUSED: RESTORE_CONFIRM_HOST does not match the target host" >&2; exit 2
fi

if [ "${FILE##*.}" = "age" ]; then
  : "${AGE_IDENTITY_FILE:?AGE_IDENTITY_FILE is required for encrypted backups}"
  age --decrypt --identity "$AGE_IDENTITY_FILE" --output "${FILE%.age}" "$FILE"
  FILE="${FILE%.age}"
fi

pg_restore --no-owner --no-privileges --exit-on-error --dbname="$RESTORE_DATABASE_URL" "$FILE"

# Sanity checks: core tables have rows and the migration history is present.
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -tA <<'SQL'
select 'users', count(*) from users
union all select 'companies', count(*) from companies
union all select 'job_offers', count(*) from job_offers
union all select 'applications', count(*) from applications
union all select 'migrations', count(*) from _prisma_migrations where finished_at is not null;
SQL
echo "restore completed: compare these counts with production (read-only) before signing off"
