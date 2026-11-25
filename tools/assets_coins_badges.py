"""Second asset pass: metallic coins for the Promise stamps, and the approved badge drawings as a data file."""
import sys, re, json
import numpy as np, scipy.ndimage as ndi
from PIL import Image, ImageDraw
sys.path.insert(0, "/home/claude/cards_v1"); sys.path.insert(0, "/home/claude/agentiou/tools")
from eyes import add_face
import mockup as M
exec(open("assets.py").read().split("# 1. mascot poses")[0].split("meta = {}")[1])   # reuse clean_cells
names = ["hello", "on-it", "noted", "stamped", "checked", "cloud-nap", "good-for-one", "paid-in-full", "kept-my-word"]
faces = [("happy", "bigsmile"), ("tall", "smile"), ("down", None), ("content", "smile"), ("wink", "smile"), ("content", None), ("happy", "open"), ("sparkle", "bigsmile"), ("happy", "open")]
cards = clean_cells(Image.open("/home/claude/cards_v1/card_B.png").convert("RGBA"), 3, 3)
for n, c, (e, mo) in zip(names, cards, faces):
    c = add_face(c, e, mo, band=(0.12, 0.68)); W, H = c.size
    r = 0.325 * W; cx, cy = 0.5 * W, 0.405 * H
    coin = c.crop((round(cx - r), round(cy - r), round(cx + r), round(cy + r)))
    S = coin.size[0]; mask = Image.new("L", (S * 2, S * 2), 0); ImageDraw.Draw(mask).ellipse([2, 2, S * 2 - 3, S * 2 - 3], fill=255)
    coin.putalpha(mask.resize(coin.size, Image.LANCZOS)); coin = coin.resize((420, 420), Image.LANCZOS)
    coin.save(f"../web/public/img/coin-{n}.webp", quality=88, method=6)
svgs = open("/home/claude/opts/old_badges.txt").read().split("=====")
pick = {"IOU Verified": svgs[5], "First Promise": svgs[2], "Trusted": svgs[3], "Highly Trusted": svgs[4]}
out = {}
for k, v in pick.items():
    v = v.strip(); vb = re.search(r'viewBox="([^"]+)"', v).group(1); inner = v[v.index(">") + 1:v.rindex("</svg>")]
    inner = inner.replace("#F2B90F", "#FFB23F").replace("Space Grotesk,sans-serif", "Atkinson Hyperlegible Next,sans-serif").replace("font-weight:700", "font-weight:800")
    out[k] = {"vb": vb, "svg": inner}
open("../web/src/data/badges.json", "w").write(json.dumps(out))
print("coins", len(names), "badges", list(out))
