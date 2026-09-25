"""Convert fish.py's numpy textures into web images and copy the models into public/."""
import sys, os, shutil, numpy as np
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for n in ['neon', 'rummy', 'angel', 'discus', 'gourami']:
    c = (np.clip(np.load(f'{src}/{n}_color.npy'), 0, 1) * 255).astype('uint8')
    Image.fromarray(c).save(f'{dst}/{n}_color.webp', quality=92, exact=True, method=6)
    m = (np.clip(np.load(f'{src}/{n}_mat.npy'), 0, 1) * 255).astype('uint8')
    Image.fromarray(m).save(f'{dst}/{n}_mat.webp', lossless=True, exact=True, method=6)
    shutil.copy(f'{src}/{n}.glb', f'{dst}/{n}.glb')
print('ok')
