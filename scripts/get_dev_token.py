#!/usr/bin/env python3
"""
Helper to fetch a development JWT token using mayhamapi/.env.development values.

Reads LOGIN_EMAIL and LOGIN_PASSWORD from mayhamapi/.env.development (or a path passed
with --env) and POSTs to /api/v1/auth/login on the configured APP_BASE_URL.

It prints the token and a short browser-console snippet you can paste to authenticate the
frontend during debugging.

Usage:
  python3 scripts/get_dev_token.py
  python3 scripts/get_dev_token.py --env /path/to/.env.development

Note: this script only prints the token and a console snippet. To authenticate the
browser UI, copy the provided `localStorage.setItem(...)` line into the browser console
on the dev site and refresh.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict
import urllib.request
import urllib.error


def parse_env(path: Path) -> Dict[str, str]:
    env: Dict[str, str] = {}
    with path.open('r') as fh:
        for raw in fh:
            line = raw.strip()
            if not line or line.startswith('#'):
                continue
            if '=' not in line:
                continue
            key, val = line.split('=', 1)
            key = key.strip()
            val = val.strip()
            if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
                val = val[1:-1]
            env[key] = val
    return env


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description='Fetch dev JWT token from .env.development')
    p.add_argument('--env', help='path to .env.development (defaults to mayhamapi/.env.development)')
    args = p.parse_args(argv)

    if args.env:
        env_path = Path(args.env)
    else:
        env_path = Path(__file__).resolve().parents[1] / 'mayhamapi' / '.env.development'

    if not env_path.exists():
        print(f"Env file not found: {env_path}", file=sys.stderr)
        return 2

    env = parse_env(env_path)

    app_base = env.get('APP_BASE_URL', 'https://dev.mayhamscoreboard.com').rstrip('/')
    email = env.get('LOGIN_EMAIL')
    password = env.get('LOGIN_PASSWORD')

    if not email or not password:
        print(f"LOGIN_EMAIL or LOGIN_PASSWORD missing from {env_path}", file=sys.stderr)
        return 2

    login_url = f"{app_base}/api/v1/auth/login"
    payload = json.dumps({"email": email, "password": password}).encode('utf-8')

    req = urllib.request.Request(login_url, data=payload, headers={"Content-Type": "application/json"}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = resp.read().decode('utf-8')
    except urllib.error.HTTPError as he:
        try:
            err = he.read().decode('utf-8')
        except Exception:
            err = ''
        print(f"HTTP {he.code} error when calling {login_url}: {err}", file=sys.stderr)
        return 3
    except Exception as e:
        print(f"Request error when calling {login_url}: {e}", file=sys.stderr)
        return 3

    try:
        data = json.loads(body)
    except Exception as e:
        print(f"Failed to parse JSON response: {e}", file=sys.stderr)
        print(body, file=sys.stderr)
        return 4

    token = data.get('token')
    if not token:
        print(f"Login did not return a token. Response: {data}", file=sys.stderr)
        return 5

    console_snippet = f"localStorage.setItem('auth_token', '{token}');"
    curl_example = f"curl -s -H \"Authorization: Bearer {token}\" {app_base}/api/v1/tournaments"

    print('\nLogin successful. Token:')
    print(token)
    print('\nBrowser console snippet (paste on the dev site and refresh):')
    print(console_snippet)
    print('\nExample API call using the token:')
    print(curl_example)
    print('\nNote: this script only prints the token/snippet. To authenticate the browser UI, paste the console snippet into the browser console on the dev site and refresh.')

    return 0


if __name__ == '__main__':
    raise SystemExit(main())
