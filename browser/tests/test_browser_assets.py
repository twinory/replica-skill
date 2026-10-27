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
        self.assertIn("husk-app", youtube["appMode"]["css"])
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


class MediaSites(unittest.TestCase):
    """App view earns its keep on the four apps this person opens daily."""

    def setUp(self):
        with open(check_assets.PATCHES, encoding="utf-8") as handle:
            self.book = json.load(handle)
        self.by_id = {site["id"]: site for site in self.book["sites"]}

    def test_the_daily_media_sites_all_ship(self):
        for site_id in ("youtube", "youtube-music", "spotify", "jiohotstar"):
            self.assertIn(site_id, self.by_id, site_id)
            site = self.by_id[site_id]
            self.assertTrue(site["featured"], site_id)
            self.assertTrue(site["media"], site_id)
            self.assertTrue(site["appMode"]["css"], site_id)
            self.assertTrue(site["appMode"]["hide"], site_id)

    def test_streaming_sites_hand_off_instead_of_showing_a_black_screen(self):
        for site_id in ("spotify", "jiohotstar", "netflix"):
            handoff = self.by_id[site_id].get("handoff")
            self.assertIsNotNone(handoff, site_id)
            text = handoff["reason"] + " " + self.by_id[site_id]["notes"]
            self.assertTrue(
                any(word in text for word in ("Widevine", "FairPlay", "DRM")),
                "%s should say which DRM it hits" % site_id,
            )
            self.assertTrue(handoff["storeIos"].startswith("https://"))
            self.assertTrue(handoff["storeAndroid"].startswith("https://"))

    def test_playback_hosts_are_not_blocked_by_the_list(self):
        for site in self.book["sites"]:
            for selector in site["cosmetic"]:
                self.assertNotIn("googlevideo", selector)
                self.assertNotIn("spotifycdn", selector)


class UniversalAppMode(unittest.TestCase):
    """Any site gets the generic app-banner treatment, patch or not."""

    def setUp(self):
        self.source = open(os.path.join(ROOT, "lib", "core", "inject.dart"), encoding="utf-8").read()

    def test_selector_list_is_present_and_reasonably_sized(self):
        block = self.source.split("static const List<String> universal")[1].split("];")[0]
        count = block.count("'")
        self.assertGreater(count, 20, "expected a dozen or more universal selectors")

    def test_no_selector_needs_a_modern_engine(self):
        block = self.source.split("static const List<String> universal")[1].split("];")[0]
        self.assertNotIn(":has(", block)
        self.assertNotIn("::", block)
        self.assertNotIn("{", block)

    def test_universal_rules_are_scoped_to_app_mode(self):
        self.assertIn("html.husk-app $selector{display:none!important}", self.source)

    def test_custom_hides_come_before_the_list(self):
        body = self.source.split("static String cosmeticCss(")[1]
        self.assertLess(body.index("for (final selector in custom)"),
                        body.index("for (final selector in list.selectorsFor(host))"))


class ElementPicker(unittest.TestCase):
    def setUp(self):
        self.source = open(os.path.join(ROOT, "lib", "core", "picker.dart"), encoding="utf-8").read()

    def test_picker_reports_only_a_selector(self):
        self.assertIn("handlerName = 'huskPick'", self.source)
        self.assertIn("callHandler('huskPick'", self.source)
        self.assertNotIn("innerHTML = payload", self.source)

    def test_picker_puts_the_page_back(self):
        for line in ("removeEventListener", "classList.remove", "huskPicker = null"):
            self.assertIn(line, self.source)

    def test_picker_refuses_generated_class_names(self):
        for token in ("css-", "sc-", "jsx-"):
            self.assertIn(token, self.source)
        self.assertIn("[a-f0-9]{8,}", self.source)

    def test_ui_offers_the_picker_and_an_undo(self):
        screen = open(os.path.join(ROOT, "lib", "ui", "browser_screen.dart"), encoding="utf-8").read()
        self.assertIn("startPicker", screen)
        self.assertIn("clearCustomHides", screen)

    def test_controller_validates_what_comes_back(self):
        source = open(os.path.join(ROOT, "lib", "state", "browser_controller.dart"), encoding="utf-8").read()
        self.assertIn("clean.length > 300", source)
        self.assertIn("clean.contains('{')", source)


