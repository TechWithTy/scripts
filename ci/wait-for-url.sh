#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:3000}"
ATTEMPTS="${2:-30}"
SLEEP_SECONDS="${3:-5}"

echo "Waiting for ${URL} to become available..."

for attempt in $(seq 1 "${ATTEMPTS}"); do
	if curl -sf "${URL}" >/dev/null; then
		echo "Service is up after ${attempt} attempt(s)."
		exit 0
	fi

	echo "Attempt ${attempt}/${ATTEMPTS} failed; retrying in ${SLEEP_SECONDS}s..."
	sleep "${SLEEP_SECONDS}"
done

echo "Service at ${URL} did not become ready in time."
exit 1




