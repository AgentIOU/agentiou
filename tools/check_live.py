"""The live website against a local chain that stands in for BNB Smart Chain.
The site writes each prompt; this test sends exactly the call the prompt describes (what the agent wallet would do),
then checks that the site moves on only when the chain shows it, and that every number on screen equals the contract's."""
import subprocess, sys, time, re, json, os, signal
from playwright.sync_api import sync_playwright
ROOT="/home/claude/agentiou"; C=ROOT+"/contracts"; res=[]
def ok(name, cond, note=""): res.append(bool(cond)); print(("PASS " if cond else "FAIL ")+name+((" :: "+str(note)[:400]) if note and not cond else "")); sys.stdout.flush()
def node(*a): return subprocess.run(["node","live_chain.mjs",*map(str,a)],cwd=C,capture_output=True,text=True,timeout=120).stdout.strip().split("\n")[-1]
subprocess.run("pkill -f 'anvil.*8547'",shell=True); time.sleep(0.5)
anvil=subprocess.Popen([C+"/node_modules/@foundry-rs/anvil-linux-amd64/bin/anvil","--port","8547","--silent","--accounts","10","--code-size-limit","24576"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(2)
A=json.loads(node("setup")); ANA,BEN,CAT=A["ana"],A["ben"],A["cat"]
env=dict(os.environ,VITE_CONTRACT=A["contract"],VITE_MART=A["mart"],VITE_RPC="http://127.0.0.1:8547",VITE_ROUTER="hash")
b_=subprocess.run("npx vite build --mode preview --outDir dist-live && rm -f dist-live/_headers",shell=True,cwd=ROOT+"/web",env=env,capture_output=True,text=True); assert "built in" in b_.stdout+b_.stderr, b_.stdout[-400:]+b_.stderr[-400:]
srv=subprocess.Popen([sys.executable,"-m","http.server","4175","--bind","127.0.0.1"],cwd=ROOT+"/web/dist-live",stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL); time.sleep(0.8)
U="http://127.0.0.1:4175/index.html#"
chain=lambda who: json.loads(node("user",who))
try:
  with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]); ctx=b.new_context(viewport={"width":390,"height":844}); pg=ctx.new_page(); errs=[]; hosts=set()
    pg.on("console",lambda m: m.type=="error" and errs.append(m.text[:200])); pg.on("pageerror",lambda e: errs.append(str(e)[:300])); pg.on("request",lambda r: hosts.add(r.url.split("/")[2]))
    go=lambda name,wait=900: (pg.evaluate(f"location.hash='{name}'"), pg.wait_for_timeout(wait))
    main=lambda: pg.inner_text("main")
    def send_prompt(frm):
        pr=pg.locator("pre.code").inner_text()   # the prompt exactly as the visitor would copy it
        to=re.search(r"Call contract (0x[0-9a-fA-F]{40})",pr).group(1); data=re.search(r"^Calldata: (0x[0-9a-fA-F]+)$",pr,re.M).group(1); val=re.search(r"Value: ([\d.]+) BNB",pr).group(1)
        return node("send",frm,to,data,val)
    def confirm(expect="done",limit=30):
        pg.get_by_role("button",name="I confirmed in my agent").click(); end=time.time()+limit
        while time.time()<end:
            pg.wait_for_timeout(500); d=pg.locator("[role=dialog]")
            if expect=="done" and d.get_by_role("button",name="Done").count(): return True
            if expect=="step2" and "Step 2 of 2" in d.inner_text() and d.locator("pre.code").count(): return True
            if expect=="slow" and "can't see it on-chain yet" in d.inner_text(): return True
        return False
    speed=[]
    def act(frm, expect="done"):
        r=send_prompt(frm); t=time.time(); c=confirm(expect); speed.append(time.time()-t); return r=="success" and c
    done=lambda: (pg.get_by_role("button",name="Done").click(), pg.wait_for_timeout(300))
    def site():
        go("tasks",700); t=main(); xp=int(re.search(r"([\d,]+)\s*XP",t).group(1).replace(",",""))
        go("me",700); t=main(); lab=pg.locator("[aria-label*='IOU Card']").first.get_attribute("aria-label")
        return dict(score=int(re.search(r"Trust Score (\d+)",t).group(1)), level=int(re.search(r"\bL(\d)\b",t).group(1)), limit=int(re.search(r"of \$(\d+) limit",lab).group(1)), avail=float(re.search(r"Available \$([\d.]+)",lab).group(1)), xp=xp, restricted="Restricted account" in lab)
    def same(label):
        c=chain(ANA); s=site(); want=dict(score=c["score"],level=c["level"],limit=c["limitCents"]//100,avail=round(max(0,c["limitCents"]-c["owedCents"])/100,2),xp=c["xp"],restricted=c["restricted"])
        ok(f"{label}: the site shows the contract's own numbers",s==want,f"site {s} chain {want}"); return c
    # ---- A. first visit, nothing saved: a guest reading the real chain
    pg.goto(U+"mart"); pg.wait_for_timeout(3000); t=main()
    ok("guest: the three shop offers come from the contract",all(x in t for x in ("Day one sticker","Night owl sticker","Good word sticker")) and t.count("100 of 100")==3,t[:300])
    ok("guest: nothing can be taken",all(x.is_disabled() for x in pg.get_by_role("button",name="Take on credit").all()) and pg.get_by_role("button",name="Take on credit").count()==3)
    demo=[]
    for n in ("home","mart","tasks","board","about","proof","legal"):
        go(n,600)
        if re.search(r"Demo data|demo ledger|In this demo|demo profile|Pre-deploy",pg.inner_text("body")): demo.append(n)
    ok("live site never says demo",not demo,demo); ok("footer says it is reading the chain","Reading BNB Smart Chain" in pg.inner_text("footer"))
    go("me"); ok("guest: My IOUs asks for an address first","Add your Agentic Wallet address" in main())
    node("join",BEN,"ben")   # another member joins first, so member numbers can be checked
    # ---- B. an address that holds no Agent ID
    go("start")
    for _ in range(3): pg.get_by_role("button",name="I did this").first.click(); pg.wait_for_timeout(150)
    pg.fill("#aw","not an address"); ok("a wrong address cannot be saved",pg.get_by_role("button",name="Save on this device").is_disabled())
    pg.fill("#aw",CAT); pg.get_by_role("button",name="Save on this device").click(); pg.wait_for_timeout(3500)
    ok("address without an Agent ID: the site warns before any prompt","has no Agent ID yet" in main(),main()[-400:])
    pg.get_by_role("button",name="Use a different address").click(); pg.wait_for_timeout(2500)
    ok("the saved address can be removed",pg.evaluate("localStorage.getItem('agentiou.me')") is None)
    # ---- C. join
    go("start")
    for _ in range(3): pg.get_by_role("button",name="I did this").first.click(); pg.wait_for_timeout(150)
    pg.fill("#aw",ANA.lower()); pg.get_by_role("button",name="Save on this device").click(); pg.wait_for_timeout(3500)
    ok("address with an Agent ID is recognised","Holds an Agent ID" in main(),main()[-300:])
    ok("only the public address is stored on the device",pg.evaluate("Object.keys(localStorage).filter(k=>k.startsWith('agentiou')).sort().join()") in ("agentiou.me",) or set(pg.evaluate("Object.keys(localStorage)"))<= {"agentiou.me","agentiou.sound","agentiou.reduce"})
    pg.fill("#nn","ana"); pg.get_by_role("button",name="Get IOU Verified").last.click(); pg.wait_for_timeout(400)
    ok("join: prompt sent as written, the card finishes when the chain shows it",act(ANA)); done()
    ok("after joining: header shows the profile, no join button",pg.locator("header").get_by_role("link",name="Profile: ana").count()==1 and pg.locator("header").get_by_role("link",name="Get IOU Verified").count()==0)
    go("me"); ok("member numbers follow joining order (ben 1, ana 2)","Member No. 000002" in main(),main()[:200]); c=same("after join"); ok("join gives 50 XP, L1, $1",(c["xp"],c["level"],c["limitCents"])==(50,1,100))
    pg.reload(); pg.wait_for_timeout(3000); ok("after a reload the visitor is still a member, not a guest",pg.locator("header").get_by_role("link",name="Profile: ana").count()==1 and "Guest" not in main())
    # ---- D. take on credit
    go("mart"); pg.get_by_role("button",name="Take on credit").first.click(); pg.wait_for_timeout(400)
    pr=pg.locator("pre.code").inner_text(); ok("the loan prompt says what arrives, from whom, and that nothing leaves my wallet","lends me 0.01 USDT from the shop ("+A["mart"] in pr and "within 2 days" in pr and "Nothing leaves my wallet" in pr,pr[:400])
    u0=int(node("usdt",ANA)); m0=int(node("usdt",A["mart"]))
    ok("take the 0.01 USDT loan",act(ANA)); done(); c=same("after taking an offer"); ok("the IOU is on the chain: 1 cent owed",c["owedCents"]==1)
    ok("the shop's 0.01 USDT really arrived in my wallet, and left the shop's",int(node("usdt",ANA))-u0==10**16 and m0-int(node("usdt",A["mart"]))==10**16,(int(node("usdt",ANA))-u0,))
    go("mart"); ok("stock went down on the shop page","99 of 100" in main() and "In your profile" in main())
    # ---- E. repay USDT in two steps
    go("me"); pg.get_by_role("button",name="Repay").first.click(); pg.wait_for_timeout(400)
    ok("repay step 1: the card moves to step 2 only when the approval is on-chain",act(ANA,"step2"))
    ok("repay step 2: finished when the repayment is on-chain",act(ANA)); done()
    c=same("after an on-time repay"); ok("on-time repay: XP 130, score 57, nothing owed",(c["xp"],c["score"],c["owedCents"],c["onTime"])==(130,57,0,1),c)
    ok("the shop has its money back and earned nothing",int(node("usdt",A["mart"]))==m0 and int(node("usdt",ANA))==u0)
    go("mart",1200); ok("the repaid loan is back in stock, and I keep the sticker",main().count("100 of 100")==3 and "In your profile" in main(),main()[:300])
    # ---- E2. a shop with no lending money left
    node("shop","0"); pg.reload(); pg.wait_for_timeout(3500); go("mart",900)
    ok("shop out of funds: the site says so and writes no prompt","The shop has no USDT to lend right now" in main() and all(x.is_disabled() for x in pg.get_by_role("button",name="Take on credit").all()))
    node("shop","9"); pg.reload(); pg.wait_for_timeout(3500); go("mart",900); ok("shop funded again: offers open",any(x.is_enabled() for x in pg.get_by_role("button",name="Take on credit").all()))
    # ---- F. check-in, claim, mint
    go("tasks"); pg.get_by_role("button",name="Check in").click(); pg.wait_for_timeout(400); ok("daily check-in",act(ANA)); done(); c=same("after check-in"); ok("check-in: +5 XP, day 1",(c["xp"],c["checkDays"])==(135,1))
    go("tasks"); ok("check-in is off for the rest of the day",pg.get_by_role("button",name="Come back tomorrow").is_disabled())
    pg.get_by_role("button",name=re.compile("^Claim")).first.click(); pg.wait_for_timeout(400); ok("claim a Common voucher",act(ANA)); done(); ok("voucher is in the pocket on-chain",chain(ANA)["pocket"][0]==1)
    go("tasks"); mint=[x for x in pg.get_by_role("button",name=re.compile("^Mint")).all() if x.is_enabled()]
    ok("a Common stamp can now be minted",len(mint)>=1)
    if mint: mint[0].click(); pg.wait_for_timeout(400); ok("mint with the voucher",act(ANA)); done(); ok("voucher used on-chain",chain(ANA)["pocket"][0]==0)
    # ---- G. the visitor says "confirmed" but never sent it
    go("mart"); pg.get_by_role("button",name="Take on credit").first.click(); pg.wait_for_timeout(400)
    pg.get_by_role("button",name="I confirmed in my agent").click(); pg.wait_for_timeout(1500)
    ok("while it waits, the visitor can go straight back to the prompt",pg.get_by_role("button",name=re.compile("back to the prompt")).count()==1)
    t0=time.time(); slow=False
    while time.time()-t0<70 and not slow: pg.wait_for_timeout(500); slow="can't see it on-chain yet" in pg.locator("[role=dialog]").inner_text()
    ok(f"nothing sent: the card does not pretend, it says it cannot see it (after {time.time()-t0+1.5:.0f}s)",slow and time.time()-t0<50)
    ok("nothing changed on-chain",chain(ANA)["owedCents"]==0)
    pg.get_by_role("button",name="Back to the prompt").click(); pg.wait_for_timeout(300); ok("and it works once the call is really sent",act(ANA)); done()
    # ---- H. send an IOU to a friend, who accepts
    go("new"); pg.fill("#to",BEN); pg.wait_for_timeout(400); ok("friend card shows the member read from the chain","ben" in main() and "Agent ID holder" in main())
    pg.fill("#to",CAT); pg.wait_for_timeout(300); ok("an address that has not joined is refused","not IOU Verified yet" in main())
    pg.fill("#to",BEN); pg.fill("#am","0.5"); pg.fill("#me","Lunch"); pg.get_by_role("button",name="Write the prompt for my agent").click(); pg.wait_for_timeout(400)
    ok("send an IOU to ben",act(ANA)); done(); go("me"); ok("it waits for ben to accept","To ben" in main() and "Waiting for accept" in main())
    node("call",BEN,"acceptIOU",json.dumps(["3n"])); t0=time.time()   # IOU 3: after the two shop IOUs
    while time.time()-t0<30 and "Owed to you\n1 active" not in main(): pg.wait_for_timeout(1000)   # no reload: the site's own 20-second refresh has to pick it up
    ok(f"after ben accepts, my page shows it as owed to me by itself (took {time.time()-t0:.0f}s)","Owed to you\n1 active" in main(),main()[200:700])
    # ---- I. overdue and Restricted, read from the chain
    go("mart"); tb=[x for x in pg.get_by_role("button",name="Take on credit").all() if x.is_enabled()]; tb[-1].click(); pg.wait_for_timeout(400); ok("take the 0.05 USDT loan",act(ANA)); done()
    node("call",BEN,"createIOU",json.dumps([ANA,0,"80000000000000n",5,"Bus fare"])); pg.reload(); pg.wait_for_timeout(3500); go("me",900)   # IOU 5: a friend's BNB IOU, so BNB repay is covered too
    pg.get_by_role("button",name="Accept").first.click(); pg.wait_for_timeout(400); ok("accept a friend's BNB IOU",act(ANA)); done()
    node("warp",6*86400); pg.reload(); pg.wait_for_timeout(3500); c=same("three IOUs past due"); ok("the contract says Restricted and the site shows it",c["restricted"] and "Restricted" in main())
    go("mart"); ok("Restricted: nothing can be taken",all(x.is_disabled() for x in pg.get_by_role("button",name="Take on credit").all()))
    go("me"); n0=pg.get_by_role("button",name="Repay").count(); ok("Restricted: all three overdue IOUs offer Repay",n0==3,n0)
    li=pg.locator("li",has_text="BNB").filter(has=pg.get_by_role("button",name="Repay")).first; li.get_by_role("button",name="Repay").click(); pg.wait_for_timeout(400)
    pr=pg.locator("pre.code").inner_text(); ok("BNB repay prompt carries the exact value",re.search(r"Value: 0\.00008 BNB",pr) is not None,pr[:300]); ok("repay the BNB IOU late",act(ANA)); done()
    c=same("one late repay"); ok("late repay recorded; two still past due, so still Restricted",(c["late"],c["restricted"],c["overdue"])==(1,True,True),c)
    go("me"); pg.get_by_role("button",name="Repay").first.click(); pg.wait_for_timeout(400); ok("late USDT repay, step 1",act(ANA,"step2")); ok("late USDT repay, step 2",act(ANA)); done()
    c=same("two late repays"); ok("one left past due: Restricted is lifted",(c["late"],c["restricted"],c["overdue"])==(2,False,True),c)
    go("me"); pg.get_by_role("button",name="Repay").first.click(); pg.wait_for_timeout(400); ok("last late repay, step 1",act(ANA,"step2")); ok("last late repay, step 2",act(ANA)); done()
    c=same("everything repaid"); ok("no longer overdue, three late marks stay",(c["late"],c["overdue"],c["owedCents"])==(3,False,0),c)
    ok("every shop loan came back: the shop holds exactly what it started with, and so do I",int(node("usdt",A["mart"]))==9*10**18 and int(node("usdt",ANA))==100*10**18,(node("usdt",A["mart"]),node("usdt",ANA)))
    # ---- I2. a BNB repayment that could not be delivered waits under my address, and I can collect it
    node("call",ANA,"createIOU",json.dumps([BEN,0,"200000000000000n",7,"Tea"]))   # IOU 6
    node("call",BEN,"acceptIOU",json.dumps(["6n"])); node("block",ANA,"on"); r=node("pay",BEN,"repay",json.dumps(["6"]),"0.0002"); node("block",ANA,"off")
    ok("undelivered BNB is kept under my address on-chain",r=="success" and node("credit",ANA)=="200000000000000",(r,node("credit",ANA)))
    t0=time.time()
    while time.time()-t0<30 and "is waiting for you" not in main(): pg.wait_for_timeout(1000)
    ok("My IOUs shows the waiting BNB with a Collect button","0.0002 BNB is waiting for you" in main(),main()[:400])
    pg.get_by_role("button",name="Collect it").click(); pg.wait_for_timeout(400); pr=pg.locator("pre.code").inner_text(); ok("collect prompt calls withdraw() and sends nothing","withdraw()" in pr and "Value: 0 BNB" in pr,pr[:300])
    ok("collect the waiting BNB",act(ANA)); done(); ok("nothing is left in the contract for me",node("credit",ANA)=="0"); go("me",800); ok("the notice is gone","is waiting for you" not in main())
    # ---- J. leaderboard and other profiles
    go("board"); lis=[li.inner_text() for li in pg.locator("ol.ledger > li").all()]; cb=chain(BEN); ca=chain(ANA)
    def row(name,c): t=next((x for x in lis if name in x),""); return f"Trust {c['score']}, {c['xp']} XP" in t and str(c["score"]*10+c["xp"]) in re.findall(r"\d+",t)
    ok("leaderboard: both members, with the contract's score, XP and points",len(lis)==2 and row("ana",ca) and row("ben",cb),lis)
    ok("leaderboard: higher points first",lis and ("ana" in lis[0])==(ca["score"]*10+ca["xp"]>=cb["score"]*10+cb["xp"]),lis)
    go("u-"+BEN); ok("another member's profile is readable","ben" in main() and "Member No. 000001" in main(),main()[:200])
    ok(f"a confirmed step shows up fast: {sorted(speed)[len(speed)//2]:.1f}s typical, {max(speed):.1f}s slowest of {len(speed)}",max(speed)<8,speed)
    ok("the page only ever talked to its own host and the chain",hosts<={"127.0.0.1:4175","127.0.0.1:8547"},hosts); ok("no script errors",not errs,errs[:3]); b.close()
finally:
    srv.terminate(); anvil.terminate()
print(f"\n{sum(res)} of {len(res)} live checks passed")
