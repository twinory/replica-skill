#!/usr/bin/env python3
"""Checks a candidate product name against real sources, and says what it found.

Three checks, each with the evidence attached:

1. The App Store, through Apple's public search API. Returns the matching app
   names, bundle ids and sellers, so a collision like "Sotto" (an ad blocker,
   same category) shows up in seconds.
2. Domains, through RDAP. A 404 means no registration record, which is the
   closest thing to "available" a script can honestly say.
3. A manual checklist for the things no free API will answer: Play Store
   search, trademark registers, and handles.

    python3 tools/name_check.py husk --domains husk.app,gethusk.com
    python3 tools/name_check.py husk --json > name-check.json

Exit code is 0 when nothing alarming is found, 1 when the name looks crowded.

This is evidence, not legal advice. A trademark search and a lawyer are the
last word, and this tool says so in its own output.
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

ITUNES = "https://itunes.apple.com/search?term={term}&entity=software&country={country}&limit=25"
RDAP = "https://rdap.org/domain/{domain}"

UA = "husk-name-check/1.0 (+https://github.com/twinory/replica-skill)"


def fetch(url: str, timeout: float = 12.0) -> tuple[int, str]:
    """Returns (status, body). A 404 is a real answer, not an error."""
    request = urllib.request.Request(url, headers={"user-agent": UA, "accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            return response.status, response.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as error:
        return error.code, ""
    except Exception as error:  # offline, DNS, TLS, timeouts
        raise RuntimeError("could not reach %s: %s" % (url, error)) from error


def app_store_hits(term: str, country: str = "us") -> list[dict]:
    status, body = fetch(ITUNES.format(term=urllib.parse.quote(term), country=country))
    if status != 200 or not body:
        return []
    data = json.loads(body)
    out = []
    for item in data.get("results", []):
        out.append({
            "name": item.get("trackName", ""),
            "bundle": item.get("bundleId", ""),
            "seller": item.get("sellerName") or item.get("artistName", ""),
            "genre": item.get("primaryGenreName", ""),
            "url": item.get("trackViewUrl", ""),
        })
    return out


def domain_status(domain: str) -> dict:
    try:
        status, body = fetch(RDAP.format(domain=domain))
    except RuntimeError as error:
        return {"domain": domain, "state": "unknown", "detail": str(error)}
    if status == 404:
        return {"domain": domain, "state": "no registration record", "detail": ""}
    if status != 200:
        return {"domain": domain, "state": "unknown", "detail": "RDAP answered %d" % status}
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        return {"domain": domain, "state": "registered", "detail": ""}

    registered = ""
    for event in data.get("events", []):
        if event.get("eventAction") == "registration":
            registered = event.get("eventDate", "")[:10]
    registrar = ""
    for entity in data.get("entities", []):
        if "registrar" in entity.get("roles", []):
            for field in entity.get("vcardArray", [None, []])[1]:
                if field and field[0] == "fn":
                    registrar = field[3]
    return {
        "domain": domain,
        "state": "registered",
        "registered": registered,
        "registrar": registrar,
        "detail": "",
    }


def exact(term: str, hits: list[dict]) -> list[dict]:
    """Apps whose name starts with the candidate as a whole word."""
    lowered = term.lower()
    return [
        hit for hit in hits
        if hit["name"].lower() == lowered
        or hit["name"].lower().startswith(lowered + " ")
        or hit["name"].lower().startswith(lowered + ":")
        or hit["name"].lower().startswith(lowered + " -")
    ]


def verdict(term: str, hits: list[dict], exact_hits: list[dict], domains: list[dict]) -> dict:
    taken = [d for d in domains if d["state"] == "registered"]
    free = [d for d in domains if d["state"] == "no registration record"]

    if exact_hits:
        level = "crowded"
        why = "an App Store app already uses this name as its own name"
    elif len(hits) >= 12:
        level = "crowded"
        why = "many App Store results, the name will be hard to search for"
    elif hits:
        level = "usable"
        why = "some apps match loosely, none use it as their own name"
    else:
        level = "clear"
        why = "no App Store results at all"

    return {
        "name": term,
        "level": level,
        "why": why,
        "app_store_hits": len(hits),
        "app_store_exact": len(exact_hits),
        "domains_registered": [d["domain"] for d in taken],
        "domains_unregistered": [d["domain"] for d in free],
        "manual": [
            "Play Store search: https://play.google.com/store/search?q=%s" % term,
            "Trademark: USPTO TESS, EUIPO, and the India IP office, classes 9 and 42",
            "Handles: the name on GitHub, X, and the app stores",
        ],
        "disclaimer": "Evidence, not legal advice. Run a trademark search before you ship.",
    }


def report(result: dict, hits: list[dict], exact_hits: list[dict], domains: list[dict]) -> None:
    print("\n%s: %s" % (result["name"], result["level"].upper()))
    print("  %s" % result["why"])
    print("  App Store: %d results, %d using the name exactly"
          % (result["app_store_hits"], result["app_store_exact"]))
    for hit in (exact_hits or hits)[:8]:
        print("    %-38s %-28s %s" % (hit["name"][:38], hit["bundle"][:28], hit["seller"][:26]))
    if domains:
        print("  Domains:")
        for domain in domains:
            if domain["state"] == "registered":
                print("    %-22s registered %s %s"
                      % (domain["domain"], domain.get("registered", ""), domain.get("detail", "")))
            else:
                print("    %-22s %s %s" % (domain["domain"], domain["state"], domain.get("detail", "")))
    print("  Then check by hand:")
    for line in result["manual"]:
        print("    - %s" % line)
    print("  %s" % result["disclaimer"])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("name")
    parser.add_argument("--domains", default="", help="comma separated, e.g. husk.app,gethusk.com")
    parser.add_argument("--country", default="us")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    domains = [d.strip() for d in args.domains.split(",") if d.strip()]
    try:
        hits = app_store_hits(args.name, args.country)
        exact_hits = exact(args.name, hits)
        domain_results = [domain_status(d) for d in domains]
    except RuntimeError as error:
        print(error)
        print("This tool needs network access. It is meant to run on your machine.")
        return 2

    result = verdict(args.name, hits, exact_hits, domain_results)
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        report(result, hits, exact_hits, domain_results)
    return 1 if result["level"] == "crowded" else 0


if __name__ == "__main__":
    sys.exit(main())
