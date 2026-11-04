#!/usr/bin/env bash
# Runs the API migration and its tests on a throwaway local Postgres (16+). Usage: supabase/tests/run-api-tests.sh
# Needs psql pointing at a server you can create databases on (PGHOST/PGPORT/PGUSER).
set -euo pipefail
cd "$(dirname "$0")/../.."
P="psql -v ON_ERROR_STOP=1 -q"
$P -d postgres -c "drop database if exists forge_api_test" -c "create database forge_api_test"
$P -d forge_api_test -f supabase/tests/supabase-stub.sql
$P -d forge_api_test -f supabase/migrations/20261104100000_public_api.sql
$P -d forge_api_test -f supabase/tests/api_security.sql
bash supabase/tests/api-concurrency.sh forge_api_test
