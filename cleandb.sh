#!/usr/bin/env bash
# 清空本地 SQLite：mood_records → notes（避免外键顺序问题）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
DB="$ROOT/backend/data/mowen_mood.db"

if [[ ! -f "$DB" ]]; then
  echo "数据库不存在: $DB" >&2
  exit 1
fi

if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB" <<'SQL'
DELETE FROM mood_records;
DELETE FROM notes;
SQL
else
  PY="${ROOT}/backend/venv/bin/python"
  if [[ ! -x "$PY" ]]; then
    PY="python3"
  fi
  "$PY" - <<PY
import sqlite3
from pathlib import Path
db = Path("${DB}")
conn = sqlite3.connect(db)
conn.execute("DELETE FROM mood_records")
conn.execute("DELETE FROM notes")
conn.commit()
conn.close()
PY
fi

echo "已清空 notes 与 mood_records: $DB"
