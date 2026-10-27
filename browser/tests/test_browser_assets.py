"""Tests for the data the browser depends on.

These run with the standard library only, no Flutter needed:

    cd browser && python3 -m unittest discover -s tests -v
"""

import json
import os
import re
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(ROOT, "tools"))

import check_assets  # noqa: E402
import importlib.util  # noqa: E402


def load_sync():
    path = os.path.join(ROOT, "tools", "sync-assets.py")
    spec = importlib.util.spec_from_file_location("sync_assets", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Filters(unittest.TestCase):
    def test_filter_file_is_valid(self):
        report = check_assets.Report()
        check_assets.check_filters(report)
        self.assertEqual(report.errors, [])
        self.assertGreater(report.block_rules, 300)
        self.assertGreater(report.exception_rules, 10)
        self.assertGreater(report.cosmetic_rules, 60)

    def test_trackers_have_their_own_section(self):
        report = check_assets.Report()
        check_assets.check_filters(report)
        self.assertIn("trackers", report.categories)
        self.assertIn("ads", report.categories)

    def test_playback_domains_are_never_blocked(self):
        with open(check_assets.FILTERS, encoding="utf-8") as handle:
            text = handle.read()
        for domain in ("googlevideo.com", "youtubei.googleapis.com", "spotifycdn.com"):
            self.assertIn("@@||%s^" % domain, text, "%s must stay reachable" % domain)

    def test_adblock_translation_matches_the_dart_parser(self):
        # Spot checks of the exact strings lib/core/blocklist.dart produces.
        self.assertEqual(
            check_assets.abp_to_regex("||doubleclick.net^"),
            r"^[a-z][a-z0-9+.\-]*://([^/?#]+\.)?doubleclick\.net([^a-zA-Z0-9_\-.%]|$)",
        )
        self.assertEqual(
            check_assets.abp_to_regex("|https://exact.example/ad.js|"),
            r"^https://exact\.example/ad\.js$",
        )
        self.assertEqual(check_assets.abp_to_regex("/banner[0-9]+/"), "banner[0-9]+")


class Patches(unittest.TestCase):
    def setUp(self):
        with open(check_assets.PATCHES, encoding="utf-8") as handle:
            self.book = json.load(handle)

    def test_patch_file_is_valid(self):
        report = check_assets.Report()
        check_assets.check_patches(report)
        self.assertEqual(report.errors, [])

    def test_youtube_has_a_player_patch(self):
        youtube = next(s for s in self.book["sites"] if s["id"] == "youtube")
        self.assertIn("ad-showing", youtube["player"]["js"])
        self.assertIn("veil-app", youtube["appMode"]["css"])
        self.assertTrue(youtube["featured"])

    def test_every_selector_is_css_only(self):
        for site in self.book["sites"]:
            for selector in site.get("cosmetic", []) + site.get("appMode", {}).get("hide", []):
                self.assertNotIn(":has(", selector, site["id"])
                self.assertNotIn("javascript:", selector)

    def test_no_site_claims_another_site_s_host(self):
        claimed = {}
        for site in self.book["sites"]:
            for host in site["hosts"]:
                self.assertNotIn(host, claimed)
                claimed[host] = site["id"]

    def test_start_urls_are_https_and_parse(self):
        for site in self.book["sites"]:
            self.assertTrue(site["start"].startswith("https://"), site["id"])
            self.assertNotRegex(site["start"], r"\s")


class AssetsAndDeploy(unittest.TestCase):
    def test_sync_writes_the_worker_copies(self):
        sync = load_sync()
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(sync.sync(dest_root=tmp), 0)
            self.assertTrue(os.path.exists(os.path.join(tmp, "public", "v1", "patches.json")))
            self.assertTrue(os.path.exists(os.path.join(tmp, "public", "v1", "filters", "base.txt")))

    def test_worker_serves_the_endpoints_the_app_calls(self):
        with open(os.path.join(ROOT, "deploy", "src", "index.js"), encoding="utf-8") as handle:
            worker = handle.read()
        for route in ("/v1/manifest.json", "/v1/patches.json", "/v1/filters/base.txt", "/health"):
            self.assertIn(route, worker)
        self.assertNotIn("eval(", worker)

    def test_app_paths_point_at_real_files(self):
        expected = [
            os.path.join(ROOT, "assets", "filters", "base.txt"),
            os.path.join(ROOT, "assets", "patches", "sites.json"),
        ]
        for path in expected:
            self.assertTrue(os.path.exists(path), path)

    def test_dart_sources_reference_those_paths(self):
        with open(os.path.join(ROOT, "lib", "state", "browser_controller.dart"), encoding="utf-8") as handle:
            source = handle.read()
        self.assertIn("assets/filters/base.txt", source)
        self.assertIn("assets/patches/sites.json", source)

    def test_no_em_dash_in_anything_shipped(self):
        report = check_assets.Report()
        check_assets.check_no_em_dash(report)
        self.assertEqual(report.errors, [])


class DartSources(unittest.TestCase):
    def _read(self, *parts):
        with open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
            return handle.read()

    def test_the_engine_is_never_hand_written(self):
        with open(os.path.join(ROOT, "pubspec.yaml"), encoding="utf-8") as handle:
            pubspec = handle.read()
        self.assertIn("flutter_inappwebview", pubspec)
        self.assertIn("sdk: flutter", pubspec)

    def test_blocker_builder_caps_the_rule_list(self):
        source = self._read("lib", "core", "blockers.dart")
        self.assertIn("maxRules", source)
        self.assertIn("IGNORE_PREVIOUS_RULES", source)

    def test_app_mode_is_reversible(self):
        source = self._read("lib", "core", "inject.dart")
        self.assertIn("classList.remove('veil-app')", source)
        self.assertIn("veil-appmode-style", source)

    def test_google_sign_in_is_sent_to_the_system_browser(self):
        source = self._read("lib", "core", "url_rules.dart")
        self.assertIn("accounts.google.com", source)
        self.assertIn("needsSystemBrowser", source)

    def test_ui_shows_the_limits_page(self):
        source = self._read("lib", "ui", "settings_screen.dart")
        self.assertIn("LimitsScreen", source)
        self.assertIn("DRM", source)


if __name__ == "__main__":
    unittest.main()


class SyncDrift(unittest.TestCase):
    """The Worker copies are committed so a Git deploy works without Python.
    That only holds if they never drift from the app's assets."""

    def test_committed_worker_copies_match_the_assets(self):
        sync = load_sync()
        for source, target in sync.PAIRS:
            self.assertTrue(os.path.exists(target), "%s is missing, run tools/sync-assets.py" % target)
            self.assertEqual(
                sync.digest(source),
                sync.digest(target),
                "%s is stale, run tools/sync-assets.py" % os.path.relpath(target, ROOT),
            )
