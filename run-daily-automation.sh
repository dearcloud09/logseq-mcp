#!/bin/bash

# Logseq Daily Journal Automation
# 매일 아침 6시에 실행되어 오늘의 저널 생성 + 날씨 추가

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
export LOGSEQ_GRAPH_PATH="${LOGSEQ_GRAPH_PATH:-/Users/hbk/Documents/logseq}"
export WEATHER_LOCATION="${WEATHER_LOCATION:-용인시 수지구 동천동}"

echo "[$(date -Iseconds)] Logseq Daily Automation 시작"
echo "Graph path: $LOGSEQ_GRAPH_PATH"
echo "Weather location: $WEATHER_LOCATION"

cd "$SCRIPT_DIR"
/opt/homebrew/bin/node add-today-dairy.js

echo "[$(date -Iseconds)] 완료"
