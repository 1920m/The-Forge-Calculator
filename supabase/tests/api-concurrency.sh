#!/usr/bin/env bash
# Rate-limit race test: 20 separate database sessions (like 20 Vercel servers) send 200 requests at once on a key
# allowed 100 a minute. Exactly 100 must get through and exactly 100 must be refused.
set -euo pipefail
DB="$1"
P="psql -v ON_ERROR_STOP=1 -qAt -d $DB"
KEY=$($P <<'SQL' | tail -1
select set_config('request.jwt.claims', '{"sub":"c13e43d5-0051-47c7-84f3-db21d997f90f","role":"authenticated"}', false);
set role authenticated;
select public.api_admin_create_key('Concurrency test', array['calculator:execute'], null, 60, 100)->>'key';
SQL
)
HASH=$(printf '%s' "$KEY" | sha256sum | cut -d' ' -f1)
# Start inside a single minute window.
while [ "$(date +%S | sed 's/^0//')" -gt 40 ]; do sleep 1; done
OUT=$(mktemp -d)
for c in $(seq 1 20); do
  ( for i in $(seq 1 10); do
      echo "set role anon; select public.api_authorize('$HASH', 'calculator:execute', encode(extensions.digest('client$c', 'sha256'), 'hex'))->>'code';"
    done | $P > "$OUT/$c" ) &
done
wait
OK=$(cat "$OUT"/* | grep -c '^$' || true)
LIMITED=$(cat "$OUT"/* | grep -c '^RATE_LIMITED$' || true)
HITS=$($P -c "select hits from private.api_rate where bucket = 'key:' || (select id from private.api_keys where label = 'Concurrency test')")
echo "allowed=$OK rate_limited=$LIMITED counter=$HITS"
[ "$OK" -eq 100 ] && [ "$LIMITED" -eq 100 ] && [ "$HITS" -eq 200 ] || { echo "CONCURRENCY TEST FAILED"; exit 1; }
echo "API CONCURRENCY TEST PASSED"
