import heic2any from 'heic2any';
import { resizeFrame } from './preprocess.js';

const MAX_WIDTH = 2400;

function isHeic(file) {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  return type.includes('heic') || type.includes('heif')
    || name.endsWith('.heic') || name.endsWith('.heif');
}

async function decodeToCanvas(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      const c = document.createElement('canvas');
      c.width = bmp.width;
      c.height = bmp.height;
      c.getContext('2d').drawImage(bmp, 0, 0);
      bmp.close?.();
      return c;
    } catch {
      /* fall through to Image() */
    }
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
      resolve(c);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não consegui abrir a imagem. Use JPEG ou PNG.'));
    };
    img.src = url;
  });
}

export async function loadStaticImage(file) {
  let blob = file;

  if (isHeic(file)) {
    try {
      const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
      blob = Array.isArray(converted) ? converted[0] : converted;
    } catch (err) {
      const detail = err?.message ? ` (${err.message})` : '';
      throw new Error(
        `Não consegui converter a foto HEIC${detail}. Salve como JPEG/PNG na galeria e tente de novo.`
      );
    }
  }

  const canvas = await decodeToCanvas(blob);
  return resizeFrame(canvas, MAX_WIDTH);
}
