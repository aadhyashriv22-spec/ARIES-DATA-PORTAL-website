#!/usr/bin/env bash
# Mounts each organization's NAS share READ-ONLY under NAS_STORAGE_ROOT
# (/mnt/nas_public) for mirror 4 of the Access Portal.
#
#   sudo bash backend/scripts/setup-nas-mounts.sh
#
# - Prompts for the NAS password; it is stored only in a root-only file
#   (/etc/aries-nas.credentials, mode 600), never in the repo or .env.
# - Mounts are read-only (ro): the portal can list and stream files but can
#   never modify, delete or copy anything onto the NAS.
# - Adds /etc/fstab entries (nofail + automount) so the mounts survive a
#   reboot without blocking boot if the NAS is offline.
# - Safe to re-run: existing entries are replaced, not duplicated.
set -euo pipefail

NAS_HOST="172.21.1.71"
NAS_USER="RSO_NAS1"
MOUNT_BASE="/mnt/nas_public"
CREDENTIALS_FILE="/etc/aries-nas.credentials"
PORTAL_UID="1000"   # user the aries-portal service runs as
PORTAL_GID="1000"
# share name on the NAS  ->  folder under MOUNT_BASE (must match
# NAS_ORGANIZATION_FOLDERS in backend/config/storage.js)
SHARES=("ISTRAC_DATA" "DRDO-IRDE")

if [[ $EUID -ne 0 ]]; then
    echo "Run with sudo: sudo bash $0" >&2
    exit 1
fi

if [[ ! -f "$CREDENTIALS_FILE" ]]; then
    read -r -s -p "NAS password for ${NAS_USER}: " NAS_PASSWORD
    echo
    umask 077
    printf 'username=%s\npassword=%s\n' "$NAS_USER" "$NAS_PASSWORD" > "$CREDENTIALS_FILE"
    unset NAS_PASSWORD
fi
chown root:root "$CREDENTIALS_FILE"
chmod 600 "$CREDENTIALS_FILE"

OPTIONS="ro,credentials=${CREDENTIALS_FILE},uid=${PORTAL_UID},gid=${PORTAL_GID},file_mode=0440,dir_mode=0550,vers=3.0,iocharset=utf8,noserverino,_netdev,nofail,x-systemd.automount,x-systemd.mount-timeout=15"

cp /etc/fstab "/etc/fstab.bak-$(date +%Y%m%d%H%M%S)"

for share in "${SHARES[@]}"; do
    mount_point="${MOUNT_BASE}/${share}"
    mkdir -p "$mount_point"

    # Replace any previous entry for this mount point.
    escaped=$(printf '%s' "$mount_point" | sed 's/[]\/$*.^[]/\\&/g')
    sed -i "\# ${escaped} cifs #d" /etc/fstab
    echo "//${NAS_HOST}/${share} ${mount_point} cifs ${OPTIONS} 0 0" >> /etc/fstab

    if mountpoint -q "$mount_point"; then
        umount "$mount_point" || true
    fi
done

systemctl daemon-reload
for share in "${SHARES[@]}"; do
    mount "${MOUNT_BASE}/${share}"
    echo "Mounted //${NAS_HOST}/${share} -> ${MOUNT_BASE}/${share} (read-only)"
done

echo
echo "Check: ls ${MOUNT_BASE}/ISTRAC_DATA"
