import sys
from PIL import Image
out, names = sys.argv[1], sys.argv[2:]
ims = [Image.open(f"shots/{n}.png").convert("RGB") for n in names]
w = 900 if len(ims) > 1 else 1440
ims = [i.resize((w, round(i.height * w / i.width)), Image.LANCZOS) for i in ims]
cols = 2 if len(ims) > 1 else 1
rows = (len(ims) + cols - 1) // cols
rh = [max(i.height for i in ims[r * cols:(r + 1) * cols]) for r in range(rows)]
sh = Image.new("RGB", (cols * w + (cols - 1) * 12, sum(rh) + 12 * (rows - 1)), (255, 0, 120))
for k, i in enumerate(ims):
    sh.paste(i, ((k % cols) * (w + 12), sum(rh[:k // cols]) + 12 * (k // cols)))
sh.save(f"shots/{out}.jpg", quality=88); print(sh.size)
