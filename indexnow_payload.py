#!/usr/bin/env python3
"""Generate the IndexNow payload used by CI workflows."""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path


PAYLOAD_PATH = Path("payload.json")


def build_payload(key: str) -> dict[str, object]:
    """Return the payload body for the IndexNow submission."""
    return {
        "host": "dealscale.io",
        "key": key,
        "keyLocation": "https://dealscale.io/06663aa83dc949d6bde61889ae81d42f.txt",
        "urlList": [
            "https://dealscale.io/",
            "https://dealscale.io/portfolio",
            "https://dealscale.io/blogs",
            "https://dealscale.io/rss.xml",
        ],
    }


def main() -> int:
    key = os.environ.get("INDEXNOW_KEY", "").strip()
    if not key:
        print("INDEXNOW_KEY secret is missing; aborting IndexNow ping.")
        return 1

    payload = build_payload(key)
    PAYLOAD_PATH.write_text(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"Wrote IndexNow payload to {PAYLOAD_PATH.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())









