// frontend/src/utils/canvasUtils.js

export const createImage = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous'); 
    image.src = url;
  });

export function getCroppedImg(image, crop) {
  const canvas = document.createElement('canvas');
  
  // 1. ÖLÇEKLEME (Sadece resmin kendi boyutuna göre, ekrana göre değil)
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;
  
  // DÜZELTME: pixelRatio'yu kaldırdık. 
  // Artık senin ekranın 4K da olsa resim orijinal boyutunda (veya kırpılan boyutta) kalacak.
  
  canvas.width = Math.floor(crop.width * scaleX);
  canvas.height = Math.floor(crop.height * scaleY);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // DÜZELTME: ctx.scale() kaldırdık.
  ctx.imageSmoothingQuality = 'high';

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  const centerX = image.naturalWidth / 2;
  const centerY = image.naturalHeight / 2;

  ctx.save();

  // 2. ÇİZİM
  ctx.translate(-cropX, -cropY);
  ctx.drawImage(
    image,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight,
    0,
    0,
    image.naturalWidth,
    image.naturalHeight
  );

  ctx.restore();

  // 3. ÇIKTI (Dosya Boyutu Optimizasyonu)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        // Blob ismini belirle
        // Dosya uzantısını jpg yapıyoruz
        blob.name = 'cropped.jpg';
        resolve(blob);
      },
      'image/jpeg',
      0.80 // DÜZELTME: Kaliteyi 0.95'ten 0.80'e çektik. Gözle görülmez ama dosya boyutu yarıya iner.
    );
  });
}