#!/usr/bin/env bash
set -euo pipefail

APP_USER="simsoar"
APP_DIR="/opt/simsoar"
CONFIG_DIR="/etc/simsoar"
DATA_DIR="/var/lib/simsoar"
LOG_DIR="/var/log/simsoar"

if [[ $EUID -ne 0 ]]; then
  echo "Please run as root or with sudo." >&2
  exit 1
fi

apt update
apt install -y curl ca-certificates gnupg git build-essential postgresql-client nginx

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt install -y nodejs
fi

id -u "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$CONFIG_DIR" "$DATA_DIR/uploads" "$LOG_DIR"
chown -R "$APP_USER:$APP_USER" "$APP_DIR" "$DATA_DIR" "$LOG_DIR"
chmod 750 "$CONFIG_DIR" "$DATA_DIR" "$LOG_DIR"

echo "Base directories prepared. Copy application files to $APP_DIR and create $CONFIG_DIR/simsoar.env."
