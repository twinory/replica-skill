#!/usr/bin/env python3
"""Copies the app's filter and patch files into the Worker, so there is one
source of truth instead of a copy that drifts.

    python3 tools/sync-assets.py            # writes deploy/public/v1/
    python3 tools/sync-assets.py --check    # exits 1 if the copies are stale

Runs automatically from `npm run deploy` in deploy/.
"""

from __future__ import annotations

import argparse
import hashlib
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

PAIRS = (
    (os.path.join(ROOT, "assets", "filters", "base.txt"),
     os.path.join(ROOT, "deploy", "public", "v1", "filters", "base.txt")),
    (os.path.join(ROOT, "assets", "patches", "sites.json"),
     os.path.join(ROOT, "deploy", "public", "v1", "patches.json")),
)


def digest(path: str) -> str:
    with open(path, "rb") as handle:
        return hashlib.sha256(handle.read()).hexdigest()


def sync(dest_root: str | None = None, check: bool = False) -> int:
    stale: list[str] = []
    for source, target in PAIRS:
        if dest_root:
            relative = os.path.relpath(target, os.path.join(ROOT, "deploy"))
            target = os.path.join(dest_root, relative)
        if not os.path.exists(source):
            print("missing source: %s" % source)
            return 1
        if check:
            if not os.path.exists(target) or digest(source) != digest(target):
                stale.append(os.path.relpath(target, ROOT))
            continue
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(source, target)
        print("synced %s -> %s (%d bytes)" % (
            os.path.relpath(source, ROOT), os.path.relpath(target, ROOT), os.path.getsize(target)))

    if check and stale:
        for path in stale:
            print("stale: %s" % path)
        print("run: python3 tools/sync-assets.py")
        return 1
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="do not write, fail if copies differ")
    args = parser.parse_args()
    return sync(check=args.check)


if __name__ == "__main__":
    sys.exit(main())
