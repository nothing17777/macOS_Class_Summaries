#!/bin/bash
# Launch the class_summaries macOS desktop in your browser.
cd "$(dirname "$0")" || exit 1
python3 .finder/scan.py
PORT=8777
while lsof -i :$PORT >/dev/null 2>&1; do PORT=$((PORT+1)); done
echo "Serving class_summaries at http://localhost:$PORT  (Ctrl-C to stop)"
( sleep 1; open "http://localhost:$PORT/" ) &
python3 -m http.server $PORT --bind 127.0.0.1
