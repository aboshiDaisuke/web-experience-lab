import sys, os, numpy as np
from PIL import Image
d = sys.argv[1]
for f in sorted(os.listdir(d)):
    if f.endswith('.npy'):
        a = np.load(os.path.join(d, f))
        im = Image.fromarray(a[..., :3])
        im.save(os.path.join(d, f[:-4] + '.webp'), quality=88, method=6)
        print(f, im.size, os.path.getsize(os.path.join(d, f[:-4] + '.webp')))
