"""Cut the generated sheets into site images (WebP) and measure where code-drawn parts go.
Run: python3 assets.py  -> ../web/public/img/* and ../web/src/data/assets.json"""
import json, sys, os
import numpy as np, scipy.ndimage as ndi
from PIL import Image
sys.path.insert(0, "/home/claude/cards_v1")
from eyes import add_face, find_visor
import mockup as M
OUT = "../web/public/img/"; os.makedirs(OUT, exist_ok=True)
meta = {}

def clean_cells(im, cols, rows):
    """Grid cells cropped to their content, without slivers of the neighbouring cell."""
    W, H = im.size; out = []
    for r in range(rows):
        for c in range(cols):
            cell = im.crop((c * W // cols, r * H // rows, (c + 1) * W // cols, (r + 1) * H // rows))
            a = np.asarray(cell).copy()
            lab, n = ndi.label(a[..., 3] > 40)
            edge = set(lab[0]) | set(lab[-1]) | set(lab[:, 0]) | set(lab[:, -1])
            sizes = ndi.sum(a[..., 3] > 40, lab, range(1, n + 1))
            big = int(np.argmax(sizes)) + 1
            for k in edge:
                if k and k != big:
                    a[lab == k] = 0
            cell = Image.fromarray(a)
            out.append(cell.crop(cell.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()))
    return out
M.cells = clean_cells

def save(im, name, h, q=86):
    im = im.resize((max(1, round(im.width * h / im.height)), h), Image.LANCZOS)
    im.save(OUT + name + ".webp", quality=q, method=6)
    return im.size

def visor_meta(im, band):
    m, ex, ey, uw, vh = find_visor(im, band)
    W, H = im.size
    return {"cx": round(m[0] / W, 4), "cy": round(m[1] / H, 4), "w": round(uw / W, 4), "h": round(vh / W, 4),
            "rot": round(float(np.degrees(np.arctan2(ex[1], ex[0]))), 2), "ar": round(W / H, 4)}

# 1. mascot poses (variant B), blank visor: the site draws the face live
poses = ["wave", "card", "stamp", "search", "rest", "jump", "ticket", "coin", "read"]
bands = {"card": (0.05, 0.42), "stamp": (0.05, 0.5), "coin": (0.05, 0.42), "read": (0.05, 0.5), "search": (0.05, 0.75)}
cells = M.cells(Image.open("/home/claude/mascot_v3/12327c5e-88df-45fe-a738-a95087014958.png").convert("RGBA"), 3, 3)
meta["mascot"] = {}
for name, c in zip(poses, cells):
    v = visor_meta(c, bands.get(name, (0.05, 0.8)))
    save(c, "mascot-" + name, 560)
    meta["mascot"][name] = v

# 2. Season 1 collector cards (variant B), face baked in, label box measured for the code-set text
names = ["hello", "on-it", "noted", "stamped", "checked", "cloud-nap", "good-for-one", "paid-in-full", "kept-my-word"]
faces = [("happy", "bigsmile"), ("tall", "smile"), ("down", None), ("content", "smile"), ("wink", "smile"),
         ("content", None), ("happy", "open"), ("sparkle", "bigsmile"), ("happy", "open")]
cards = M.cells(Image.open("/home/claude/cards_v1/card_B.png").convert("RGBA"), 3, 3)
meta["cards"] = {}
for name, c, (e, mo) in zip(names, cards, faces):
    x0, y0, x1, y1 = M.label_box(c)
    W, H = c.size
    meta["cards"][name] = {"l": round(x0 / W, 4), "t": round(y0 / H, 4), "r": round(1 - x1 / W, 4), "b": round(1 - y1 / H, 4), "ar": round(W / H, 4)}
    save(add_face(c, e, mo, band=(0.12, 0.68)), "card-" + name, 640)

# 3. voucher tickets (variant A), face baked in
tix = M.cells(Image.open("/home/claude/cards_v1/ticket_A.png").convert("RGBA"), 3, 1)
meta["tickets"] = {}
for name, t, (e, mo) in zip(["common", "rare", "legendary"], tix, [("happy", "bigsmile"), ("tall", "smile"), ("sparkle", "bigsmile")]):
    meta["tickets"][name] = {"ar": round(t.width / t.height, 4)}
    save(add_face(t, e, mo, band=(0.30, 0.72)), "ticket-" + name, 720)

# 4. floating jelly things
jl = M.cells(Image.open("/home/claude/stickers_v1/jelly_A.png").convert("RGBA"), 3, 3)
meta["jelly"] = {}
for name, j in zip(["drop", "cloud", "star", "coin", "ticket", "stamp", "envelope", "plane", "cube"], jl):
    meta["jelly"][name] = {"ar": round(j.width / j.height, 4)}
    save(j, "jelly-" + name, 220, 82)

# 5. Founders stickers for Promise Mart (die-cut sheet), face baked in
st = M.cells(Image.open("/home/claude/stickers_v1/sticker_A.png").convert("RGBA"), 3, 3)
meta["founders"] = {}
for name, i, (e, mo) in [("founder-wave", 0, ("happy", "bigsmile")), ("founder-search", 4, ("wink", "smile")), ("founder-jump", 8, ("sparkle", "bigsmile"))]:
    meta["founders"][name] = {"ar": round(st[i].width / st[i].height, 4)}
    save(add_face(st[i], e, mo, band=(0.08, 0.7)), name, 480)

# 6. Credit Pass pictures
for n in ("bg_bokeh", "bg_aurora"):
    Image.open("/home/claude/pass_v3/" + n + ".jpg").convert("RGB").save(OUT + n.replace("bg_", "pass-") + ".webp", quality=80)
os.makedirs("../web/src/data", exist_ok=True)
json.dump(meta, open("../web/src/data/assets.json", "w"), indent=1)
print(json.dumps(meta["mascot"], indent=0))
