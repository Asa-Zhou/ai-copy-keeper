import zlib, struct, math, base64, os

W = H = 64
MARGIN = 2
R = 14

def sd_rrect(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    ax = max(qx, 0.0); ay = max(qy, 0.0)
    return math.hypot(ax, ay) + min(max(qx, qy), 0.0) - r

def clamp01(v):
    return 0.0 if v < 0 else (1.0 if v > 1 else v)

def lerp(a, b, t):
    return a + (b - a) * t

# 4 条“文本行”
lines = [
    (10, 44, 14, 5),
    (10, 54, 26, 5),
    (10, 50, 38, 5),
    (10, 34, 50, 5),
]

rows = bytearray()
cx_bg = cy_bg = W / 2
hw = hh = W / 2 - MARGIN

for y in range(H):
    row = bytearray()
    row.append(0)
    for x in range(W):
        d = sd_rrect(x + 0.5, y + 0.5, cx_bg, cy_bg, hw, hh, R)
        a_bg = clamp01(0.5 - d)
        t = (x + y) / (2.0 * W)
        r = lerp(79, 37, t)
        g = lerp(140, 99, t)
        b = lerp(247, 235, t)
        alpha = a_bg
        for (x0, x1, cy, h) in lines:
            cx = (x0 + x1) / 2
            d2 = sd_rrect(x + 0.5, y + 0.5, cx, cy, (x1 - x0) / 2, h / 2, h / 2)
            a2 = clamp01(0.5 - d2)
            if a2 > 0:
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

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
with open(os.path.join(ROOT, 'electron', 'resources', 'tray.png'), 'wb') as f:
    f.write(png)

b64 = base64.b64encode(png).decode('ascii')
print('BYTES', len(png), 'B64', len(b64))
print(b64)
