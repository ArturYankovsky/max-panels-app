"""Browser-level regression checks. Run against the local static server."""
import json
import os
from pathlib import Path
import tempfile
import unittest

from playwright.sync_api import sync_playwright

BASE_URL = os.environ.get("APP_TEST_URL", "http://127.0.0.1:8765/")
ROOT = Path(__file__).resolve().parents[1]
FAMILY = json.loads((ROOT / "data" / "family.json").read_text(encoding="utf-8"))


class MiniappTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        options = {"headless": True}
        chrome = os.environ.get("PLAYWRIGHT_CHROME_EXECUTABLE")
        if chrome:
            options["executable_path"] = chrome
        cls.browser = cls.pw.chromium.launch(**options)

    @classmethod
    def tearDownClass(cls):
        cls.browser.close()
        cls.pw.stop()

    def setUp(self):
        self.context = self.browser.new_context(viewport={"width": 390, "height": 844})
        self.context.route("https://dev.max.ru/**", lambda route: route.abort())
        self.context.route("https://st.max.ru/**", lambda route: route.abort())
        self.context.route("https://telegram.org/**", lambda route: route.abort())
        self.page = self.context.new_page()
        self.errors = []
        self.page.on("pageerror", lambda error: self.errors.append(str(error)))

    def tearDown(self):
        self.context.close()
        self.assertEqual(self.errors, [], "Unexpected browser errors")

    def open(self, suffix=""):
        self.page.goto(BASE_URL + suffix)
        self.page.wait_for_load_state("networkidle")
        self.page.wait_for_selector('#app[aria-busy="false"]')

    def test_mobile_home_and_every_card(self):
        self.open()
        self.assertEqual(self.page.locator(".scenario-card").count(), len(FAMILY["scenarios"]))
        for scenario_id in FAMILY["scenarios"]:
            self.page.goto(BASE_URL + "#scenario/" + scenario_id)
            self.page.wait_for_selector(".reading-view")
            self.assertGreater(self.page.locator(".steps li").count(), 0)
            self.assertEqual(self.page.locator(".age-note").count(), 3)
            self.assertIn("редакцией", self.page.locator(".source-note").inner_text())
        for width in (320, 390, 768, 1280):
            self.page.set_viewport_size({"width": width, "height": 844})
            for route in ("home", "games", "guide", "scenario/dressing"):
                self.page.goto(BASE_URL + "#" + route)
                self.page.wait_for_selector('#app[aria-busy="false"]')
                self.assertFalse(self.page.evaluate("document.documentElement.scrollWidth > window.innerWidth"), (width, route))
        screenshot = Path(tempfile.gettempdir()) / "parent-navigator-mobile.png"
        self.page.set_viewport_size({"width": 390, "height": 844})
        self.page.goto(BASE_URL)
        self.page.wait_for_load_state("networkidle")
        self.page.screenshot(path=str(screenshot), full_page=True)

    def test_game_filters_search_and_reset(self):
        self.open("#games")
        self.assertEqual(self.page.locator(".game-card").count(), len(FAMILY["games"]))
        self.page.get_by_role("button", name=FAMILY["ages"]["23"], exact=True).click()
        expected = sum("23" in game["ages"] for game in FAMILY["games"].values())
        self.assertEqual(self.page.locator(".game-card").count(), expected)
        self.page.get_by_label("Найти игру").fill("zzzz-нет-такой-игры")
        self.assertTrue(self.page.get_by_role("heading", name="Пока ничего не нашлось").is_visible())
        self.page.get_by_role("button", name="Сбросить поиск и фильтры").click()
        self.assertEqual(self.page.locator(".game-card").count(), len(FAMILY["games"]))
        game_id = next(iter(FAMILY["games"]))
        self.page.goto(BASE_URL + "#game/" + game_id)
        self.page.wait_for_selector(".game-details")
        self.assertGreater(self.page.locator(".steps li").count(), 0)

    def test_guide_teacher_mode_and_browser_history(self):
        self.open("#guide")
        self.assertEqual(self.page.locator(".guide-card").count(), 8)
        self.assertIn("редакционный", self.page.locator(".editorial-note").inner_text())
        self.assertIn("irzar.ru", self.page.locator(".source-banner a").get_attribute("href"))
        self.page.locator(".guide-card").first.click()
        self.page.wait_for_selector(".reading-view")
        self.page.get_by_role("button", name="Педагогам", exact=True).click()
        self.assertTrue(self.page.locator(".teacher-note").is_visible())
        self.page.reload()
        self.page.wait_for_selector(".reading-view")
        self.assertEqual(self.page.get_by_role("button", name="Педагогам", exact=True).get_attribute("aria-pressed"), "true")
        self.page.go_back()
        self.page.wait_for_selector(".guide-grid")

    def test_storage_blocked_and_direct_teacher_link(self):
        self.context.add_init_script("Object.defineProperty(window, 'localStorage', {get(){throw new Error('blocked')}})")
        self.open("?mode=teacher#scenario/dressing")
        self.assertTrue(self.page.locator(".teacher-note").is_visible())
        self.page.get_by_role("button", name="Родителям", exact=True).click()
        self.assertEqual(self.page.locator(".teacher-note").count(), 0)
        self.page.locator(".skip-link").focus()
        self.page.keyboard.press("Enter")
        self.assertEqual(self.page.evaluate("location.hash"), "#scenario/dressing")

    def test_fetch_failure_retry_and_partial_availability(self):
        self.context.route("**/data/family.json*", lambda route: route.fulfill(status=503, body="unavailable"))
        self.open()
        self.assertTrue(self.page.get_by_role("alert").is_visible())
        self.page.get_by_role("link", name="Путеводитель", exact=True).click()
        self.page.wait_for_selector(".guide-grid")
        self.assertEqual(self.page.locator(".guide-card").count(), 8)
        self.context.unroute("**/data/family.json*")
        self.page.get_by_role("link", name="Ситуации", exact=True).click()
        self.page.get_by_role("button", name="Попробовать ещё раз").click()
        self.page.wait_for_selector(".scenario-card")
        self.assertEqual(self.page.locator(".scenario-card").count(), len(FAMILY["scenarios"]))

    def test_invalid_hash_and_safe_text_rendering(self):
        self.open("#scenario/no-such-card")
        self.assertTrue(self.page.get_by_role("heading", name="Такой карточки нет").is_visible())
        malicious = json.loads(json.dumps(FAMILY))
        first_id = next(iter(malicious["scenarios"]))
        malicious["scenarios"][first_id]["title"] = '<img src=x onerror="window.injected=true">'
        self.context.route("**/data/family.json*", lambda route: route.fulfill(json=malicious))
        self.open()
        self.assertIn("<img", self.page.locator(".scenario-card h3").first.inner_text())
        self.assertEqual(self.page.locator(".scenario-card img").count(), 0)
        self.assertIsNone(self.page.evaluate("window.injected"))

    def test_host_launch_hashes_and_inherited_property_routes(self):
        for launch_hash in ("#tgWebAppData=user%3Dtest&tgWebAppVersion=8.0&tgWebAppPlatform=android", "#WebAppData=test&WebAppVersion=1.0"):
            self.open(launch_hash)
            self.assertTrue(self.page.locator(".home-view").is_visible())
        for bad_hash in ("#toString", "#scenario/toString", "#game/constructor"):
            self.open(bad_hash)
            self.assertTrue(self.page.get_by_role("heading", name="Такой карточки нет").is_visible())

    def test_optional_sdk_back_handler_registered_once(self):
        self.context.add_init_script("""window.backRegistrations=0; window.WebApp={ready(){},BackButton:{show(){},hide(){},onClick(fn){window.backRegistrations++;window.appBack=fn}}};""")
        self.open()
        self.page.locator(".scenario-card").first.click()
        self.page.wait_for_selector(".reading-view")
        self.page.get_by_role("button", name="Педагогам", exact=True).click()
        self.assertEqual(self.page.evaluate("window.backRegistrations"), 1)
        self.page.evaluate("window.appBack()")
        self.page.wait_for_selector(".home-view")


if __name__ == "__main__":
    unittest.main(verbosity=2)
