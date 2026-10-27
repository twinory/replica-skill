#!/usr/bin/env python3
"""Checks the two data files the app depends on, before they reach a phone.

The app compiles Adblock syntax into native content blockers. A single rule the
engine rejects can make iOS discard the whole rule list, which looks like "the
ad blocker stopped working" with no error anywhere. This catches that here.

Run it directly, or through the test suite:

    python3 tools/check_assets.py
    python3 -m unittest discover -s tests -v      # from browser/
"""

from __future__ import annotations

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FILTERS = os.path.join(ROOT, "assets", "filters", "base.txt")
PATCHES = os.path.join(ROOT, "assets", "patches", "sites.json")

REQUIRED_PATCH_FIELDS = ("id", "name", "hosts", "start", "icon", "color")

# Domains that must never be blocked, because blocking them breaks playback
# rather than removing an ad. Each entry: (domain, why).
PROTECTED = [
    ("googlevideo.com", "the video CDN. Block it and every YouTube stream dies."),
    ("ytimg.com", "thumbnails and avatars."),
    ("ggpht.com", "avatars."),
    ("youtubei.googleapis.com", "the player API."),
    ("spotifycdn.com", "cover art and audio segments."),
    ("gstatic.com", "fonts and player modules."),
]

BAD_SELECTOR_HINTS = (":has(", "::", ":contains(")


class Report:
    def __init__(self) -> None:
        self.errors: list[str] = []
        self.notes: list[str] = []
        self.block_rules = 0
        self.exception_rules = 0
        self.cosmetic_rules = 0
        self.skipped: list[str] = []
        self.categories: dict[str, int] = {}

    def error(self, message: str) -> None:
        self.errors.append(message)

    def note(self, message: str) -> None:
        self.notes.append(message)

    def ok(self) -> bool:
        return not self.errors


def abp_to_regex(pattern: str) -> str | None:
    """Mirror of BlockListParser._toRegex in lib/core/blocklist.dart."""
    if not pattern:
        return None
    if pattern.startswith("/") and pattern.endswith("/") and len(pattern) > 2:
        return pattern[1:-1]

    out: list[str] = []
    start = 0
    if pattern.startswith("||"):
        out.append(r"^[a-z][a-z0-9+.\-]*://([^/?#]+\.)?")
        start = 2
    elif pattern.startswith("|"):
        out.append("^")
        start = 1

    end = len(pattern) - 1 if pattern.endswith("|") else len(pattern)
    if start >= end:
        return None

    for ch in pattern[start:end]:
        if ch == "*":
            out.append(".*")
        elif ch == "^":
            out.append(r"([^a-zA-Z0-9_\-.%]|$)")
        elif ch in ".+?()[]{}" or ch in "\\$":
            out.append("\\" + ch)
        else:
            out.append(ch)
    if pattern.endswith("|"):
        out.append("$")
    return "".join(out)


def parse_filter_line(line: str) -> tuple[str, str | None]:
    """Returns (kind, payload). kind is one of network, cosmetic, cosmetic_show, skip."""
    if line.startswith("!#"):
        return "meta", line[2:].strip()
    if line.startswith("!") or line.startswith("["):
        return "comment", None
    if "#@#" in line:
        return "cosmetic_show", line.split("#@#", 1)[0]
    if "##" in line:
        return "cosmetic", line.split("##", 1)[1]
    if "#?#" in line or "#$#" in line:
        return "skip", "unsupported rule type"
    return "network", line


def check_filters(report: Report) -> None:
    with open(FILTERS, encoding="utf-8") as handle:
        lines = handle.read().splitlines()

    category = "ads"
    seen: dict[str, str] = {}
    blocked_domains: set[str] = set()
    allowed_domains: set[str] = set()

    for number, raw in enumerate(lines, start=1):
        line = raw.strip()
        if not line:
            continue
        kind, payload = parse_filter_line(line)
        if kind == "meta":
            if payload.startswith("category:"):
                category = payload.split(":", 1)[1].strip()
            continue
        if kind == "comment":
            continue
        if kind == "skip":
            report.skipped.append("line %d: %s" % (number, line))
            continue

        if kind in ("cosmetic", "cosmetic_show"):
            selector = line.split("##", 1)[1] if "##" in line else line.split("#@#", 1)[1]
            selector = selector.strip()
            if not selector:
                report.error("line %d: empty selector" % number)
                continue
            if selector.startswith("+js("):
                report.skipped.append("line %d: scriptlet rules are not CSS: %s" % (number, selector))
                continue
            for hint in BAD_SELECTOR_HINTS:
                if hint in selector:
                    report.error(
                        "line %d: %s is not supported by every engine this app runs on: %s"
                        % (number, hint, selector)
                    )
            if selector.count("[") != selector.count("]"):
                report.error("line %d: unbalanced brackets in %s" % (number, selector))
            report.cosmetic_rules += 1
            continue

        pattern = payload.split("$", 1)[0]
        is_exception = pattern.startswith("@@")
        body = pattern[2:] if is_exception else pattern

        regex = abp_to_regex(body.split("$", 1)[0])
        if regex is None:
            report.error("line %d: cannot translate to a URL filter: %s" % (number, line))
            continue
        try:
            re.compile(regex)
        except re.error as exc:
            report.error("line %d: filter is not a valid regular expression (%s): %s" % (number, exc, line))
            continue

        key = regex
        if key in seen and seen[key] != line:
            report.error("line %d: duplicate of line %s: %s" % (number, seen[key], line))
            continue
        seen[key] = str(number)

        domain = ""
        if body.startswith("||"):
            domain = body[2:].split("^", 1)[0].split("/", 1)[0]
        if is_exception:
            report.exception_rules += 1
            allowed_domains.add(domain)
        else:
            report.block_rules += 1
            report.categories[category] = report.categories.get(category, 0) + 1
            blocked_domains.add(domain)

    for domain, why in PROTECTED:
        if domain in blocked_domains and domain not in allowed_domains:
            report.error("the filter list blocks %s: %s" % (domain, why))

    if report.block_rules < 250:
        report.error("only %d blocking rules, the list is thinner than it should be" % report.block_rules)
    if report.cosmetic_rules < 40:
        report.error("only %d element hiding rules" % report.cosmetic_rules)
    if "trackers" not in report.categories:
        report.error("no rules under the trackers category, the setting would do nothing")
    report.note(
        "filters: %d block, %d exceptions, %d cosmetic, %d sections"
        % (report.block_rules, report.exception_rules, report.cosmetic_rules, len(report.categories))
    )


