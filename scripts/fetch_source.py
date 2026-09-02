#!/usr/bin/env python3
"""Download the pinned Odyssey TEI only when its recorded hash matches."""

import hashlib
import json
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
META_PATH = ROOT / "sources" / "source.json"


def main():
    with META_PATH.open("r", encoding="utf-8") as handle:
        metadata = json.load(handle)

    request = urllib.request.Request(
        metadata["sourceUrl"],
        headers={"User-Agent": "odyssey-reader source verifier"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        payload = response.read()

    actual_hash = hashlib.sha256(payload).hexdigest()
    expected_hash = metadata["sourceSha256"].lower()
    if actual_hash.lower() != expected_hash:
        raise ValueError(
            "Downloaded source hash mismatch: {} != {}".format(
                actual_hash, expected_hash
            )
        )

    target = ROOT / metadata["localFile"]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)
    print("Verified and wrote {} bytes to {}".format(len(payload), target))


if __name__ == "__main__":
    main()