class PlaybackAndAgents(unittest.TestCase):
    """An embedded web view announces itself, and some players say no. The
    app now wears the same user agent the system browser wears, which is what
    makes FairPlay sites work here the way they work in Brave."""

    def setUp(self):
        self.agents = open(os.path.join(ROOT, "lib", "core", "user_agents.dart"), encoding="utf-8").read()

    def test_ios_agent_looks_like_safari(self):
        self.assertIn("Safari/604.1", self.agents)
        self.assertIn("Version/18.0 Mobile/15E148", self.agents)

    def test_android_agent_drops_the_webview_markers(self):
        # Only the constants matter here. The file also mentions both markers in
        # looksEmbedded, which is the code that strips them.
        # Semicolons are inside the UA string, so bound by the next constant.
        block = self.agents.split("static const String androidMobile")[1].split("androidDesktop")[0]
        self.assertIn("Mobile Safari/537.36", block)
        self.assertNotIn("; wv", block)
        self.assertNotIn("Version/4.0", block)

    def test_desktop_variants_exist_for_both_platforms(self):
        for method in ("iosDesktop", "androidDesktop", "forTab"):
            self.assertIn(method, self.agents)

    def test_site_view_uses_the_agent_for_the_tab(self):
        source = open(os.path.join(ROOT, "lib", "ui", "site_view.dart"), encoding="utf-8").read()
        self.assertIn("UserAgents.forTab", source)
        self.assertIn("desktop: tab.desktopMode", source)
        self.assertNotIn("applicationNameForUserAgent", source)

    def test_probe_reports_only_a_failure(self):
        probe = open(os.path.join(ROOT, "lib", "core", "playback_probe.dart"), encoding="utf-8").read()
        self.assertIn("handlerName = 'huskPlayback'", probe)
        self.assertIn("MEDIA_ERR_SRC_NOT_SUPPORTED", probe)
        self.assertIn("player never started", probe)
        self.assertNotIn("eval(", probe)

    def test_handoff_is_offered_only_after_a_failed_player(self):
        screen = open(os.path.join(ROOT, "lib", "ui", "browser_screen.dart"), encoding="utf-8").read()
        self.assertIn("tab.playbackNote.isNotEmpty", screen)
        self.assertIn("_HandoffChip", screen)

    def test_jiohotstar_asks_for_desktop_and_explains_itself(self):
        with open(check_assets.PATCHES, encoding="utf-8") as handle:
            book = json.load(handle)
        jio = next(s for s in book["sites"] if s["id"] == "jiohotstar")
        self.assertTrue(jio.get("desktopMode"))
        self.assertIn("Still not playing", jio["handoff"]["label"])
        self.assertIn("FairPlay", jio["handoff"]["reason"])

    def test_docs_say_where_the_drm_line_is(self):
        doc = open(os.path.join(ROOT, "docs", "feasibility.md"), encoding="utf-8").read()
        self.assertIn("FairPlay streams play in a WKWebView", doc)
        self.assertIn("Widevine never does", doc)
        self.assertNotIn("Playback needs Widevine, which iOS does not\n  give to apps", doc)


class Naming(unittest.TestCase):
    """The rename tool exists so this stays true after the next rename too."""

    def test_product_identifiers_carry_the_new_name(self):
        pubspec = open(os.path.join(ROOT, "pubspec.yaml"), encoding="utf-8").read()
        self.assertIn("name: husk", pubspec)
        for path in ("lib/core/config.dart", "lib/core/inject.dart", "lib/main.dart",
                     "deploy/wrangler.toml", "deploy/src/index.js", "deploy/package.json"):
            text = open(os.path.join(ROOT, path), encoding="utf-8").read().lower()
            self.assertNotIn("veil", text, path)
        self.assertIn("HUSK_UPDATE_BASE", open(os.path.join(ROOT, "lib/core/config.dart"),
                                              encoding="utf-8").read())

    def test_rename_tool_leaves_ordinary_words_alone(self):
        spec = importlib.util.spec_from_file_location(
            "rename_tool", os.path.join(ROOT, "tools", "rename.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        text = "surveillance unveiled veiling, and a Veil in the middle"
        updated, count = module.replace_text(text, "Veil", "Husk")
        self.assertEqual(count, 1)
        self.assertTrue(updated.startswith("surveillance unveiled veiling"))
        self.assertIn("a Husk in the middle", updated)

    def test_rename_tool_catches_underscore_compounds(self):
        spec = importlib.util.spec_from_file_location(
            "rename_tool2", os.path.join(ROOT, "tools", "rename.py"))
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        updated, count = module.replace_text("VEIL_UPDATE_BASE and veil-app", "Veil", "Husk")
        self.assertEqual(count, 2)
        self.assertIn("HUSK_UPDATE_BASE", updated)
        self.assertIn("husk-app", updated)


class NameCheckTool(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location(
            "name_check", os.path.join(ROOT, "tools", "name_check.py"))
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def test_an_exact_app_store_name_is_crowded(self):
        hits = [{"name": "Husk", "bundle": "app.x", "seller": "x", "genre": "Utilities", "url": ""}]
        result = self.module.verdict("Husk", hits, self.module.exact("Husk", hits), [])
        self.assertEqual(result["level"], "crowded")

    def test_a_loose_match_is_only_usable(self):
        hits = [{"name": "Husky Notes", "bundle": "app.y", "seller": "y", "genre": "Productivity", "url": ""}]
        result = self.module.verdict("Husk", hits, self.module.exact("Husk", hits), [])
        self.assertEqual(result["level"], "usable")

    def test_registered_domains_are_reported(self):
        domains = [{"domain": "husk.app", "state": "registered", "detail": ""},
                   {"domain": "huskbrowser.com", "state": "no registration record", "detail": ""}]
        result = self.module.verdict("Husk", [], [], domains)
        self.assertEqual(result["domains_registered"], ["husk.app"])
        self.assertEqual(result["domains_unregistered"], ["huskbrowser.com"])


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
        self.assertIn("classList.remove('husk-app')", source)
        self.assertIn("husk-appmode-style", source)

    def test_google_sign_in_is_sent_to_the_system_browser(self):
        source = self._read("lib", "core", "url_rules.dart")
        self.assertIn("accounts.google.com", source)
        self.assertIn("needsSystemBrowser", source)

    def test_ui_shows_the_limits_page(self):
        source = self._read("lib", "ui", "settings_screen.dart")
        self.assertIn("LimitsScreen", source)
        # The page has to name the DRM families, not just say "DRM", because the
        # difference between them is what decides whether playback works.
        self.assertIn("Widevine", source)
        self.assertIn("FairPlay", source)


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
