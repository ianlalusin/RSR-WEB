/**
 * Client-side image compression. Downscales/recompresses an image File to a
 * JPEG Blob at or below `maxBytes`, so uploads stay small and storage rules can
 * keep a tight size cap. Mirrors the approach used by the SocMed proof upload.
 *
 * Browser-only (uses FileReader / canvas). Throws on non-image input.
 */
export const ONE_MB = 1024 * 1024;

export async function compressImageToBlob(file: File, maxBytes = ONE_MB): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please upload an image file (photo or scan of the ID).');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error || new Error('Failed to read file.'));
    r.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Could not load the selected image.'));
    i.src = dataUrl;
  });

  let scale = 1;
  let quality = 0.9;
  for (let attempt = 0; attempt < 10; attempt++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported on this device.');
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', quality));
    if (!blob) throw new Error('Could not encode the image.');
    if (blob.size <= maxBytes) return blob;
    if (quality > 0.45) quality -= 0.15;
    else {
      scale *= 0.85;
      quality = 0.85;
    }
  }
  throw new Error('Could not compress the image below 1 MB. Try a smaller or clearer photo.');
}
