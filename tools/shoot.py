"""Open the built preview in a real browser, report console errors and save screenshots.
usage: python3 shoot.py <name>=<hash>[@scrollY][!mobile] ..."""
import sys, subprocess, time, os
from playwright.sync_api import sync_playwright
ROOT = "/home/claude/agentiou/web/dist-preview"
srv = subprocess.Popen([sys.executable, "-m", "http.server", "4173", "--bind", "127.0.0.1"], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        for spec in sys.argv[1:]:
            name, rest = spec.split("=", 1)
            mobile = rest.endswith("!mobile"); rest = rest.replace("!mobile", "")
            full = rest.endswith("!full"); rest = rest.replace("!full", "")
            h, _, y = rest.partition("@")
            ctx = b.new_context(viewport={"width": 390, "height": 844} if mobile else {"width": 1440, "height": 900}, device_scale_factor=1, is_mobile=mobile, has_touch=mobile)
            pg = ctx.new_page(); errs = []
            pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
            pg.on("response", lambda r: errs.append("404 "+r.url) if r.status==404 else None)
            pg.on("pageerror", lambda e: errs.append("PAGEERROR " + str(e)))
            pg.goto(f"http://127.0.0.1:4173/index.html#{h}"); pg.wait_for_timeout(3200)
            if y: pg.evaluate(f"window.scrollTo(0,{y})"); pg.wait_for_timeout(900)
            pg.screenshot(path=f"shots/{name}.png", full_page=full)
            ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            print(name, "height", pg.evaluate("document.documentElement.scrollHeight"), "x-overflow", ov, "errors", [e for e in errs if not e.startswith('Failed to load')][:5])
            ctx.close()
        b.close()
finally:
    srv.terminate()
