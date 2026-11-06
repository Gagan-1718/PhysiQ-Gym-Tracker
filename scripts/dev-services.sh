#!/usr/bin/env bash
# PhysiQ Dev Services Manager
# Starts/stops local Homebrew MySQL (port 3307, no password) and MongoDB (port 27017)
# Uses nohup + disown so background daemons survive subshell exits.

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MYSQL_DIR="$HOME/.physiq-brew-mysql"
MONGO_CONF="/opt/homebrew/etc/mongod.conf"
MONGO_LOG="/tmp/physiq-mongod.log"
MYSQL_LOG="/tmp/physiq-mysqld.log"

init_mysql_datadir() {
  pkill -f "mysqld.*3307" 2>/dev/null || true
  rm -rf "$MYSQL_DIR"
  mkdir -p "$MYSQL_DIR"
  /opt/homebrew/bin/mysqld --no-defaults \
    --initialize-insecure \
    --user="$(whoami)" \
    --datadir="$MYSQL_DIR" >>"$MYSQL_LOG" 2>&1
  rm -f "$MYSQL_DIR"/undo_*
}

start_services() {
  mkdir -p "$MYSQL_DIR"

  # 1. Start MongoDB (in its own POSIX session via setsid so subshell exit never kills it)
  if ! nc -z 127.0.0.1 27017 2>/dev/null; then
    echo "  Starting MongoDB on port 27017..."
    perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' /opt/homebrew/bin/mongod --config "$MONGO_CONF" </dev/null >>"$MONGO_LOG" 2>&1 &
    disown || true
    for _ in {1..20}; do
      nc -z 127.0.0.1 27017 2>/dev/null && break
      sleep 0.25
    done
  fi

  # 2. Start MySQL (in its own POSIX session via setsid so subshell exit never kills it)
  if ! nc -z 127.0.0.1 3307 2>/dev/null; then
    echo "  Starting MySQL on port 3307..."
    if [ ! -d "$MYSQL_DIR/mysql" ]; then
      init_mysql_datadir
    fi
    rm -f "$MYSQL_DIR/mysql.sock.lock" "$MYSQL_DIR/mysqlx.sock.lock" "$MYSQL_DIR/mysqld.pid"
    perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' /opt/homebrew/bin/mysqld --no-defaults \
      --datadir="$MYSQL_DIR" \
      --port=3307 \
      --socket="$MYSQL_DIR/mysql.sock" \
      --mysqlx=0 </dev/null >>"$MYSQL_LOG" 2>&1 &
    disown || true
    for _ in {1..20}; do
      nc -z 127.0.0.1 3307 2>/dev/null && break
      sleep 0.25
    done
    # Self-heal if datadir had stale undo tablespaces from an unclean shutdown
    if ! nc -z 127.0.0.1 3307 2>/dev/null; then
      echo "  Re-initializing clean MySQL datadir..."
      init_mysql_datadir
      perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' /opt/homebrew/bin/mysqld --no-defaults \
        --datadir="$MYSQL_DIR" \
        --port=3307 \
        --socket="$MYSQL_DIR/mysql.sock" \
        --mysqlx=0 </dev/null >>"$MYSQL_LOG" 2>&1 &
      disown || true
      for _ in {1..40}; do
        nc -z 127.0.0.1 3307 2>/dev/null && break
        sleep 0.25
      done
    fi
  fi
}

ensure_initialized() {
  start_services
  # Check if physiq_db exists and has tables; if not, initialize automatically
  TABLE_COUNT=$(/opt/homebrew/bin/mysql -u root --port=3307 -h 127.0.0.1 -N -s -e \
    "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'physiq_db';" 2>/dev/null || echo "0")
  if [ "${TABLE_COUNT:-0}" -lt 12 ]; then
    echo "  Initializing physiq_db schema and demo data..."
    (cd "$DIR" && node scripts/init-db.js --reset)
  fi
}

case "${1:-start}" in
  start)
    echo "Starting PhysiQ dev services..."
    start_services
    echo "Services ready! MySQL: 127.0.0.1:3307 | MongoDB: 127.0.0.1:27017"
    ;;

  ensure)
    ensure_initialized
    ;;

  stop)
    echo "Stopping PhysiQ dev services..."
    pkill -f "mysqld.*3307" 2>/dev/null || true
    pkill -f "mongod.*mongod.conf" 2>/dev/null || true
    echo "Services stopped."
    ;;

  status)
    echo "PhysiQ Services Status:"
    if nc -z 127.0.0.1 3307 2>/dev/null; then
      echo "  MySQL (port 3307): RUNNING"
    else
      echo "  MySQL (port 3307): STOPPED"
    fi

    if nc -z 127.0.0.1 27017 2>/dev/null; then
      echo "  MongoDB (port 27017): RUNNING"
    else
      echo "  MongoDB (port 27017): STOPPED"
    fi
    ;;

  *)
    echo "Usage: $0 {start|ensure|stop|status}"
    exit 1
    ;;
esac
