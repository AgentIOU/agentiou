import subprocess, sys, time
from playwright.sync_api import sync_playwright
srv = subprocess.Popen([sys.executable, "-m", "http.server", "4173", "--bind", "127.0.0.1"], cwd="/home/claude/agentiou/web/dist-preview", stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"]); pg = b.new_page(viewport={"width": 1440, "height": 900}); errs = []
        pg.on("pageerror", lambda e: errs.append(str(e))); pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.goto("http://127.0.0.1:4173/index.html#mart"); pg.wait_for_timeout(1500)
        pg.get_by_role("button", name="Take on credit").first.click(); pg.wait_for_timeout(600)
        print("PROMPT:\n" + pg.locator("pre.code").inner_text()); pg.screenshot(path="shots/tray.png")
        pg.get_by_role("button", name="I confirmed in my agent").click(); pg.wait_for_timeout(2800)
        print("after take:", pg.locator("[role=dialog] .stamp").inner_text()); pg.screenshot(path="shots/tray2.png")
        pg.get_by_role("button", name="Done").click()
        pg.goto("http://127.0.0.1:4173/index.html#me"); pg.wait_for_timeout(800)   # same document: demo state is kept
        print("open rows:", pg.locator("#t-open").locator("xpath=../..").locator("li.line").count())
        pg.get_by_role("button", name="Repay").nth(1).click(); pg.wait_for_timeout(500)
        print("title:", pg.locator("[role=dialog] h2").inner_text(), "|", pg.locator("[role=dialog] p").first.inner_text())
        for _ in range(2):
            pg.get_by_role("button", name="I confirmed in my agent").click(); pg.wait_for_timeout(2800)
        print("DIALOG:", pg.locator("[role=dialog]").inner_text()[:300]); pg.screenshot(path="shots/tray3.png"); pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
        print("score text:", pg.locator("h1").locator("xpath=../..").inner_text().replace("\n", " ")[:160])
        pg.goto("http://127.0.0.1:4173/index.html#tasks"); pg.wait_for_timeout(600)
        pg.get_by_role("button", name="Claim Legendary").click(); pg.wait_for_timeout(400); pg.get_by_role("button", name="I confirmed in my agent").click(); pg.wait_for_timeout(2800); pg.get_by_role("button", name="Done").click()
        pg.get_by_role("button", name="Mint").last.click(); pg.wait_for_timeout(400); pg.get_by_role("button", name="I confirmed in my agent").click(); pg.wait_for_timeout(2800)
        print("mint:", pg.locator("[role=dialog] .stamp").inner_text()); pg.get_by_role("button", name="Done").click()
        pg.get_by_role("button", name="Kept my word, Legendary").click(); pg.wait_for_timeout(800); pg.screenshot(path="shots/proof.png")
        print("errors", errs); b.close()
finally: srv.terminate()
