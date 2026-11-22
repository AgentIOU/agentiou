# Balance, Trust Score, level and XP must move by exactly the contract's amounts after each action.
import subprocess, sys, time, re
from playwright.sync_api import sync_playwright
res=[]
def ok(name, got, want): c = got==want; res.append(c); print(("PASS " if c else "FAIL ")+name+("" if c else f" :: got {got}, want {want}"))
srv=subprocess.Popen([sys.executable,"-m","http.server","4174","--bind","127.0.0.1"],cwd="/home/claude/agentiou/web/dist-preview",stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
U="http://127.0.0.1:4174/index.html#"
def snap(pg):
    pg.evaluate("location.hash='tasks'"); pg.wait_for_timeout(500); t=pg.inner_text("main"); xp=int(re.search(r"([\d,]+)\s*XP",t).group(1).replace(",",""))
    pg.evaluate("location.hash='me'"); pg.wait_for_timeout(500); t=pg.inner_text("main")
    lab=pg.locator("[aria-label*='IOU Card']").first.get_attribute("aria-label")
    g=lambda k: int(re.search(k+r"\n(\d+)",t).group(1))
    return dict(score=int(re.search(r"Trust Score (\d+)",t).group(1)), level=int(re.search(r"\bL(\d)\b",t).group(1)), avail=float(re.search(r"Available \$([\d.]+)",lab).group(1)), limit=int(re.search(r"of \$(\d+) limit",lab).group(1)),
                onTime=g("On-time repays"), late=g("Late"), defaults=g("Defaults"), xp=xp, restricted="Restricted account" in lab)
def confirm(pg):
    end=time.time()+25
    while time.time()<end:
        pg.wait_for_timeout(300)
        if pg.get_by_role("button",name="Done").count(): pg.wait_for_timeout(600); pg.get_by_role("button",name="Done").click(); pg.wait_for_timeout(300); return
        c=pg.get_by_role("button",name="I confirmed in my agent")
        if c.count() and c.is_enabled(): c.click()
    raise SystemExit("the process card never finished: "+pg.locator("[role=dialog]").inner_text()[:300])
def repay(pg, who):
    pg.evaluate("location.hash='me'"); pg.wait_for_timeout(400)
    pg.locator("li",has_text=who).filter(has=pg.get_by_role("button",name="Repay")).first.get_by_role("button",name="Repay").click(); confirm(pg)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"])
    # ---- A. normal account
    pg=b.new_page(viewport={"width":1280,"height":900}); pg.goto(U+"me"); pg.wait_for_timeout(1200); a=snap(pg); print("start",a)
    ok("start: balance is limit minus what I owe ($5 - $2.24)", a["avail"], 2.76)
    repay(pg,"Phone top-up"); c=snap(pg); print(c)
    ok("repay 0.0004 BNB early: balance back up by $0.24", c["avail"], 3.00); ok("  Trust Score +5", c["score"], a["score"]+5); ok("  XP +40 (30 on time, 10 early)", c["xp"], a["xp"]+40); ok("  on-time count +1", c["onTime"], a["onTime"]+1)
    pg.evaluate("location.hash='mart'"); pg.wait_for_timeout(500); pg.get_by_role("button",name="Take on credit").first.click(); confirm(pg); d=snap(pg); print(d)
    ok("take a sticker on credit: balance down by its price", round(c["avail"]-d["avail"],2) in (0.01,0.03,0.05), True); ok("  score and XP unchanged by borrowing", (d["score"],d["xp"]), (c["score"],c["xp"]))
    pg.get_by_role("button",name="Accept").first.click(); confirm(pg); e=snap(pg); print(e)
    ok("accept sam's 1.5 USDT: balance down by $1.50", round(d["avail"]-e["avail"],2), 1.5)
    repay(pg,"Notebook"); f=snap(pg); print(f)
    ok("repay 2 USDT: balance up by $2", round(f["avail"]-e["avail"],2), 2.0); ok("  Trust Score +5 again", f["score"], e["score"]+5); ok("  XP +40", f["xp"], e["xp"]+40)
    pg.close()
    # ---- B. going overdue, Restricted, and paying late
    pg=b.new_page(viewport={"width":1280,"height":900}); pg.goto(U+"me"); pg.wait_for_timeout(1200); a=snap(pg)
    pg.get_by_role("button",name="Show me Restricted").click(); pg.wait_for_timeout(500); r=snap(pg); print(r)
    ok("two IOUs past due: Trust Score -20 at once", r["score"], a["score"]-20); ok("  level drops to L1, limit $1", (r["level"],r["limit"]), (1,1)); ok("  Restricted, nothing left to borrow", (r["restricted"],r["avail"]), (True,0.0)); ok("  XP is not taken away", r["xp"], a["xp"])
    repay(pg,"Phone top-up"); r1=snap(pg); print(r1)
    ok("first late repay: counted as late, no repay XP", (r1["late"],r1["onTime"],r1["xp"]), (1,a["onTime"],a["xp"])); ok("  one still past due: no longer Restricted, score still down", (r1["restricted"],r1["score"]), (False,a["score"]-20))
    repay(pg,"Notebook"); r2=snap(pg); print(r2)
    ok("second late repay: 2 late on record, Restricted gone", (r2["late"],r2["restricted"]), (2,False)); ok("  the late marks stay in the score (2 x -10)", r2["score"], a["score"]-20)
    ok("  level stays L1 after paying late (has to be earned again)", (r2["level"],r2["limit"]), (1,1)); ok("  balance is the full $1 again", r2["avail"], 1.0)
    # ---- C. leaderboard: points = Trust Score x 10 + XP, highest first
    pg=b.new_page(viewport={"width":1280,"height":900}); pg.goto(U+"board"); pg.wait_for_timeout(1000)
    rows=[re.search(r"Trust (\d+), (\d+) XP\s+(\d+)",li.inner_text()) for li in pg.locator("ol.ledger > li").all()]; pts=[int(m.group(3)) for m in rows]
    ok("leaderboard: every row's points are Trust Score x 10 + XP", [int(m.group(1))*10+int(m.group(2)) for m in rows], pts); ok("leaderboard: highest points first", pts, sorted(pts, reverse=True)); ok("leaderboard: has rows", len(pts)>=5, True)
    b.close()
finally: srv.terminate()
print(f"\n{sum(res)} of {len(res)} number checks passed")
