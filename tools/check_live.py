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
    b=p.chromium.launch(executable_path="/usr/bin/google-chrome",args=["--no-sandbox"]); ctx=b.new_context(viewport={"width":390,"height":844}); ctx.add_init_script("window.__snd=0;for(const k of['createOscillator','createBufferSource']){const f=AudioContext.prototype[k];AudioContext.prototype[k]=function(){window.__snd++;return f.apply(this,arguments)}}"); pg=ctx.new_page(); errs=[]; hosts=set()
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
            if expect=="step2" and d.get_by_role("button",name="Show prompt 2 of 2").count():   # the stop screen: step 1 is on-chain, the money has not moved
                stop_ok.append("1 of 2 done" in d.inner_text() and "The money has not moved yet" in d.inner_text() and d.locator("pre.code").count()==0)
                d.get_by_role("button",name="Show prompt 2 of 2").click(); pg.wait_for_timeout(300)
                return "Step 2 of 2" in d.inner_text() and d.locator("pre.code").count()==1 and d.get_by_role("button",name="Copy prompt 2 of 2").count()==1
            if expect=="slow" and "can't see it on-chain yet" in d.inner_text(): return True
        return False
    speed=[]; stop_ok=[]
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
    go("home",1500); gc=pg.locator("[aria-label*='IOU Card']").first; gc.scroll_into_view_if_needed(); gc.click(); pg.wait_for_timeout(1200); gt=main()
    ok("guest card back shows a dash for the join date, never Jan 1970","1970" not in gt and re.search(r"Member since\s*—",gt) is not None,gt[gt.find("Member since"):][:60])
    ok("the page names a share image for X and the icons",pg.evaluate("[document.querySelector('meta[property=\"og:image\"]')?.content, document.querySelector('meta[name=\"twitter:image\"]')?.content, !!document.querySelector('link[rel=apple-touch-icon]'), !!document.querySelector('link[href$=\"favicon.ico\"]')]")==["https://agentiou.pages.dev/og.png","https://agentiou.pages.dev/og.png",True,True])
    go("me"); ok("guest: My IOUs says to get IOU Verified first, and never says prove or connect a wallet","Get IOU Verified first" in main() and "Prove your wallet" not in main() and "no wallet connection" in main(),main()[:300])
    node("join",BEN,"ben")   # another member joins first, so member numbers can be checked
    keys=lambda: sorted(k for k in pg.evaluate("Object.keys(localStorage)") if k.startswith("agentiou.") and k not in ("agentiou.sound","agentiou.reduce"))
    guest=lambda: pg.locator("header").get_by_role("link",name="Get IOU Verified").count()==1 and pg.locator("header").get_by_role("link",name=re.compile("^Profile:")).count()==0
    def to_step4():
        go("start")
        for _ in range(3): pg.get_by_role("button",name="I did this").first.click(); pg.wait_for_timeout(150)
    def ask_for(addr):   # type the address, ask for the signing prompt, return the request the wallet is asked to sign
        pg.fill("#aw",addr); pg.get_by_role("button",name="Prove this wallet is mine").click(); pg.wait_for_timeout(300)
        return re.search(r'^(\{"method":"eth_signTypedData_v4".*\})$',pg.locator("pre.code").inner_text(),re.M).group(1)
    def paste(answer):
        pg.fill("#sg",answer); b=pg.get_by_role("button",name="Check the signature")
        if b.is_enabled(): b.click()
        pg.wait_for_timeout(3500)
    # ---- B. a profile is never "mine" without a signature from its wallet
    pg.reload(); pg.wait_for_timeout(3500); go("tasks"); pg.fill("#see",BEN); pg.get_by_role("button",name="Show").click(); pg.wait_for_timeout(500); t=main()
    ok("Task Hub lookup shows a member's public numbers, marked viewing only","Viewing only" in t and "ben" in t and re.search(r"50\s*XP",t) is not None,t[:400])
    ok("the lookup saves nothing and the visitor stays a guest",keys()==[] and guest(),keys())
    to_step4(); pg.fill("#aw","not an address"); ok("a wrong address cannot be used",pg.get_by_role("button",name="Prove this wallet is mine").is_disabled())
    req=ask_for(BEN); body=json.loads(json.loads(req)["params"][1])
    ok("the signing prompt says it is a signature only and names this device and an expiry","signature only: no transaction, no transfer, no approval" in pg.locator("pre.code").inner_text() and body["message"]["wallet"].lower()==BEN.lower() and re.fullmatch(r"[A-Z2-7]{4}-[A-Z2-7]{4}",body["message"]["device"]) is not None and int(body["message"]["expires"])-int(body["message"]["issued"])==900 and set(x["name"] for x in body["types"]["Proof"])=={"statement","wallet","device","issued","expires"},body)
    ok("typing a member's address and asking is not enough: still a guest, no address kept as mine",guest() and "agentiou.me" not in keys() and "agentiou.proof" not in keys(),keys())
    paste("my agent said: done!"); ok("no signature pasted: refused",pg.get_by_role("button",name="Check the signature").is_disabled() and guest())
    paste(node("sign",ANA,req)); ok("a signature from another wallet is refused","not from this wallet" in main() and guest() and "agentiou.me" not in keys(),main()[-300:])
    other=json.loads(req); m=json.loads(other["params"][1]); m["message"]["device"]="AAAA-BBBB"; other["params"][1]=json.dumps(m)
    paste(node("sign",BEN,json.dumps(other))); ok("the right wallet's signature for another device is refused","not from this wallet" in main() and guest(),main()[-300:])
    pg.evaluate("(()=>{const n=Date.now.bind(Date);Date.now=()=>n()+16*60*1000})()")   # sixteen minutes pass on this device
    paste(node("sign",BEN,req)); ok("a request that has run out is refused, even with the right signature","ran out" in main() and guest(),main()[-300:])
    pg.get_by_role("button",name="Start again").click(); pg.wait_for_timeout(300)
    # an address that holds no Agent ID proves itself, and the site warns before any prompt
    req=ask_for(CAT); rc=node("sign",CAT,req); hc=re.search(r"([0-9a-fA-F]{128})",rc).group(1); paste("Done.\nAGENTIOU-PROOF "+hc[:40]+"\u200b"+hc[40:90]+"\u00ad"+hc[90:]+" "+re.search(r"signatureRecovery:\s*(\d\d)",rc).group(1))   # the one-line form the prompt asks for, with invisible characters a copy can add inside the code
    ok("the wallet's own signature is accepted, even with invisible characters inside the code","Proved on this device" in main() and CAT in main(),main()[-400:])
    ok("address without an Agent ID: the site warns before any prompt","has no Agent ID yet" in main(),main()[-400:])
    # someone edits the browser storage to point the kept proof at another member
    pg.evaluate("(()=>{const p=JSON.parse(localStorage.getItem('agentiou.proof'));p.wallet=%r;localStorage.setItem('agentiou.proof',JSON.stringify(p));localStorage.setItem('agentiou.me',%r)})()" % (BEN,BEN))
    pg.reload(); pg.wait_for_timeout(4500); ok("a kept proof pointed at another wallet does not hold: forgotten, guest again",guest() and keys() in (["agentiou.device"],[]),keys())
    to_step4(); req=ask_for(CAT); paste(node("sign",CAT,req)); pg.get_by_role("button",name="Use a different address").click(); pg.wait_for_timeout(2500)
    ok("the proved wallet can be forgotten","agentiou.me" not in keys() and "agentiou.proof" not in keys() and guest(),keys())
    # ---- C. join
    to_step4(); req=ask_for(ANA.lower()); raw=node("sign",ANA,req); h=re.search(r"([0-9a-fA-F]{128})",raw).group(1)
    ok("the signing prompt asks the agent for one plain line to copy","AGENTIOU-PROOF <signature> <signatureRecovery>" in pg.locator("pre.code").inner_text() and "no code block" in pg.locator("pre.code").inner_text())
    paste("Signature from order 4b16d500084b487e8e78867ec7118d6b (status COMPLETED):\n\n\n\nsignatureRecovery: 005b9b6\n\nSigned by wallet "+ANA+" for the AgentIOU Proof typed data on chain ID 56, valid 1795420320-1795421220 (15 minutes). No transaction, transfer, or approval was involved.")
    ok("an answer copied without its code box: the site says to copy the box, and stays a guest","copy that box" in main() and guest(),main()[-300:])
    paste("Signature code\n"+h[:43]+"\n"+h[43:86]+"\n"+h[86:]+"\nsignatureRecovery: 005b9b6")   # a copied code box, broken over three lines
    ok("address with an Agent ID is recognised","Holds an Agent ID" in main(),main()[-300:])
    ok("the device keeps only the address, its proof and a device code",keys()==["agentiou.device","agentiou.me","agentiou.proof"],keys())
    kept=pg.evaluate("[localStorage.getItem('agentiou.me'),localStorage.getItem('agentiou.proof')]")
    pg.fill("#nn","ana"); pg.get_by_role("button",name="Get IOU Verified").last.click(); pg.wait_for_timeout(400)
    ok("join: prompt sent as written, the card finishes when the chain shows it",act(ANA)); done()
    ok("after joining: header shows the profile, no join button",pg.locator("header").get_by_role("link",name="Profile: ana").count()==1 and pg.locator("header").get_by_role("link",name="Get IOU Verified").count()==0)
    go("me"); ok("member numbers follow joining order (ben 1, ana 2)","Member No. 000002" in main(),main()[:200]); c=same("after join"); ok("join gives 50 XP, L1, $1",(c["xp"],c["level"],c["limitCents"])==(50,1,100))
    pg.reload(); pg.wait_for_timeout(3000); ok("after a reload the visitor is still a member, not a guest",pg.locator("header").get_by_role("link",name="Profile: ana").count()==1 and "Guest" not in main())
    # ---- D. take on credit
    go("mart"); pg.get_by_role("button",name="Take on credit").first.click(); pg.wait_for_timeout(400)
    pr=pg.locator("pre.code").inner_text(); ok("the loan prompt says what arrives, from whom, and that nothing leaves my wallet","lends me 0.01 USDT from the shop ("+A["mart"] in pr and "within 1 day." in pr and "Nothing leaves my wallet" in pr,pr[:400])
    u0=int(node("usdt",ANA)); m0=int(node("usdt",A["mart"]))
    ok("take the 0.01 USDT loan",act(ANA)); done(); c=same("after taking an offer"); ok("the IOU is on the chain: 1 cent owed",c["owedCents"]==1)
    ok("the shop's 0.01 USDT really arrived in my wallet, and left the shop's",int(node("usdt",ANA))-u0==10**16 and m0-int(node("usdt",A["mart"]))==10**16,(int(node("usdt",ANA))-u0,))
    go("mart"); ok("stock went down on the shop page","99 of 100" in main() and "Sticker in your profile" in main())
    # ---- E. repay USDT in two steps
    go("me"); pg.get_by_role("button",name="Repay").first.click(); pg.wait_for_timeout(400)
    ok("repay step 1: the card moves to step 2 only when the approval is on-chain",act(ANA,"step2"))
    ok("between the two prompts a stop screen says 1 of 2 done and that the money has not moved; prompt 2 shows only after a tap",len(stop_ok)==1 and all(stop_ok),stop_ok)
    ok("repay step 2: finished when the repayment is on-chain",act(ANA)); done()
    c=same("after an on-time repay"); ok("on-time repay of a 1-day loan: XP 120 (50 + 30 + first-repay badge 25 + new person 15; no early bonus, a 1-day loan can never be 24 hours early), score 57, nothing owed",(c["xp"],c["score"],c["owedCents"],c["onTime"])==(120,57,0,1),c)
    ok("the shop has its money back and earned nothing",int(node("usdt",A["mart"]))==m0 and int(node("usdt",ANA))==u0)
    go("mart",1200); ok("the repaid loan is back in stock, and I keep the sticker",main().count("100 of 100")==3 and "Sticker in your profile" in main(),main()[:300])
    # ---- E2. a shop with no lending money left
    node("shop","0"); pg.reload(); pg.wait_for_timeout(3500); go("mart",900)
    ok("shop out of funds: the site says so and writes no prompt","The shop has no USDT to lend right now" in main() and all(x.is_disabled() for x in pg.get_by_role("button",name="Take on credit").all()))
    node("shop","9"); pg.reload(); pg.wait_for_timeout(3500); go("mart",900); ok("shop funded again: offers open",any(x.is_enabled() for x in pg.get_by_role("button",name="Take on credit").all()))
    # ---- F. check-in, claim, mint
    go("tasks"); pg.get_by_role("button",name="Check in").click(); pg.wait_for_timeout(400); ok("daily check-in",act(ANA)); done(); c=same("after check-in"); ok("check-in: +5 XP, day 1",(c["xp"],c["checkDays"])==(125,1))
    go("tasks"); ok("check-in is off for the rest of the day",pg.get_by_role("button",name="Come back tomorrow").is_disabled())
    pg.get_by_role("button",name=re.compile("^Claim")).first.click(); pg.wait_for_timeout(400); ok("claim a Common voucher",act(ANA)); done(); ok("voucher is in the pocket on-chain",chain(ANA)["pocket"][0]==1)
    go("tasks"); mint=[x for x in pg.get_by_role("button",name=re.compile("^Mint")).all() if x.is_enabled()]
    ok("a Common stamp can now be minted",len(mint)>=1)
    if mint: mint[0].click(); pg.wait_for_timeout(400); ok("mint with the voucher",act(ANA)); done(); ok("voucher used on-chain",chain(ANA)["pocket"][0]==0)
    # ---- G. the visitor says "confirmed" but never sent it
    go("mart"); pg.get_by_role("button",name="Borrow again").first.click(); pg.wait_for_timeout(400)
    pr=pg.locator("pre.code").inner_text(); late=(re.search(r"Call contract (0x[0-9a-fA-F]{40})",pr).group(1), re.search(r"^Calldata: (0x[0-9a-fA-F]+)$",pr,re.M).group(1), re.search(r"Value: ([\d.]+) BNB",pr).group(1))
    ok("sound is on for a first-time visitor",pg.evaluate("localStorage.getItem('agentiou.sound')") is None and pg.get_by_role("button",name="Turn sound off").count()>=1)
    ok("opening the card made a sound",pg.evaluate("window.__snd")>0)
    pg.get_by_role("button",name="I confirmed in my agent").click(); pg.wait_for_timeout(1500); snd0=pg.evaluate("window.__snd")
    ok("while it waits, the visitor can go straight back to the prompt",pg.get_by_role("button",name=re.compile("back to the prompt")).count()==1)
    t0=time.time(); slow=False
    while time.time()-t0<70 and not slow: pg.wait_for_timeout(500); slow="can't see it on-chain yet" in pg.locator("[role=dialog]").inner_text()
    ok(f"nothing sent: the card does not pretend, it says it cannot see it (after {time.time()-t0+1.5:.0f}s)",slow and time.time()-t0<50)
    ok("no sound at all while the card waits",pg.evaluate("window.__snd")==snd0,f"{pg.evaluate('window.__snd')-snd0} sounds")
    ok("nothing changed on-chain",chain(ANA)["owedCents"]==0)
    # the visitor was slow in the agent app: the call lands minutes later, and nobody presses anything on the card
    r=node("send",ANA,*late); t0=time.time(); fin=False
    while time.time()-t0<20 and not fin: pg.wait_for_timeout(500); fin=pg.locator("[role=dialog]").get_by_role("button",name="Done").count()==1
    ok(f"sent late: the card keeps looking and finishes by itself (in {time.time()-t0:.0f}s)",r=="success" and fin); done()
    # ---- H. send an IOU to a friend, who accepts
    go("new"); pg.fill("#to",BEN); pg.wait_for_timeout(400); ok("friend card shows the member read from the chain","ben" in main() and "Agent ID holder" in main())
    pg.fill("#to",CAT); pg.wait_for_timeout(300); ok("an address that has not joined is refused","not IOU Verified yet" in main())
    pg.fill("#to",BEN); pg.fill("#am","0.5"); pg.fill("#me","Lunch"); pg.get_by_role("button",name="Write the prompt for my agent").click(); pg.wait_for_timeout(400)
    ok("send an IOU to ben",act(ANA)); done(); go("me"); ok("it waits for ben to accept","To ben" in main() and "Waiting for accept" in main())
    node("call",BEN,"acceptIOU",json.dumps(["3n"])); t0=time.time()   # IOU 3: after the two shop IOUs
    while time.time()-t0<30 and "Owed to you\n1 active" not in main(): pg.wait_for_timeout(1000)   # no reload: the site's own 20-second refresh has to pick it up
    ok(f"after ben accepts, my page shows it as owed to me by itself (took {time.time()-t0:.0f}s)","Owed to you\n1 active" in main(),main()[200:700])
    # ---- I. overdue and Restricted, read from the chain
    go("mart",1200); tb=pg.locator("main").get_by_role("button",name=re.compile("^(Take on credit|Borrow again)$"))
    ok("two shop loans taken today: the third is off, with the reason",all(x.is_disabled() for x in tb.all()) and "You have taken 2 shop loans today" in main(),main()[:300])
    ok("borrowing the same offer twice gave one sticker",main().count("Sticker in your profile")==1)
    node("warp",86400); pg.reload(); pg.wait_for_timeout(3500); go("mart",1200)   # the next day on the chain's own calendar
    tb=[x for x in pg.get_by_role("button",name="Take on credit").all() if x.is_enabled()]; ok("next day the offers are open again",len(tb)>=1); tb[-1].click(); pg.wait_for_timeout(400); ok("take the 0.05 USDT loan",act(ANA)); done()
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
    go("me",1200); t=main(); lab=pg.locator("[aria-label*='IOU Card']").first.get_attribute("aria-label")
    ok("My IOUs: nothing owed, full limit free again","You owe\n0 active" in t and "Available $1.00 of $1 limit" in lab,(t[t.find("You owe"):t.find("You owe")+40],lab))
    ok("History counts every loan with its outcome: 1 on time, 3 late","1 repaid on time, 3 late, 0 declined or cancelled" in t,t[t.find("History"):t.find("History")+140])
    go("mart",1200); t=main(); ok("shop figures: nothing out on loan, 3 shop loans paid back for $0.07","Out on loan now\n0" in t and re.search(r"Loans paid back\s*3\s*\(\$0\.07\)",t) is not None and t.count("100 of 100")==3,t[t.find("Shop wallet"):t.find("Shop wallet")+160])
    go("u-"+ANA,1200); t=main(); ok("my public record lists the same four finished IOUs",t.count("Repaid late")+t.count("Repaid\n")>=4 or len(re.findall(r"Repaid",t))>=4,t[t.find("Promise record"):t.find("Promise record")+200])
    ok("every shop loan came back: the shop holds exactly what it started with, and so do I",int(node("usdt",A["mart"]))==9*10**18 and int(node("usdt",ANA))==100*10**18,(node("usdt",A["mart"]),node("usdt",ANA)))
    # ---- I2. a BNB repayment that could not be delivered waits under my address, and I can collect it
    node("call",ANA,"createIOU",json.dumps([BEN,0,"200000000000000n",7,"Tea"]))   # IOU 6
    node("call",BEN,"acceptIOU",json.dumps(["6n"])); node("block",ANA,"on"); r=node("pay",BEN,"repay",json.dumps(["6"]),"0.0002"); node("block",ANA,"off")
    ok("undelivered BNB is kept under my address on-chain",r=="success" and node("credit",ANA)=="200000000000000",(r,node("credit",ANA)))
    go("me",900); t0=time.time()
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
    c2=b.new_context(viewport={"width":390,"height":844}); p2=c2.new_page(); p2.goto(U+"home"); p2.wait_for_timeout(1500)
    p2.evaluate("([m,pr])=>{localStorage.setItem('agentiou.me',m);localStorage.setItem('agentiou.proof',pr);localStorage.setItem('agentiou.device','ZZZZ-2222')}",kept); p2.reload(); p2.wait_for_timeout(4000)
    ok("the address and its proof copied to another device do not open the profile there",p2.locator("header").get_by_role("link",name="Get IOU Verified").count()==1 and p2.locator("header").get_by_role("link",name=re.compile("^Profile:")).count()==0); c2.close()
    ok("the page only ever talked to its own host and the chain",hosts<={"127.0.0.1:4175","127.0.0.1:8547"},hosts); ok("no script errors",not errs,errs[:3]); b.close()
finally:
    srv.terminate(); anvil.terminate()
print(f"\n{sum(res)} of {len(res)} live checks passed")
