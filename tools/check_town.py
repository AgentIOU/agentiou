"""Checks for the looks and Promise Town: glass dock, corner profile button, card metals, mascot avatars, the town's two views, Harbour Run, the guest view, and Build your own town with the panel a mascot opens."""
import subprocess, sys, time, os
from playwright.sync_api import sync_playwright
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # the repository folder
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
ROOT=BASE+"/web/dist-preview"; U="http://127.0.0.1:4176/index.html?demo=member#"; G="http://127.0.0.1:4176/index.html#"   # U: the demo as a member; G: as a first-time guest
res=[]
def ok(n,c,note=""): res.append((bool(c),n,note)); print(("PASS " if c else "FAIL ")+n+((" :: "+str(note)) if note and not c else ""))
srv=subprocess.Popen([sys.executable,"-m","http.server","4176","--bind","127.0.0.1"],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=["--no-sandbox"]); errs=[]
    def phone(w=390):
      pg=b.new_page(viewport={"width":w,"height":844},device_scale_factor=2,is_mobile=True,has_touch=True)
      pg.on("pageerror",lambda e:errs.append(str(e))); pg.on("console",lambda m:errs.append(m.text) if m.type=="error" else None); return pg
    town=lambda pg: pg.locator("section:has(#t-town)")
    # ---- the dock and the corner button
    pg=phone(); pg.goto(U+"home"); pg.wait_for_timeout(1500); dock=pg.locator("nav[aria-label=App]")
    ok("dock has four tabs: Home, Mart, Town, My IOUs",[a.strip().split("\n")[0] for a in dock.locator("a").all_inner_texts()]==["Home","Mart","Town","My IOUs"],dock.locator("a").all_inner_texts())
    r=dock.bounding_box(); ok("dock floats inside the screen",r["x"]>=0 and r["x"]+r["width"]<=390 and r["y"]+r["height"]<=844,r)
    ok("every dock tab is at least 44px to tap",pg.evaluate("[...document.querySelectorAll('nav[aria-label=App] a')].every(e=>{const r=e.getBoundingClientRect();return r.height>=44&&r.width>=44})"))
    chip=pg.locator("a.chip-me"); ok("corner button starts closed: the mascot only",chip.count()==1 and chip.get_attribute("data-open") is None and chip.bounding_box()["width"]<60,chip.bounding_box())
    ok("corner button says what it is and that the Inbox has something",chip.get_attribute("aria-label").startswith("My profile: tuku") and "waiting in your Inbox" in chip.get_attribute("aria-label"),chip.get_attribute("aria-label"))
    chip.click(); pg.wait_for_timeout(150); ok("a press opens it to show the name",chip.get_attribute("data-open") is not None and "tuku" in chip.inner_text(),chip.inner_text())
    pg.wait_for_timeout(1100); ok("then it goes to My IOUs and stays open there","Open IOUs" in pg.inner_text("main") and chip.get_attribute("data-open") is not None and chip.get_attribute("aria-current")=="page")
    dock.get_by_role("link",name="Town").tap(); pg.wait_for_timeout(900); ok("Town tab opens Task Hub, and the corner button closes again","Task Hub" in pg.inner_text("main") and chip.get_attribute("data-open") is None)
    # ---- card metal and avatar from the stickers (the demo member holds Hello and Stamped: Common and Rare)
    pg.goto(U+"me"); pg.wait_for_timeout(1300); card=pg.locator("button[aria-label^='IOU Card for']")
    ok("the card takes the metal of the highest sticker held: Gold",card.get_attribute("data-look")=="gold" and "Gold card" in card.get_attribute("aria-label"),card.get_attribute("aria-label"))
    av=pg.locator("main [role=img][data-look]").first; ok("the avatar is the mascot in that metal and in the pose of the last sticker of that tier",av.get_attribute("data-look")=="gold" and av.get_attribute("data-pose")=="stamp",(av.get_attribute("data-look"),av.get_attribute("data-pose")))
    ok("the avatar still tells the Trust Score and level in words","Trust Score 74 of 100, level 2" in av.get_attribute("aria-label"),av.get_attribute("aria-label"))
    ok("My IOUs links to the public view","See how others see you" in pg.inner_text("main"))
    pg.get_by_role("button",name="Show me Restricted").click(); pg.wait_for_timeout(900); card=pg.locator("button[aria-label^='IOU Card for']")
    ok("a Restricted card is red, never metal",card.get_attribute("data-look")=="classic" and "Restricted" in card.get_attribute("aria-label"),card.get_attribute("aria-label"))
    ok("an overdue member's mascot is asleep",pg.locator("main [role=img][data-look]").first.get_attribute("data-pose")=="rest")
    pg.goto(U+"board"); pg.wait_for_timeout(1200); n=pg.locator("ol.ledger li").count(); ok("every Leaderboard row has a mascot avatar",n>0 and pg.locator("ol.ledger li [role=img][data-pose]").count()==n,n)
    pg.close()
    # ---- Task Hub: what changed and what stayed
    pg=phone(); pg.goto(U+"tasks"); pg.wait_for_timeout(1500); t=pg.inner_text("main")
    ok("Task Hub keeps its title and sections",all(k in t for k in ("Task Hub","Your XP","Daily check-in","One-time","Every time","Vouchers","Season 1 stickers")))
    ok("the wallet lookup box is gone; one line points to Open Trust",pg.locator("#see").count()==0 and pg.locator("main").get_by_role("link",name="Check their record on Open Trust.").count()==1)
    ok("Your XP shows three rings with the XP left",pg.locator("section:has(#t-xp) svg[role=img]").count()==3 and "50 XP to the next voucher" in pg.locator("section:has(#t-xp) svg[role=img]").first.get_attribute("aria-label"))
    ok("check-in card marks today with the boat",pg.locator("#t-daily ~ div ol li >> text=today").count()==1 and "Day 3 of 7" in t)
    op=pg.locator("[aria-labelledby=t-opens]"); steps=[x.replace("\n"," ") for x in op.locator("ol > li").all_inner_texts()]
    ok("What your stickers open: three steps, Silver, Gold, Aurora, with Gold marked as yours",len(steps)==3 and steps[0].startswith("Silver Common sticker") and steps[1].startswith("Gold Rare sticker") and "yours now" in steps[1] and steps[2].startswith("Aurora Legendary sticker") and op.locator("li[aria-current]").count()==1,steps)
    ok("it is short: one line under the steps, the rule behind the i","Your card and mascot are Gold. The shade changes every 100 XP." in op.inner_text() and op.get_by_role("button",name="How the metal is chosen").count()==1 and op.bounding_box()["height"]<250,op.bounding_box())
    ok("each step shows a mascot, and the picture loaded",op.locator("ol li img").count()>=3 and pg.evaluate("[...document.querySelectorAll('[aria-labelledby=t-opens] ol img')].every(i=>i.complete&&i.naturalWidth>0)"))
    ok("no sideways scrolling on Task Hub",pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")<=0)
    # ---- the town's two views
    tw=town(pg); ok("town opens on My circle for a member who has dealt with people",tw.get_by_role("button",name="My circle").get_attribute("aria-pressed")=="true" and "you have an IOU with" in tw.inner_text())
    names=tw.locator("[data-mascot]").count(); ok("My circle draws me and the people I have an IOU with, with names",2<=names<=13 and tw.locator("[data-mascot] >> text=you").count()==1 and tw.locator("[data-mascot] >> text=mira").count()==1,names)
    RE=__import__("re"); src=lambda: tw.locator("#t-open").locator("xpath=..").locator("img").first.get_attribute("src")
    tags=[x.strip() for x in tw.locator("[data-boat]").all_inner_texts()]; ok("My circle: boats are my own open IOUs, tagged with the days left only",len(tags)==3 and all(RE.fullmatch(r"\d+d|today",x) for x in tags) and "town.webp" in src(),tags)
    tw.get_by_role("button",name="Whole town").click(); pg.wait_for_timeout(400); tt=tw.inner_text()
    ok("Whole town counts each level and links to the Leaderboard",all(k in tt for k in ("Level 3 ·","Level 2 ·","Level 1 ·")) and tw.get_by_role("link",name="See everyone on the Leaderboard").count()==1,tt[:200])
    ok("Whole town never draws more than ten per level, and names only me",tw.locator("[data-mascot]").count()<=30 and tw.locator("[data-mascot] >> text=you").count()==1 and tw.locator("[data-mascot] >> text=mira").count()==0)
    tags=[x.strip() for x in tw.locator("[data-boat]").all_inner_texts()]; ok("Whole town: every open IOU is a boat (5, two of them late), and the harbour is one size bigger",len(tags)==5 and tags.count("late")==2 and "town-2.webp" in src(),tags)
    # ---- Harbour Run: the ticket is today's check-in
    play=tw.get_by_role("button",name="Play Harbour Run"); ok("before today's check-in the game is closed and the teaser plays",play.is_disabled() and tw.locator("canvas").count()==1 and "Check in today" in tt)
    pg.get_by_role("button",name="Check in").click(); pg.wait_for_timeout(700); pg.get_by_role("button",name="I confirmed in my agent").click(); pg.wait_for_timeout(5200); pg.keyboard.press("Escape"); pg.wait_for_timeout(700)
    ok("after the check-in the game opens",not play.is_disabled()); play.scroll_into_view_if_needed(); play.click(); pg.wait_for_timeout(500)
    ok("the boat comes from the check-in streak (3 days in a row: Sailboat)","Sailboat" in tw.inner_text() and "gives no XP" in tw.inner_text(),tw.inner_text()[:200])
    ok("the start card says one hit ends the run","one hit ends the run" in tw.inner_text())
    tw.get_by_role("button",name="Start").click(); pg.wait_for_timeout(400); pg.keyboard.down("ArrowRight"); pg.wait_for_timeout(1700); pg.keyboard.up("ArrowRight"); h1=tw.inner_text()
    ok("the run counts down and has two steer buttons","0:3" in h1 and tw.get_by_role("button",name="Steer left").count()==1 and tw.get_by_role("button",name="Steer right").count()==1,h1[:80])
    lit=pg.evaluate("(()=>{const c=document.querySelector('canvas[role=img]');const d=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4000)if(d[i]+d[i+1]+d[i+2]>0)n++;return n})()"); ok("the game is really drawn",lit>50,lit)
    over=tw.get_by_role("button",name=__import__("re").compile("^(Retry|Sail again)$"))
    try: over.wait_for(timeout=46000); ended=True
    except Exception: ended=False
    h2=tw.inner_text(); crashed="You hit a rock" in h2
    ok("the run ends at a rock or at 40 seconds, and says which",ended and "Notes caught" in h2 and ((crashed and tw.get_by_role("button",name="Retry").count()==1) or (not crashed and tw.get_by_role("button",name="Sail again").count()==1)),h2[:120])
    tw.get_by_role("button",name="Close").click(); pg.wait_for_timeout(400); ok("Close brings the town back",tw.locator("#t-open").count()==1)
    pg.close()
    # ---- a guest: sees the town and the teaser, is asked to get verified before playing
    pg=phone(); pg.goto(G+"tasks"); pg.wait_for_timeout(1800); tw=town(pg)
    ok("a guest sees Whole town and the playing teaser, no My circle",tw.get_by_role("button",name="My circle").count()==0 and tw.locator("canvas").count()==1 and "Open to members" in tw.inner_text())
    ok("a guest's dock shows no dots",pg.locator("nav[aria-label=App] i").count()==0)
    tw.get_by_role("button",name="Play Harbour Run").click(); pg.wait_for_timeout(400)
    ok("pressing Play as a guest asks to get IOU Verified first","Get IOU Verified first." in tw.inner_text() and tw.get_by_role("link",name="Get IOU Verified").count()==1 and tw.locator("canvas[role=img]").count()==0)
    pg.close()
    # ---- Build your own town: one small row under Harbour Run; a press opens the whole town. Parts come from claimed vouchers (2 Common, 1 Rare, 1 Legendary a part)
    pg=phone(); pg.goto(U+"tasks"); pg.wait_for_timeout(1600); tw=town(pg); ban=tw.locator("button#t-build")
    ok("the town banner sits in Promise Town, under Harbour Run",ban.count()==1 and pg.evaluate("(()=>{const b=document.querySelector('#t-build').getBoundingClientRect(),h=[...document.querySelectorAll('section:has(#t-town) h3')].find(e=>e.textContent.includes('Harbour Run')).getBoundingClientRect();return b.top>h.bottom})()"))
    r=ban.bounding_box(); ok("it is a small row, not a big picture, and stays inside the screen",r["height"]<=150 and r["x"]>=0 and r["x"]+r["width"]<=390,r)
    ok("it says how far the town is: the demo member claimed 2 Common and 1 Rare voucher, so 2 of 28",ban.get_attribute("aria-label")=="Build your town: 2 of 28 parts open. Open your town." and "2 of 28 parts open" in ban.inner_text() and all(k in ban.inner_text() for k in ("1/10","1/11","0/7")),ban.inner_text())
    ok("the town behind the banner is decoration only",ban.locator("[role=img]").count()==0 and ban.locator("[aria-hidden=true] img[src*='/town/']").count()==5)
    ban.click(); pg.wait_for_timeout(600); dlg=pg.locator("[role=dialog][aria-modal=true]"); plot=dlg.locator("[role=img]").first
    lab=plot.get_attribute("aria-label") if dlg.count() else ""; ok("a press opens the whole town: Tree and Fountain are open",dlg.count()==1 and dlg.get_attribute("aria-label")=="Your town" and lab=="Your town: 2 of 28 parts open: Tree, Fountain.",lab)
    ok("every closed part shows a lock at its place: 26",dlg.locator("button[aria-label^='Locked:']").count()==26,dlg.locator("button[aria-label^='Locked:']").count())
    ok("before a lock is pressed the line under the town says what to do","Press a lock to see what goes there." in dlg.inner_text())
    lk=dlg.locator("button[aria-label='Locked: Windmill, Rare']"); lk.dispatch_event("click"); pg.wait_for_timeout(300)
    ok("pressing a lock names the part that goes there and its place in the order","Windmill goes here. Rare part 7 of 11" in dlg.locator("[role=status]").inner_text() and lk.get_attribute("aria-pressed")=="true",dlg.locator("[role=status]").inner_text())
    ok("and draws that part faintly at its place",plot.locator("img[src*='/town/']").count()==6 and pg.evaluate("[...document.querySelectorAll('[role=dialog] [role=img] img')].filter(i=>i.style.opacity==='0.5').length")==1)
    lk.dispatch_event("click"); pg.wait_for_timeout(200); ok("pressing it again puts it away",plot.locator("img[src*='/town/']").count()==5 and lk.get_attribute("aria-pressed")=="false")
    ok("the pictures drawn are the ground, the home, two trees and the fountain",plot.locator("img[src*='/town/']").count()==5 and pg.evaluate("[...document.querySelectorAll('[role=dialog] [role=img] img')].every(i=>i.complete&&i.naturalWidth>0)"),plot.locator("img[src*='/town/']").count())
    rows=dlg.locator("li").all_inner_texts(); ok("each tier names the next part and what it takes",len(rows)==3 and "Street lamps" in rows[0] and "Claim 2 vouchers on this page" in rows[0] and "Market stall" in rows[1] and "Lighthouse" in rows[2],rows)
    ok("the rule is stated, and that parts cannot be bought or sold","2 Common vouchers open one part" in dlg.inner_text() and "cannot be bought, sold or moved" in dlg.inner_text())
    r=dlg.bounding_box(); bb=dlg.get_by_role("button",name="Close").bounding_box(); ok("the panel fits the phone and its button is not under the dock",r["x"]>=0 and r["x"]+r["width"]<=390 and bb["y"]+bb["height"]<=844 and pg.evaluate("(()=>{const b=[...document.querySelectorAll('[role=dialog] button')].pop().getBoundingClientRect();const e=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return !!e.closest('[role=dialog]')})()"),(r,bb))
    ok("focus moves into the panel",pg.evaluate("document.activeElement.getAttribute('role')")=="dialog")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300); ok("Escape closes it and focus returns to the banner",pg.locator("[role=dialog]").count()==0 and pg.evaluate("document.activeElement.id")=="t-build")
    # the town page: press the town, zoom, read the summary; a mascot opens that member's town and record
    op=pg.locator("#t-open"); ok("the town in Task Hub is one button that says what it opens",op.get_attribute("aria-label")=="Promise Town: 5 people, 3 boats. Open the town to zoom in.",op.get_attribute("aria-label"))
    op.click(); pg.wait_for_timeout(700); tp=pg.locator("[role=dialog][aria-label='Promise Town']"); vp=tp.locator("[data-zoom]")
    ok("pressing it opens the town page at the whole town",tp.count()==1 and vp.get_attribute("data-zoom")=="1.00" and tp.get_by_role("button",name="Zoom out",exact=True).is_disabled())
    r=tp.bounding_box(); v=vp.bounding_box(); ok("the page and its picture fit the phone",r["x"]>=0 and r["x"]+r["width"]<=390 and r["y"]>=0 and v["width"]<=390 and v["height"]>=250,(r,v))
    t=tp.inner_text(); ok("under it there is a short summary only",all(k in t for k in ("people","to pay","to receive","next due")) and tp.locator("dl > div").count()==4 and tp.locator("li").count()==0,t[-160:])
    ok("the summary counts my open IOUs: 2 to pay, 1 to receive, next in 2 days",[x.split("\n")[0] for x in tp.locator("dl > div").all_inner_texts()]==["5","2","1","2d"],tp.locator("dl > div").all_inner_texts())
    tp.get_by_role("button",name="Whole town",exact=True).click(); pg.wait_for_timeout(400); n0=tp.locator("button[aria-label*='level'] >> text=mira").count()
    ok("Whole town's summary is the whole record: 9 people, 5 open promises, 4 repaid on time, 2 late now",[x.replace("\n"," ") for x in tp.locator("dl > div").all_inner_texts()]==["9 people","5 open promises","4 repaid on time","2 late now"],tp.locator("dl > div").all_inner_texts())
    ok("a boat of two other members says who owes whom",tp.locator("[data-boat][aria-label^='omar owes']").count()==2)
    zin=tp.get_by_role("button",name="Zoom in",exact=True); zin.click(); zin.click(); pg.wait_for_timeout(400)
    ok("Zoom in makes it bigger, and names show once it is zoomed",vp.get_attribute("data-zoom")=="1.96" and n0==0 and tp.locator("button[aria-label*='level'] >> text=mira").count()==1,vp.get_attribute("data-zoom"))
    tr0=pg.evaluate("document.querySelector('[data-zoom] > div').style.transform"); pg.mouse.move(v["x"]+150,v["y"]+150); pg.mouse.down(); pg.mouse.move(v["x"]+90,v["y"]+110,steps=5); pg.mouse.up(); pg.wait_for_timeout(200)
    tr1=pg.evaluate("document.querySelector('[data-zoom] > div').style.transform"); ok("dragging moves the town",tr0!=tr1 and "translate(-60px" in tr1,(tr0,tr1))
    c=pg.context.new_cdp_session(pg); cx,cy=v["x"]+v["width"]/2,v["y"]+v["height"]/2
    c.send("Input.dispatchTouchEvent",{"type":"touchStart","touchPoints":[{"x":cx-40,"y":cy,"id":1},{"x":cx+40,"y":cy,"id":2}]})
    for d in (55,70,85): c.send("Input.dispatchTouchEvent",{"type":"touchMove","touchPoints":[{"x":cx-d,"y":cy,"id":1},{"x":cx+d,"y":cy,"id":2}]})
    c.send("Input.dispatchTouchEvent",{"type":"touchEnd","touchPoints":[]}); pg.wait_for_timeout(300)
    ok("two fingers moving apart zoom in",float(vp.get_attribute("data-zoom"))>2.5,vp.get_attribute("data-zoom"))
    tp.get_by_role("button",name="Show the whole town").click(); pg.wait_for_timeout(300); ok("one button shows the whole town again",vp.get_attribute("data-zoom")=="1.00" and pg.evaluate("document.querySelector('[data-zoom] > div').style.transform")=="translate(0px, 0px) scale(1)")
    ok("Whole town never draws more than ten per level on the page",tp.locator("button[aria-label*='level']").count()<=30 and tp.locator("button[aria-label*='(you)']").count()==1)
    m=tp.locator("button[aria-haspopup=dialog][aria-label*='level']:not([aria-label*='(you)'])").first; who=m.get_attribute("aria-label").split(",")[0]
    m.click(force=True); pg.wait_for_timeout(600); dlg=pg.locator(f"[role=dialog][aria-label=\"{who}'s town\"]")
    ok("pressing a mascot opens that member's town",dlg.count()==1 and dlg.locator("[role=img]").first.get_attribute("aria-label").startswith(f"{who}'s town:"),who)
    t=dlg.inner_text(); ok("the panel gives their record too",all(k in t for k in ("Trust Score","Level","XP","Paid on time","Paid late","of 28 parts")) and dlg.get_by_role("link",name="Open full profile").count()==1,t[:200])
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300); ok("Escape closes only the panel on top",dlg.count()==0 and tp.count()==1)
    m.click(force=True); pg.wait_for_timeout(500); pg.locator("[role=dialog]").get_by_role("link",name="Open full profile").click(); pg.wait_for_timeout(900); ok("Open full profile goes to that member's public profile","#u-" in pg.url and who in pg.inner_text("main") and pg.locator("[role=dialog]").count()==0,pg.url)
    pg.goto(U+"tasks"); pg.wait_for_timeout(1200); pg.locator("#t-open").click(); pg.wait_for_timeout(500); pg.locator("[role=dialog] button[aria-label*='(you)']").click(force=True); pg.wait_for_timeout(500); ok("my own mascot opens my own town",pg.locator("[role=dialog][aria-label='Your town']").count()==1)
    pg.close()
    # more boats, more water: a member with 11 open IOUs gets the biggest harbour, and everything is drawn smaller in the same box
    pg=phone(); pg.goto(U.replace("demo=member","demo=busy")+"tasks"); pg.wait_for_timeout(1700); tw=town(pg); box=tw.locator("#t-open").locator("xpath=..")
    ok("11 open IOUs: 11 boats on the biggest harbour",tw.locator("[data-boat]").count()==11 and "town-3.webp" in box.locator("img").first.get_attribute("src") and "11 boats" in tw.locator("#t-open").get_attribute("aria-label"),tw.locator("#t-open").get_attribute("aria-label"))
    ok("the box keeps its size and every boat stays inside it",pg.evaluate("(()=>{const b=document.querySelector('#t-open').parentElement.getBoundingClientRect();return Math.abs(b.width/b.height-1.5517)<0.02&&[...document.querySelectorAll('section:has(#t-town) [data-boat]')].every(e=>{const r=e.getBoundingClientRect();return r.left>=b.left-1&&r.right<=b.right+1&&r.top>=b.top-1&&r.bottom<=b.bottom+1})})()"))
    ok("boats do not sit on top of each other",pg.evaluate("(()=>{const r=[...document.querySelectorAll('section:has(#t-town) [data-boat] svg')].map(e=>e.getBoundingClientRect());for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){const a=r[i],b=r[j];const ox=Math.min(a.right,b.right)-Math.max(a.left,b.left),oy=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);if(ox>a.width*.5&&oy>a.height*.5)return false}return true})()"))
    ok("the picture loaded",pg.evaluate("(()=>{const i=document.querySelector('#t-open').parentElement.querySelector('img');return i.complete&&i.naturalWidth>1000})()"))
    pg.close()
    pg=phone(); pg.goto(G+"tasks"); pg.wait_for_timeout(1500); ban=pg.locator("button#t-build")
    ok("a guest's banner offers a finished town to look at",ban.get_attribute("aria-label")=="Build your town: see a finished town." and "See a finished town" in ban.inner_text())
    ban.click(); pg.wait_for_timeout(700); dlg=pg.locator("[role=dialog][aria-modal=true]"); plot=dlg.locator("[role=img]").first
    ok("a guest sees a finished town as the sample, and the way in",dlg.get_attribute("aria-label")=="A finished town" and plot.get_attribute("aria-label").startswith("A finished town") and dlg.locator("button[aria-label^='Locked:']").count()==0 and dlg.get_by_role("link",name="Get IOU Verified").count()==1 and dlg.locator("li").count()==0,plot.get_attribute("aria-label"))
    ok("all the town pictures load",plot.locator("img[src*='/town/']").count()==35 and pg.evaluate("[...document.querySelectorAll('[role=dialog] [role=img] img')].every(i=>i.complete&&i.naturalWidth>0)"))
    pg.close()
    # ---- Restricted (two IOUs past due): the town can be looked at, but no game and no building
    pg=phone(); pg.goto(U.replace("demo=member","demo=restricted")+"tasks"); pg.wait_for_timeout(1700); tw=town(pg)
    ok("a Restricted member cannot start Harbour Run, and is told why",tw.get_by_role("button",name="Play Harbour Run").is_disabled() and "Closed while your account is Restricted" in tw.inner_text())
    ban=tw.locator("button#t-build"); ok("nor open Build your town",ban.is_disabled() and "Closed while Restricted" in ban.inner_text() and "Restricted" in ban.get_attribute("aria-label"),ban.inner_text())
    pg.locator("#t-open").click(); pg.wait_for_timeout(600); tp=pg.locator("[role=dialog][aria-label='Promise Town']")
    ok("but Promise Town still opens to look at",tp.count()==1 and tp.locator("button[aria-label*='(you)']").count()==1)
    pg.close()
    # ---- a member is never asked to get verified again: the home page's last panel and the footer offer what is open to them
    pg=phone(); pg.goto(U+"home"); pg.wait_for_timeout(1500); last=pg.locator("main section").last; t=last.inner_text()
    ok("home, member: the last panel opens the Mart and My IOUs, with no Get IOU Verified","You are IOU Verified" in t and last.get_by_role("link",name="Open Promise Mart").count()==1 and last.get_by_role("link",name="Open My IOUs").count()==1 and "Get IOU Verified" not in t,t[:160])
    ok("home, member: nothing on the page or in the footer asks to get verified",pg.get_by_role("link",name="Get IOU Verified").count()==0 and pg.locator("footer").get_by_role("link",name="My IOUs").count()==1,pg.get_by_role("link",name="Get IOU Verified").count())
    pg.close(); pg=phone(); pg.goto(G+"home"); pg.wait_for_timeout(1500); last=pg.locator("main section").last
    ok("home, guest: the last panel still offers Get IOU Verified",last.get_by_role("link",name="Get IOU Verified").count()==1 and "Five minutes to get verified" in last.inner_text())
    pg.close()
    # ---- town pages: ten to a page, me on every page, arrows, and it turns by itself every 5 seconds
    CR=U.replace("demo=member","demo=crowd")
    pg=phone(); pg.goto(U+"tasks"); pg.wait_for_timeout(1500); ok("a small town has one page and no arrows",town(pg).locator("[data-pager]").count()==0); pg.close()
    pg=phone(); pg.goto(CR+"tasks"); pg.wait_for_timeout(1500); tw=town(pg); tw.get_by_role("button",name="Whole town").click(); pg.wait_for_timeout(300); pager=tw.locator("[data-pager]")
    who=lambda: pg.evaluate("[...document.querySelectorAll('section:has(#t-town) [data-mascot] [role=img], section:has(#t-town) [data-mascot] img')].length")
    ok("34 members: Whole town has 4 pages of ten",pager.count()==1 and "Town 1 of 4" in pager.inner_text() and tw.locator("[data-mascot]").count()==10 and tw.locator("[data-mascot] >> text=you").count()==1,pager.inner_text())
    lab1=tw.locator("#t-open").get_attribute("aria-label"); tw.get_by_role("button",name="Next town page").click(); pg.wait_for_timeout(300)
    ok("the arrow turns the page, and I am still on it","Town 2 of 4" in pager.inner_text() and tw.locator("[data-mascot]").count()==10 and tw.locator("[data-mascot] >> text=you").count()==1,pager.inner_text())
    tw.get_by_role("button",name="Previous town page").click(); tw.get_by_role("button",name="Previous town page").click(); pg.wait_for_timeout(300)
    ok("back from the first page goes to the last, which holds who is left: me and 6","Town 4 of 4" in pager.inner_text() and tw.locator("[data-mascot]").count()==7,(pager.inner_text(),tw.locator("[data-mascot]").count()))
    pg.wait_for_timeout(6500); ok("after a press it holds still for a while","Town 4 of 4" in pager.inner_text(),pager.inner_text())
    r=pager.bounding_box(); ok("the arrows are big enough to press and stay inside the screen",r["x"]>=0 and r["x"]+r["width"]<=390 and pg.evaluate("[...document.querySelectorAll('[data-pager] button')].every(b=>{const r=b.getBoundingClientRect();return r.width>=44&&r.height>=44})"))
    pg.close()
    # ---- boats turn with the pages: each page shows the boats of its own members, what I owe rides on every page, and the count stays the whole town's
    pg=phone(); pg.goto(CR+"tasks"); pg.wait_for_timeout(1500); tw=town(pg); tw.get_by_role("button",name="Whole town").click(); pg.wait_for_timeout(300); pg.locator("#t-open").click(); pg.wait_for_timeout(900)
    tp=pg.locator("[role=dialog][aria-label='Promise Town']"); seen=[]; fits=True; minePages=0; tiles=set(); sizes=set()
    for n in range(4):
        d=pg.evaluate("""()=>{const t=document.querySelector("[role=dialog][aria-label='Promise Town']");return {names:[...t.querySelectorAll("button[aria-haspopup=dialog][aria-label*='level']")].map(b=>b.getAttribute('aria-label').split(',')[0]),boats:[...t.querySelectorAll('[data-boat]')].map(b=>b.getAttribute('aria-label')),text:t.innerText,img:t.querySelector('img').getAttribute('src')}}""")
        others=[x for x in d["boats"] if " owes " in x]; fits=fits and all(x.split(" owes ")[0] in d["names"] for x in others); seen.append(sorted(others)); minePages+=any(x.startswith("Pay ") for x in d["boats"])
        m=RE.search(r"(\d+)\s*open promises",d["text"]); tiles.add(m.group(1) if m else "?"); sizes.add(d["img"])
        if n<3: tp.get_by_role("button",name="Next town page").click(); pg.wait_for_timeout(350)
    allb=sorted(set(x for pgb in seen for x in pgb))
    ok("Whole town: a boat rides on the page where its borrower stands",fits and len(allb)>=6,(fits,seen))
    ok("turning the page changes the boats, and every open IOU of other members is on exactly one page",len(set(map(tuple,seen)))>1 and sum(len(x) for x in seen)==len(allb),seen)
    ok("a Promise Mart loan is a boat too, on its borrower's page",sum(1 for x in allb if x.endswith(" owes Promise Mart") or " owes Promise Mart," in x)==1,[x for x in allb if "Mart" in x])
    ok("what I owe rides on every page, as I do",minePages==4,minePages)
    ok("the summary counts every open promise in the town on every page, not only the boats of that page",len(tiles)==1 and "?" not in tiles and int(list(tiles)[0])>=max(len(x) for x in seen)+1,tiles)
    ok("the harbour keeps one size while the pages turn",len(sizes)==1,sizes)
    pg.close()
    pg=phone(); pg.goto(CR+"tasks"); pg.wait_for_timeout(1500); tw=town(pg); tw.get_by_role("button",name="Whole town").dispatch_event("click"); pg.wait_for_timeout(400); t0=tw.locator("[data-pager]").inner_text()
    pg.wait_for_timeout(5600); t1=tw.locator("[data-pager]").inner_text(); pg.wait_for_timeout(5200); t2=tw.locator("[data-pager]").inner_text()
    ok("left alone it turns by itself every 5 seconds","Town 1 of 4" in t0 and "Town 2 of 4" in t1 and "Town 3 of 4" in t2 and "changes by itself" in t0,(t0,t1,t2))
    pg.locator("#t-open").dispatch_event("click"); pg.wait_for_timeout(600); tp=pg.locator("[role=dialog][aria-label='Promise Town']"); p0=tp.locator("[data-pager]").inner_text()
    pg.wait_for_timeout(5800); ok("the town page has the same arrows and never turns by itself",tp.locator("[data-pager]").count()==1 and tp.locator("[data-pager]").inner_text()==p0 and "changes by itself" not in p0,(p0,tp.locator("[data-pager]").inner_text()))
    tp.get_by_role("button",name="Next town page").click(); pg.wait_for_timeout(300); ok("its arrow turns the page there too",tp.locator("[data-pager]").inner_text()!=p0 and tp.locator("button[aria-label*='(you)']").count()==1)
    pg.close()
    ctx2=b.new_context(viewport={"width":390,"height":844},reduced_motion="reduce"); pg=ctx2.new_page(); pg.goto(CR+"tasks"); pg.wait_for_timeout(1500); tw=town(pg); tw.get_by_role("button",name="Whole town").dispatch_event("click"); pg.wait_for_timeout(400); t0=tw.locator("[data-pager]").inner_text()
    pg.wait_for_timeout(5800); ok("with motion reduced it never turns by itself; the arrows still work",tw.locator("[data-pager]").inner_text()==t0 and "changes by itself" not in t0,t0); ctx2.close()
    # ---- every info note opens fully inside the phone, wherever its button sits
    for w in (320,360,393):
      pw=b.new_page(viewport={"width":w,"height":800},device_scale_factor=2,is_mobile=True,has_touch=True); pw.goto(U+"tasks"); pw.wait_for_timeout(1300); out=[]; n=pw.locator("main button[aria-expanded]").count()
      for i in range(n):
        bt=pw.locator("main button[aria-expanded]").nth(i); bt.scroll_into_view_if_needed(); bt.click(); pw.wait_for_timeout(350); r=pw.locator("[role=note]").first.bounding_box()
        if not r or r["x"]<0 or r["x"]+r["width"]>w: out.append((bt.get_attribute("aria-label"),r))
        bt.click(); pw.wait_for_timeout(120)
      ok(f"{w}px Task Hub: all {n} info notes open inside the screen",n>=3 and out==[],out); pw.close()
    # ---- the dock is the phone's menu only: on a desktop the header has the menu and no dock covers the page
    for w,want in ((1280,False),(1024,False),(1023,True),(390,True)):
      pw=b.new_page(viewport={"width":w,"height":800}); pw.goto(U+"tasks"); pw.wait_for_timeout(1200)
      ok(f"{w}px: the dock is {'shown' if want else 'hidden'}",pw.locator("nav[aria-label=App]").is_visible()==want and (want or pw.locator("header nav[aria-label=Main] a:visible").count()>=5)); 
      if w==1280:
        r=pw.locator("#t-open").locator("xpath=..").bounding_box(); ok("desktop: the whole town fits one screen, with the game and the builder beside it",r["height"]<=460 and r["y"]+r["height"]<=800 and pw.evaluate("(()=>{const t=document.querySelector('#t-open').parentElement.getBoundingClientRect(),b=document.querySelector('#t-build').getBoundingClientRect();return b.left>t.right-1&&b.top<t.bottom})()"),r)
      SH="""()=>{const sh=document.querySelector('section[aria-labelledby=t-shelf]'),r=sh.getBoundingClientRect(),po=document.querySelector('[aria-labelledby=t-opens]').getBoundingClientRect(),pc=document.querySelector('[aria-labelledby=t-cards]').getBoundingClientRect(),ul=[...sh.querySelectorAll('ul.grid-cols-3')].map(u=>u.getBoundingClientRect());
        let out=0;sh.querySelectorAll('li,button,h3').forEach(x=>{const q=x.getBoundingClientRect();if(q.width&&(q.left<r.left-1||q.right>r.right+1))out++});
        return {side:Math.abs(po.top-pc.top)<2&&po.right<=pc.left,sameH:Math.abs(po.height-pc.height)<2,rows:new Set(ul.map(u=>Math.round(u.top))).size,fill:Math.max(pc.right,...ul.map(u=>u.right))>=r.right-2,out,scroll:document.documentElement.scrollWidth>document.documentElement.clientWidth}}"""
      d=pw.evaluate(SH)
      if w>=1024: ok(f"{w}px: under Season 1 stickers the two boxes sit side by side and the three shelves go three across, out to the right edge",d["side"] and d["sameH"] and d["rows"]==1 and d["fill"] and not d["out"] and not d["scroll"],d)
      else: ok(f"{w}px: under Season 1 stickers everything stays in one column",not d["side"] and d["rows"]==3 and not d["out"] and not d["scroll"],d)
      pw.close()
    # ---- nothing may be wider than the phone. (main clips what sticks out, so scroll width cannot see it: measure the cards themselves.)
    for w in (320,360,393):
      for label,url in (("member",U),("guest",G),("busy member",U.replace("demo=member","demo=busy"))):
        pw=b.new_page(viewport={"width":w,"height":800},device_scale_factor=2,is_mobile=True,has_touch=True); pw.goto(url+"tasks"); pw.wait_for_timeout(1300)
        bad_=pw.evaluate("(()=>{const W=innerWidth;return [...document.querySelectorAll('main section, main .panel, main h1, main p, main button, main a')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.right>W+0.5||r.left<-0.5)}).map(e=>(e.id||e.getAttribute('aria-labelledby')||e.tagName)+':'+Math.round(e.getBoundingClientRect().right)).slice(0,4)})()")
        ok(f"{w}px Task Hub as {label}: every card, line and button stays inside the screen",bad_==[],bad_); pw.close()
    for name in ("home","me","mart","board"):
      pw=b.new_page(viewport={"width":360,"height":800},device_scale_factor=2,is_mobile=True,has_touch=True); pw.goto(U+name); pw.wait_for_timeout(1200)
      bad_=pw.evaluate("(()=>{const W=innerWidth;return [...document.querySelectorAll('main section, main .panel, main h1, main button')].filter(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&s.position!=='absolute'&&(r.right>W+0.5||r.left<-0.5)}).map(e=>(e.id||e.getAttribute('aria-labelledby')||e.tagName)+':'+Math.round(e.getBoundingClientRect().right)).slice(0,4)})()")
      ok(f"360px {name}: cards and buttons stay inside the screen",bad_==[],bad_); pw.close()
    # ---- small phone and reduced motion
    ctx=b.new_context(viewport={"width":320,"height":640},reduced_motion="reduce"); pg=ctx.new_page(); pg.on("pageerror",lambda e:errs.append(str(e)))
    for name in ("tasks","me","board","home"):
      pg.goto(U+name); pg.wait_for_timeout(1000); ok(f"320px {name}: nothing sticks out sideways",pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")<=0)
    pg.goto(U+"tasks"); pg.wait_for_timeout(900); ok("with motion reduced the town stands still",pg.evaluate("getComputedStyle(document.querySelector('.town-hop')).animationName")=="none")
    # ---- the four IOU Cards under "What your stickers open": small, in one row, pictures only
    CARDS="""()=>{const e=document.querySelector('div[aria-labelledby=t-cards]'),r=e.getBoundingClientRect(),li=[...e.querySelectorAll('li')].map(x=>x.getBoundingClientRect());let out=0,fit=0,wrap=0;
      li.forEach(b=>{if(b.left<r.left-1||b.right>r.right+1)out++});e.querySelectorAll('[data-card]').forEach(c=>{const a=c.getBoundingClientRect(),k=c.querySelector('button').getBoundingClientRect();if(Math.abs(k.width-a.width)>1.5||Math.abs(k.height-a.height)>2.5)fit++});
      e.querySelectorAll('li > b, li > span.rounded-full').forEach(x=>{if(x.getBoundingClientRect().height>24)wrap++});
      return {out,fit,wrap,cards:e.querySelectorAll('[data-card]').length,inert:e.querySelectorAll('[data-card][inert]').length,rows:new Set(li.map(b=>Math.round(b.top))).size,yours:[...e.querySelectorAll('[aria-current]')].map(x=>x.querySelector(':scope > b').textContent).join(),names:[...e.querySelectorAll('li > b')].map(x=>x.textContent).join(),scroll:document.documentElement.scrollWidth>document.documentElement.clientWidth}}"""
    for w in (320,360,393,1280):
        pg=b.new_page(viewport={"width":w,"height":844},device_scale_factor=2); pg.on("pageerror",lambda e: errs.append(str(e))); pg.goto(U+"tasks"); pg.wait_for_timeout(1700); d=pg.evaluate(CARDS)
        ok(f"{w}px: the four IOU Cards sit in one row inside their box, each drawn to fit, nothing wraps or scrolls",d["cards"]==4 and d["rows"]==1 and not d["out"] and not d["fit"] and not d["wrap"] and not d["scroll"],d)
        if w==393:
            ok("the four cards are named Classic, Silver, Gold, Aurora",d["names"]=="Classic,Silver,Gold,Aurora",d["names"]); ok("the small cards are pictures only: none can be pressed",d["inert"]==4,d)
            ok("the member's own metal is marked 'yours now', once",d["yours"]=="Gold" and pg.locator("div[aria-labelledby=t-cards]").get_by_text("yours now").count()==1,d["yours"])
        pg.close()
    pg=phone(); pg.goto(G+"tasks"); pg.wait_for_timeout(1700); d=pg.evaluate(CARDS); ok("a guest sees the four cards too, none marked as theirs, and is told to get IOU Verified first",d["cards"]==4 and d["yours"]=="" and pg.locator("div[aria-labelledby=t-cards]").get_by_text("yours now").count()==0 and "Get IOU Verified first to get a card of your own." in pg.locator("div[aria-labelledby=t-cards]").inner_text(),d); pg.close()
    ok("no script errors anywhere in these checks",errs==[],errs[:3])
    b.close()
finally: srv.terminate()
bad=[r for r in res if not r[0]]
print(f"\n{len(res)-len(bad)} of {len(res)} town checks passed"); sys.exit(1 if bad else 0)
