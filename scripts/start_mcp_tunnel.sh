#!/usr/bin/env bash
# Start Chrome (with remote debugging), start chrome-devtools-mcp locally, and open
# an SSH reverse tunnel so a remote machine (your VM) can reach the MCP server on
# this laptop.
#
# Usage:
#   ./scripts/start_mcp_tunnel.sh -t user@vm-host
#   ./scripts/start_mcp_tunnel.sh -t user@vm-host -p 9230 -m 9230 -c 9222
#
# Defaults:
# - local MCP port: 9230
# - remote (VM) MCP port: 9230
# - Chrome remote-debugging port: 9222

set -euo pipefail

die() { echo "ERROR: $*" >&2; exit 1; }

usage() {
  cat <<USAGE
Usage: $0 -t <user@vm-host> [options]

Options:
  -t <target>     SSH target (required) in the form user@vm-host
  -p <port>       local MCP port (default: 9230)
  -m <port>       remote MCP port on VM (default: same as local)
  -c <port>       Chrome remote-debugging port on laptop (default: 9222)
  -b <chrome-bin> path to Chrome binary (optional)
  -h              show this help

Example:
  $0 -t vmuser@dev.example.com

This will:
  1) Launch Chrome on your laptop with remote debugging enabled (:9222)
  2) Start chrome-devtools-mcp locally (npx chrome-devtools-mcp@latest)
  3) Open an SSH reverse tunnel from the VM to your laptop so the VM can reach
     the MCP server at localhost:<remote-port> on the VM.

Note: chrome-devtools-mcp requires Node >= 20 on the machine where it runs.
USAGE
}

TARGET="root@dev-vm"
LOCAL_MCP_PORT=9230
REMOTE_MCP_PORT=""
CHROME_PORT=9222
CHROME_BIN=""

KILL_ONLY=0
while getopts "t:p:m:c:b:kh" opt; do
  case "$opt" in
    t) TARGET="$OPTARG" ;;
    p) LOCAL_MCP_PORT="$OPTARG" ;;
    m) REMOTE_MCP_PORT="$OPTARG" ;;
    c) CHROME_PORT="$OPTARG" ;;
    b) CHROME_BIN="$OPTARG" ;;
    k) KILL_ONLY=1 ;;
    h) usage; exit 0 ;;
    *) usage; exit 1 ;;
  esac
done

if [ "$KILL_ONLY" -eq 0 ]; then
  [ -n "$TARGET" ] || die "Missing required -t <user@vm-host>"
  [ -n "$REMOTE_MCP_PORT" ] || REMOTE_MCP_PORT="$LOCAL_MCP_PORT"

  command -v ssh >/dev/null 2>&1 || die "ssh is required"
  command -v npx >/dev/null 2>&1 || die "npx (Node) is required to run chrome-devtools-mcp (install Node >= 20)"

  # Quick Node version check (warn only)
  if command -v node >/dev/null 2>&1; then
    node_major=$(node -v | sed -E 's/^v?([0-9]+).*$/\1/') || node_major=0
    if [ "$node_major" -lt 20 ]; then
      echo "WARNING: node version is < 20 (detected v$(node -v)). chrome-devtools-mcp may require Node 20+." >&2
    fi
  fi
else
  # KILL_ONLY mode: set defaults if not provided
  [ -n "$REMOTE_MCP_PORT" ] || REMOTE_MCP_PORT="$LOCAL_MCP_PORT"
fi

detect_chrome() {
  if [ -n "$CHROME_BIN" ]; then
    echo "$CHROME_BIN"
    return 0
  fi

  # Common Linux names
  for bin in google-chrome google-chrome-stable chromium-browser chromium; do
    if command -v "$bin" >/dev/null 2>&1; then
      echo "$(command -v $bin)"
      return 0
    fi
  done

  # macOS path
  if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return 0
  fi

  return 1
}

CHROME_BIN_FULL=$(detect_chrome || true)
if [ -z "$CHROME_BIN_FULL" ]; then
  echo "WARNING: Could not find Chrome automatically. Pass -b /path/to/chrome" >&2
