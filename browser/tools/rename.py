#!/usr/bin/env python3
"""Renames the product across the whole tree, and proves nothing was missed.

A rename touches more than the display name: the Dart package, the import
prefixes, the bundle and application ids, storage keys, CSS class names, the
Worker name, the build flag, and every doc. Doing it by hand leaves one behind,
and that leftover is how a shipped app keeps the old name in its bundle id.

    python3 tools/rename.py --from OldName --to NewName --dry-run
    python3 tools/rename.py --from OldName --to NewName
    python3 tools/rename.py --check --from OldName   # exit 1 if any remain

Compound tokens (OLD_UPDATE_BASE, old-app, old.* storage keys) are covered by
the word boundary rule as long as they are separated by a non word character,
which they are. Anything the rule would corrupt is caught by --check on a word
that must still exist, listed in KEEP.
"""

from __future__ import annotations

import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

SKIP_DIRS = {".git", "node_modules", "build", ".dart_tool", ".wrangler", "Pods", "__pycache__"}
TEXT_EXT = {
    ".md", ".txt", ".py", ".json", ".dart", ".yaml", ".yml", ".toml", ".html",
    ".js", ".css", ".sh", ".plist", ".xml", ".gradle", ".kt", ".swift", ".csv",
}

# Words that contain the old name by accident and must never be rewritten.
KEEP = ("surveillance", "unveiled", "unveil", "veiling")


def pattern(name: str) -> str:
    """The name with letters on neither side.

    Word boundaries are not enough: an underscore is a word character, so
    HUSK_UPDATE_BASE and husk_app would slip through untouched. Requiring a
    non letter on each side catches those, and still leaves surveillance and
    unveiled alone, because there the name is glued to letters.
    """
    return r"(?<![A-Za-z])%s(?![A-Za-z])" % re.escape(name)


def walk() -> list[str]:
    paths: list[str] = []
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if os.path.splitext(name)[1].lower() in TEXT_EXT:
                paths.append(os.path.join(base, name))
    return sorted(paths)


def replace_text(text: str, old: str, new: str) -> tuple[str, int]:
    def swap(match: re.Match, new=new) -> str:
        found = match.group(0)
        if found.isupper():
            return new.upper()
        if found.islower():
            return new.lower()
        return new

    return re.subn(pattern(old), swap, text, flags=re.IGNORECASE)


def leftover(name: str, text: str) -> int:
    return len(re.findall(pattern(name), text, flags=re.IGNORECASE))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--from", dest="old", required=True)
    parser.add_argument("--to", dest="new")
    parser.add_argument("--check", action="store_true", help="report leftovers, change nothing")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    if not args.check and not args.new:
        parser.error("--to is required unless --check is used")

    files = walk()
    changed: list[tuple[str, int]] = []
    remaining: list[tuple[str, int]] = []

    for path in files:
        with open(path, encoding="utf-8", errors="ignore") as handle:
            text = handle.read()

        if args.check:
            count = leftover(args.old, text)
            if count:
                remaining.append((os.path.relpath(path, ROOT), count))
            continue

        updated, count = replace_text(text, args.old, args.new)
        # A guarded word that contains the old name must survive untouched.
        for keep in KEEP:
            if keep in text and keep not in updated:
                print("refusing: %s would corrupt %r" % (os.path.relpath(path, ROOT), keep))
                return 1
        if count:
            changed.append((os.path.relpath(path, ROOT), count))
            if not args.dry_run:
                with open(path, "w", encoding="utf-8") as handle:
                    handle.write(updated)

    verb = "would change" if args.dry_run else "changed"
    for path, count in changed:
        print("%-52s %3d  %s" % (path, count, verb))
    print("\n%d file(s) %s" % (len(changed), verb))

    if args.check:
        for path, count in remaining:
            print("still mentions %r: %s (%d)" % (args.old, path, count))
        if remaining:
            print("\n%d file(s) still carry the old name" % len(remaining))
            return 1
        print("clean: nothing mentions %r any more" % args.old)
    return 0


if __name__ == "__main__":
    sys.exit(main())
