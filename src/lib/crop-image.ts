export type Area = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  outputWidth?: number,
  outputHeight?: number
): Promise<File> {
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('No 2d context');
  }

  const width = outputWidth || pixelCrop.width;
  const height = outputHeight || pixelCrop.height;

  canvas.width = width;
  canvas.height = height;

  // Draw cropped area resized to target width x height
  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    width,
    height
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        const file = new File([blob], `crop-${Date.now()}.jpg`, {
          type: 'image/jpeg',
        });
        resolve(file);
      },
      'image/jpeg',
      0.9
    );
  });
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}
