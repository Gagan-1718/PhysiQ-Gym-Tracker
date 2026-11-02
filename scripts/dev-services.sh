#!/usr/bin/env bash
# PhysiQ Dev Services Manager
# Starts/stops local Homebrew MySQL (port 3307, no password) and MongoDB (port 27017)

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MYSQL_DIR="$HOME/.physiq-brew-mysql"
MYSQL_PID="$MYSQL_DIR/mysqld.pid"
MONGO_CONF="/opt/homebrew/etc/mongod.conf"

case "$1" in
  start)
    echo "Starting PhysiQ dev services..."
    
    # 1. Start MongoDB
    if ! nc -z 127.0.0.1 27017 2>/dev/null; then
      echo "  Starting MongoDB on port 27017..."
      /opt/homebrew/bin/mongod --config "$MONGO_CONF" >/dev/null 2>&1 &
      sleep 1
    else
      echo "  MongoDB already running on port 27017."
    fi

    # 2. Start MySQL
    if ! nc -z 127.0.0.1 3307 2>/dev/null; then
      echo "  Starting MySQL on port 3307..."
      if [ ! -d "$MYSQL_DIR" ]; then
        mkdir -p "$MYSQL_DIR"
        /opt/homebrew/bin/mysqld --initialize-insecure --user=$(whoami) --datadir="$MYSQL_DIR" >/dev/null 2>&1
      fi
      /opt/homebrew/bin/mysqld --datadir="$MYSQL_DIR" --innodb_undo_directory="$MYSQL_DIR" --port=3307 --socket="$MYSQL_DIR/mysql.sock" --mysqlx=0 >/dev/null 2>&1 &
      sleep 2
    else
      echo "  MySQL already running on port 3307."
    fi

    echo "Services ready! MySQL: 127.0.0.1:3307 | MongoDB: 127.0.0.1:27017"
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
    echo "Usage: $0 {start|stop|status}"
    exit 1
    ;;
esac
