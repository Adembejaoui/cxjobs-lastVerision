#!/usr/bin/env bash
# Daily logical backup of the CXJobs Postgres database, stored OFF the
# database host (launch plan A9). See docs/OPERATIONS.md.
#
# Required:
#   BACKUP_DATABASE_URL   direct (non-pooled, port 5432) connection string of
#                         a READ-ONLY role. Never print it.
# Optional:
#   BACKUP_DIR            local staging directory (default ./backups)
#   BACKUP_AGE_RECIPIENT  age public key: the dump is encrypted before upload
#   BACKUP_RCLONE_REMOTE  rclone destination, e.g. "b2:cxjobs-backups/db"
#   BACKUP_RETENTION_DAYS local retention (default 14; remote retention is set
#                         by the bucket's lifecycle rule)
#
# Read-only for the database: pg_dump takes an MVCC snapshot and writes
# nothing to the source.
set -euo pipefail

: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

OUT="$BACKUP_DIR/cxjobs-db-$STAMP.dump"
# Custom format: compressed, restorable table by table with pg_restore.
pg_dump --format=custom --no-owner --no-privileges --dbname="$BACKUP_DATABASE_URL" --file="$OUT"
pg_restore --list "$OUT" > /dev/null   # the archive is readable
echo "dump written: $(basename "$OUT") ($(du -h "$OUT" | cut -f1))"

if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  age --recipient "$BACKUP_AGE_RECIPIENT" --output "$OUT.age" "$OUT"
  rm -f "$OUT"
  OUT="$OUT.age"
  echo "encrypted with age"
fi

if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  rclone copy "$OUT" "$BACKUP_RCLONE_REMOTE" --immutable
  echo "uploaded to off-site storage"
else
  echo "WARNING: BACKUP_RCLONE_REMOTE not set: the backup is NOT off-site" >&2
fi

find "$BACKUP_DIR" -name 'cxjobs-db-*' -type f -mtime +"$RETENTION" -delete