else
  echo "Found Chrome: $CHROME_BIN_FULL"
fi

wait_for_port() {
  local host="$1"; local port="$2"; local timeout=${3:-30};
  local start ts
  start=$(date +%s)
  while :; do
    # Try python3 socket connect (portable)
    if python3 - <<PY >/dev/null 2>&1
import socket,sys
try:
    s=socket.socket()
    s.settimeout(0.5)
    s.connect(("127.0.0.1", $port))
    s.close()
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
    then
      return 0
    fi
    ts=$(date +%s)
    if [ $((ts - start)) -ge $timeout ]; then
      return 1
    fi
    sleep 0.5
  done
}

start_chrome() {
  # If Chrome already has remote debug port open, don't start another
  if wait_for_port 127.0.0.1 "$CHROME_PORT" 1 >/dev/null 2>&1; then
    echo "Chrome remote-debugging already listening on localhost:$CHROME_PORT"
    return 0
  fi

  if [ -z "$CHROME_BIN_FULL" ]; then
    die "Cannot start Chrome automatically; pass -b to specify the Chrome binary"
  fi

  echo "Starting Chrome with --remote-debugging-port=$CHROME_PORT"
  case "$(uname -s)" in
    Darwin)
      nohup "$CHROME_BIN_FULL" --remote-debugging-port=$CHROME_PORT --user-data-dir=/tmp/chrome-dev-profile-$CHROME_PORT >/tmp/chrome-$CHROME_PORT.log 2>&1 &
      ;;
    Linux)
      nohup "$CHROME_BIN_FULL" --remote-debugging-port=$CHROME_PORT --user-data-dir=/tmp/chrome-dev-profile-$CHROME_PORT --no-first-run --no-default-browser-check >/tmp/chrome-$CHROME_PORT.log 2>&1 &
      ;;
    *)
      die "Unsupported OS: $(uname -s) - please start Chrome manually with --remote-debugging-port=$CHROME_PORT"
      ;;
  esac

  echo -n "Waiting for Chrome remote-debugging on localhost:$CHROME_PORT... "
  if wait_for_port 127.0.0.1 "$CHROME_PORT" 20; then
    echo "OK"
  else
    echo "FAILED" >&2
    echo "Check /tmp/chrome-$CHROME_PORT.log for errors" >&2
    return 1
  fi
}

start_mcp() {
  echo "Starting chrome-devtools-mcp on localhost:$LOCAL_MCP_PORT (logs: /tmp/mcp-$LOCAL_MCP_PORT.log)"

  # Try common CLI forms. First, pass --port. If that fails, try PORT=... env.
  # Run in background and redirect logs.
  rm -f /tmp/mcp-$LOCAL_MCP_PORT.log

  set +e
  npx -y chrome-devtools-mcp@latest --port "$LOCAL_MCP_PORT" > /tmp/mcp-$LOCAL_MCP_PORT.log 2>&1 &
  MCP_PID=$!
  sleep 0.5
  if ps -p $MCP_PID > /dev/null 2>&1; then
    echo "Launched MCP (PID $MCP_PID) with --port flag"
  else
    echo "--port flag failed, trying with PORT env"
    npx -y chrome-devtools-mcp@latest > /tmp/mcp-$LOCAL_MCP_PORT.log 2>&1 &
    MCP_PID=$!
    sleep 0.5
    if ps -p $MCP_PID > /dev/null 2>&1; then
      echo "Launched MCP (PID $MCP_PID) without --port flag. Will wait for port $LOCAL_MCP_PORT to appear." 
    else
      echo "Failed to start chrome-devtools-mcp. See /tmp/mcp-$LOCAL_MCP_PORT.log" >&2
      set -e
      return 1
    fi
  fi
  set -e

  # Wait for the local MCP port to be available
  echo -n "Waiting for MCP to listen on localhost:$LOCAL_MCP_PORT... "
  if wait_for_port 127.0.0.1 "$LOCAL_MCP_PORT" 20; then
    echo "OK"
  else
    echo "FAILED" >&2
    echo "MCP logs (last 200 lines):" >&2
    tail -n 200 /tmp/mcp-$LOCAL_MCP_PORT.log >&2 || true
    return 1
  fi
}

