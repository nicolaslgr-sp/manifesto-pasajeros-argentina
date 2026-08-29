import heic2any from 'heic2any';
import { resizeFrame } from './preprocess.js';

export async function loadStaticImage(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  let blob = file;
  if (type.includes('heic') || type.includes('heif') || name.endsWith('.heic') || name.endsWith('.heif')) {
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    blob = Array.isArray(converted) ? converted[0] : converted;
  }

  if (window.createImageBitmap) {
    const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    const c = document.createElement('canvas');
    c.width = bmp.width;
    c.height = bmp.height;
    c.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close?.();
    return resizeFrame(c);
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(resizeFrame(c));
    };
    img.onerror = reject;
    img.src = url;
  });
}
