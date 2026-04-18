import os
import urllib.request
import time

pieces = {
    'wp': 'https://upload.wikimedia.org/wikipedia/commons/4/45/Chess_plt45.svg',
    'wn': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Chess_nlt45.svg',
    'wb': 'https://upload.wikimedia.org/wikipedia/commons/b/b1/Chess_blt45.svg',
    'wr': 'https://upload.wikimedia.org/wikipedia/commons/7/72/Chess_rlt45.svg',
    'wq': 'https://upload.wikimedia.org/wikipedia/commons/1/15/Chess_qlt45.svg',
    'wk': 'https://upload.wikimedia.org/wikipedia/commons/4/42/Chess_klt45.svg',
    'bp': 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Chess_pdt45.svg',
    'bn': 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Chess_ndt45.svg',
    'bb': 'https://upload.wikimedia.org/wikipedia/commons/9/98/Chess_bdt45.svg',
    'br': 'https://upload.wikimedia.org/wikipedia/commons/f/ff/Chess_rdt45.svg',
    'bq': 'https://upload.wikimedia.org/wikipedia/commons/4/47/Chess_qdt45.svg',
    'bk': 'https://upload.wikimedia.org/wikipedia/commons/f/f0/Chess_kdt45.svg'
}

os.makedirs('pieces', exist_ok=True)
req = urllib.request.Request
for name, url in pieces.items():
    print(f"Downloading {name}...")
    request = req(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(request) as response, open(f"pieces/{name}.svg", 'wb') as out_file:
        out_file.write(response.read())
    time.sleep(1)
print("Done.")
