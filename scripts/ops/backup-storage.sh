#!/usr/bin/env bash
# Off-site copy of the Supabase Storage buckets (CVs and images), A9.
# Uses Supabase's S3-compatible endpoint through an rclone remote configured
# with S3 access keys created in the Supabase dashboard (Storage > S3).
#
# Required:
#   STORAGE_RCLONE_SOURCE  e.g. "supabase:"   (the S3-compatible remote)
#   STORAGE_RCLONE_DEST    e.g. "b2:cxjobs-backups/storage"
# The private `cv` bucket contains personal data: the destination must be
# private and encrypted (rclone crypt remote or server-side encryption).
set -euo pipefail
: "${STORAGE_RCLONE_SOURCE:?}"
: "${STORAGE_RCLONE_DEST:?}"
STAMP="$(date -u +%Y%m%d)"
for bucket in cv avatars logos covers culture-images blog-images; do
  rclone sync "${STORAGE_RCLONE_SOURCE}${bucket}" "${STORAGE_RCLONE_DEST}/${bucket}" \
    --backup-dir "${STORAGE_RCLONE_DEST}/_versions/${STAMP}/${bucket}" --fast-list
done
echo "storage sync finished"
