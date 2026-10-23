
export async function compressImage(
  file: File,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<File> {

  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }

  if (file.size < 250 * 1024 && (file.type === "image/webp" || file.type === "image/jpeg")) {
    return file;
  }

  const maxDimension = options.maxDimension ?? 1600;
  const quality = options.quality ?? 0.82;

  try {
    const bitmap = await createImageBitmap(file).catch(async () => {

      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("image_decode_failed"));
        };
        img.src = url;
      });
    });

    const origWidth = bitmap.width;
    const origHeight = bitmap.height;

    let width = origWidth;
    let height = origHeight;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bitmap, 0, 0, width, height);

    if ("close" in bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/webp", quality);
    });

    if (!blob) return file;

    if (blob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}.webp`, {
      type: "image/webp",
      lastModified: Date.now(),
    });
  } catch (err) {
    // У разі будь-якого збою тихо повертаємо оригінальний файл
    console.warn("Image compression skipped, using original:", err);
    return file;
  }
}