def check_patches(report: Report) -> None:
    with open(PATCHES, encoding="utf-8") as handle:
        book = json.load(handle)

    if not isinstance(book.get("version"), int):
        report.error("sites.json: version must be an integer")
    sites = book.get("sites")
    if not isinstance(sites, list) or len(sites) < 6:
        report.error("sites.json: expected at least six sites")
        return

    ids: set[str] = set()
    hosts: dict[str, str] = {}

    for index, site in enumerate(sites):
        where = "sites[%d]" % index
        for field in REQUIRED_PATCH_FIELDS:
            if field not in site:
                report.error("%s: missing %s" % (where, field))
        if not isinstance(site.get("hosts"), list) or not site.get("hosts"):
            report.error("%s: hosts must be a non empty list" % where)
            continue
        site_id = site.get("id", "")
        if site_id in ids:
            report.error("%s: duplicate id %s" % (where, site_id))
        ids.add(site_id)
        for host in site["hosts"]:
            if host != host.lower():
                report.error("%s: host %s must be lowercase" % (where, host))
            if "*" in host or "/" in host:
                report.error("%s: host %s must be a bare hostname" % (where, host))
            if host in hosts and hosts[host] != site_id:
                report.error("%s: host %s also claimed by %s" % (where, host, hosts[host]))
            hosts[host] = site_id
        start = site.get("start", "")
        if not start.startswith("https://"):
            report.error("%s: start must be https, got %s" % (where, start))
        if "#" in start:
            report.error("%s: start must not carry a fragment, the web view drops it" % where)
        color = site.get("color", "")
        if not re.fullmatch(r"#[0-9A-Fa-f]{6}", color):
            report.error("%s: color must be #RRGGBB, got %s" % (where, color))
        app_mode = site.get("appMode", {})
        if not isinstance(app_mode, dict):
            report.error("%s: appMode must be an object" % where)
            continue
        css = app_mode.get("css", "")
        if css.count("{") != css.count("}"):
            report.error("%s: appMode.css has unbalanced braces" % where)
        if "husk-app" not in css and css.strip():
            report.error("%s: appMode.css must be scoped to html.husk-app" % where)
        js = app_mode.get("js", "")
        if "</script" in js.lower():
            report.error("%s: appMode.js must not contain a closing script tag" % where)
        for selector in app_mode.get("hide", []):
            if any(hint in selector for hint in BAD_SELECTOR_HINTS):
                report.error("%s: unsupported selector in appMode.hide: %s" % (where, selector))
        handoff = site.get("handoff")
        if handoff is not None:
            for field in ("label", "reason", "storeIos", "storeAndroid"):
                if not handoff.get(field):
                    report.error("%s: handoff is missing %s" % (where, field))

    featured = [s for s in sites if s.get("featured")]
    if len(featured) < 3:
        report.error("expected at least three featured sites for the home screen, found %d" % len(featured))

    youtube = next((s for s in sites if s.get("id") == "youtube"), None)
    if youtube is None:
        report.error("the youtube patch is the reason App view exists, it is missing")
    else:
        if not youtube.get("player", {}).get("js"):
            report.error("youtube: a player patch is required, otherwise nothing skips past an ad")
        if "ad-showing" not in youtube.get("player", {}).get("js", ""):
            report.error("youtube: the player patch does not look for the ad-showing class")

    report.note("patches: %d sites, %d featured, %d hosts" % (len(sites), len(featured), len(hosts)))


def check_dart_assets_exist(report: Report) -> None:
    pubspec = os.path.join(ROOT, "pubspec.yaml")
    with open(pubspec, encoding="utf-8") as handle:
        text = handle.read()
    for asset in ("assets/filters/", "assets/patches/"):
        if asset not in text:
            report.error("pubspec.yaml does not declare %s" % asset)


def check_no_em_dash(report: Report) -> None:
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in (".git", "node_modules", "build", ".dart_tool")]
        for name in files:
            if not name.endswith((".md", ".py", ".json", ".dart", ".html", ".js", ".css", ".txt", ".yaml", ".toml")):
                continue
            path = os.path.join(base, name)
            with open(path, encoding="utf-8") as handle:
                if chr(0x2014) in handle.read():
                    report.error("em dash in %s" % os.path.relpath(path, ROOT))


def run() -> Report:
    report = Report()
    check_filters(report)
    check_patches(report)
    check_dart_assets_exist(report)
    check_no_em_dash(report)
    return report


def main() -> int:
    report = run()
    for note in report.notes:
        print("ok   " + note)
    for skipped in report.skipped:
        print("skip " + skipped)
    for error in report.errors:
        print("FAIL " + error)
    if report.errors:
        print("\n%d problem(s)" % len(report.errors))
        return 1
    print("\nassets are valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
