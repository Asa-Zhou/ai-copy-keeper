import zlib, struct, math, os

W = H = 256
# 输出到 electron/resources，供 electron-builder 生成 exe 图标
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'electron', 'resources')
os.makedirs(OUT, exist_ok=True)

def sd_rrect(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    ax = max(qx, 0.0)
    ay = max(qy, 0.0)
    return math.hypot(ax, ay) + min(max(qx, qy), 0.0) - r

def clamp01(v):
    return 0.0 if v < 0 else (1.0 if v > 1 else v)

def lerp(a, b, t):
    return a + (b - a) * t

# 背景：圆角方块 + 对角渐变
bg_cx = bg_cy = W / 2
bg_hw = bg_hh = W / 2 - 8
bg_r = 58

# 前景：几条“文本行”，模拟 markdown 排版
lines = [
    (48, 176, 66, 19),   # x0, x1, cy, h
    (48, 208, 106, 19),
    (48, 160, 146, 19),
    (48, 118, 186, 19),
]

rows = bytearray()
for y in range(H):
    row = bytearray()
    row.append(0)  # filter type
    for x in range(W):
        # 背景
        d = sd_rrect(x + 0.5, y + 0.5, bg_cx, bg_cy, bg_hw, bg_hh, bg_r)
        a_bg = clamp01(0.5 - d)
        t = (x + y) / (2.0 * W)
        r = lerp(79, 37, t)
        g = lerp(140, 99, t)
        b = lerp(247, 235, t)
        alpha = a_bg
        # 前景横线
        for (x0, x1, cy, h) in lines:
            cx = (x0 + x1) / 2
            hw = (x1 - x0) / 2
            d2 = sd_rrect(x + 0.5, y + 0.5, cx, cy, hw, h / 2, h / 2)
            a2 = clamp01(0.5 - d2)
            if a2 > 0:
                # 白色与当前颜色混合
                r = lerp(r, 255, a2)
                g = lerp(g, 255, a2)
                b = lerp(b, 255, a2)
                alpha = max(alpha, a2 * a_bg)
        row += bytes((int(r + 0.5), int(g + 0.5), int(b + 0.5), int(alpha * 255 + 0.5)))
    rows += row

def chunk(tag, data):
    return (struct.pack('>I', len(data)) + tag + data +
            struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff))

png = b'\x89PNG\r\n\x1a\n'
png += chunk(b'IHDR', struct.pack('>IIBBBBB', W, H, 8, 6, 0, 0, 0))
png += chunk(b'IDAT', zlib.compress(bytes(rows), 9))
png += chunk(b'IEND', b'')

path = os.path.join(OUT, 'icon.png')
with open(path, 'wb') as f:
    f.write(png)
print('written', path, len(png), 'bytes')