open_ssh_reverse_tunnel() {
  echo "Opening SSH reverse tunnel: $TARGET (remote port $REMOTE_MCP_PORT) -> localhost:$LOCAL_MCP_PORT"
  # Use ExitOnForwardFailure so SSH exits if it can't bind remote port
  ssh -f -N -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -o ServerAliveCountMax=3 -R 127.0.0.1:$REMOTE_MCP_PORT:127.0.0.1:$LOCAL_MCP_PORT "$TARGET" || die "Failed to open reverse tunnel"
  echo "SSH reverse tunnel established. On the VM, connect to localhost:$REMOTE_MCP_PORT to reach the MCP server on this laptop."
}

echo "Target VM: $TARGET"
echo "Local MCP port: $LOCAL_MCP_PORT"
echo "Remote MCP port (VM): $REMOTE_MCP_PORT"
echo "Chrome remote-debugging port (local): $CHROME_PORT"

kill_pids() {
  # Accept space-separated PIDs
  pids="$1"
  if [ -n "$pids" ]; then
    echo "Killing PIDs: $pids"
    kill $pids || true
  fi
}

cleanup_all() {
  echo "Cleaning up MCP, ssh tunnels, and Chrome instances for ports local=$LOCAL_MCP_PORT remote=$REMOTE_MCP_PORT chrome=$CHROME_PORT"

  # Kill MCP processes
  if command -v pkill >/dev/null 2>&1; then
    pkill -f chrome-devtools-mcp || true
  else
    ps aux | grep -F 'chrome-devtools-mcp' | grep -v grep | awk '{print $2}' | xargs -n1 kill 2>/dev/null || true
  fi

  # Kill ssh reverse-tunnel processes that match the exact -R mapping
  ssh_pattern="-R 127.0.0.1:$REMOTE_MCP_PORT:127.0.0.1:$LOCAL_MCP_PORT"
  ssh_pids=$(ps aux | grep -F "$ssh_pattern" | grep -v grep | awk '{print $2}') || true
  kill_pids "$ssh_pids"

  # Fallback: kill any ssh processes started with the script's options
  ssh_pids_fallback=$(ps aux | grep 'ssh -f -N -o ExitOnForwardFailure' | grep -v grep | awk '{print $2}') || true
  kill_pids "$ssh_pids_fallback"

  # Kill Chrome instances started with our user-data-dir
  chrome_pattern="chrome-dev-profile-$CHROME_PORT"
  chrome_pids=$(ps aux | grep -F "$chrome_pattern" | grep -v grep | awk '{print $2}') || true
  kill_pids "$chrome_pids"

  # Remove log files
  rm -f /tmp/mcp-$LOCAL_MCP_PORT.log /tmp/chrome-$CHROME_PORT.log || true

  echo "Cleanup complete."
}

if [ "$KILL_ONLY" -eq 1 ]; then
  cleanup_all
  exit 0
fi

start_chrome
start_mcp
open_ssh_reverse_tunnel

echo
echo "Done. Verify from the VM (where opencode runs):"
echo "  curl -s http://127.0.0.1:$REMOTE_MCP_PORT/  # or the MCP's health endpoint if available"
echo
echo "If opencode expects to start a local MCP process, update its config to connect to the MCP at localhost:$REMOTE_MCP_PORT on the VM instead (or set opencode to not auto-launch the MCP process)."

echo "To stop the MCP server on this laptop:"
echo "  pkill -f chrome-devtools-mcp || true"
echo "To close the SSH tunnel on the laptop: find and kill the ssh process created by this script (ps aux | grep 'ssh -f -N -o ExitOnForwardFailure')"
