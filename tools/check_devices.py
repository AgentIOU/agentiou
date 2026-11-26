"""Extra checks: more screen widths, Android emulation, keyboard-only use, speed numbers."""
import subprocess, sys, time, gzip, glob
from playwright.sync_api import sync_playwright
import os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository folder
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
ROOT=BASE+"/web/dist-preview"; U="http://127.0.0.1:4173/index.html?demo=member#"; G="http://127.0.0.1:4173/index.html#"   # U: the demo as a member; G: as a first-time guest
MIRA="0xde300000000000000000000000000000000002b7"; ME="0xde30000000000000000000000000000000000142"
PAGES=["home","start","me","mart","tasks","new","board","proof","about","legal","u-"+MIRA,"nowhere"]
res=[]
def ok(n,c,note=""): res.append((bool(c),n,note)); print(("PASS " if c else "FAIL ")+n+((" :: "+str(note)) if note and not c else ""))
srv=subprocess.Popen([sys.executable,"-m","http.server","4173","--bind","127.0.0.1"],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=["--no-sandbox"])
    for w,h in ((320,640),(412,915),(768,1024),(1024,768),(1920,1080)):
      ctx=b.new_context(viewport={"width":w,"height":h},reduced_motion="reduce"); bad=[]
      for pg_ in PAGES:
        pg=ctx.new_page(); pg.goto(U+pg_); pg.wait_for_timeout(900)
        ov=pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
        cut=pg.evaluate("[...document.querySelectorAll('header *, nav[aria-label=App] *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<-1)}).length")
        if ov>0 or cut: bad.append((pg_[:8],ov,cut))
        pg.close()
      ok(f"{w}px wide: all 12 pages fit, header and tab bar not cut",not bad,bad); ctx.close()
    # Android phone emulation (Pixel 7, Chrome): tab bar reaches every app page, touch flows work
    ctx=b.new_context(**p.devices["Pixel 7"]); pg=ctx.new_page(); errs=[]; pg.on("pageerror",lambda e:errs.append(str(e)))
    pg.goto(U+"home"); pg.wait_for_timeout(2500)
    for label,expect in (("Mart","Promise Mart"),("Town","Task Hub"),("My IOUs","Open IOUs"),("Home","Your promise history")):
      pg.locator("nav[aria-label=App]").get_by_role("link",name=label).tap(); pg.wait_for_timeout(700); ok(f"Android tab bar: {label}",expect in pg.inner_text("main"))
    small=pg.evaluate("[...document.querySelectorAll('nav[aria-label=App] a')].filter(e=>{const r=e.getBoundingClientRect();return r.height<44||r.width<44}).length"); ok("Android tab targets are at least 44px",small==0,small)
    pg.goto(U+"mart"); pg.wait_for_timeout(900); pg.get_by_role("button",name="Take on credit").first.tap(); pg.wait_for_timeout(400)
    box=pg.locator("[role=dialog]").bounding_box(); ok("Android: tray fits the screen",box and box["x"]>=0 and box["x"]+box["width"]<=pg.viewport_size["width"]+1 and box["y"]>=0,box)
    pg.get_by_role("button",name="I confirmed in my agent").tap(); pg.wait_for_timeout(2600); ok("Android: take on credit",'Promise made' in pg.locator("[role=dialog]").inner_text()); pg.get_by_role("button",name="Done").tap()
    pg.goto(U+"home"); pg.wait_for_timeout(2500); pg.get_by_role("button",name="How it works").tap(); pg.wait_for_timeout(400)
    nb=pg.get_by_role("button",name="Next").bounding_box(); ok("Android: tour buttons are on screen, above the tab bar",nb and nb["y"]+nb["height"]<=pg.viewport_size["height"],nb); pg.keyboard.press("Escape")
    ok("Android: no script errors",not errs,errs[:2]); ctx.close()
    # desktop header now has My IOUs and Profile
    pg=b.new_page(viewport={"width":1440,"height":900}); pg.goto(U+"home"); pg.wait_for_timeout(2300)
    pg.locator("header").get_by_role("link",name="My IOUs").click(); pg.wait_for_timeout(500); ok("desktop header: My IOUs","Open IOUs" in pg.inner_text("main"))
    pg.locator("header").get_by_role("link",name="My IOUs").click(); pg.wait_for_timeout(500); ok("desktop header: My IOUs","Open IOUs" in pg.inner_text("main"))
    # keyboard only: skip link first, then reach and open the tray, focus stays inside page, visible focus ring
    pg.close(); pg=b.new_page(viewport={"width":1440,"height":900}); pg.goto(U+"mart"); pg.wait_for_timeout(900); pg.keyboard.press("Tab"); ok("keyboard: first stop is Skip to content",pg.evaluate("document.activeElement.textContent")=="Skip to content")
    found=False
    for _ in range(40):
      pg.keyboard.press("Tab")
      if pg.evaluate("document.activeElement.textContent")=="Take on credit": found=True; break
    ok("keyboard: can reach Take on credit",found); ring=pg.evaluate("getComputedStyle(document.activeElement).outlineStyle"); ok("keyboard: focus ring shows",ring!="none",ring)
    pg.keyboard.press("Enter"); pg.wait_for_timeout(400); ok("keyboard: Enter opens the tray",pg.locator("[role=dialog]").count()==1); ok("keyboard: focus moves into the tray",pg.evaluate("!!document.activeElement.closest('[role=dialog]')"))
    pg.keyboard.press("Escape"); pg.close()
    # speed on a mid phone: 4x slower CPU, mobile screen
    ctx=b.new_context(**p.devices["Pixel 7"]); pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg); cdp.send("Emulation.setCPUThrottlingRate",{"rate":4})
    pg.add_init_script("window.__lcp=0;window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lcp=e.startTime}).observe({type:'largest-contentful-paint',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__cls+=e.value}).observe({type:'layout-shift',buffered:true});")
    pg.goto(U+"home"); pg.wait_for_timeout(5000); lcp=pg.evaluate("__lcp"); cls=pg.evaluate("__cls")
    ok(f"speed: largest paint {lcp/1000:.2f}s (target under 2.5s, local files, 4x slower CPU)",lcp<2500); ok(f"speed: layout shift {cls:.3f} (target under 0.1)",cls<0.1); ctx.close(); b.close()
finally: srv.terminate()
js=sum(len(gzip.compress(open(f,'rb').read())) for f in glob.glob(ROOT+"/assets/index-*.js")); ok(f"first JavaScript {js/1024:.0f} KB gzip (target under 200 KB)",js<200*1024)
f=[r for r in res if not r[0]]; print(f"\n{len(res)-len(f)} of {len(res)} extra checks passed")
