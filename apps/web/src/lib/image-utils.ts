/**
 * Compresses an image file in the browser before sending to the server.
 * Resizes the image to a maximum dimension (default 1024px) while maintaining aspect ratio,
 * and converts it to a base64 string.
 */
export async function compressImage(file: File, maxDimension = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      if (!e.target?.result) {
        return reject(new Error("Empty file result"));
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

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
        if (!ctx) {
          return reject(new Error("Failed to get canvas context"));
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Compress to JPEG with 0.8 quality
        const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
        resolve(dataUrl);
      };

      img.src = e.target.result as string;
    };

    reader.readAsDataURL(file);
  });
}

/**
 * Compresses an image and returns it as a Blob suitable for FormData upload.
 * Uses higher resolution (1536px) than compressImage() to preserve
 * text readability on lab report photos.
 */
export async function compressImageToBlob(
  file: File,
  maxDimension = 1536,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = (e) => {
      if (!e.target?.result) {
        return reject(new Error("Empty file result"));
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

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
        if (!ctx) {
          return reject(new Error("Failed to get canvas context"));
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) =>
            blob ? resolve(blob) : reject(new Error("toBlob failed")),
          "image/jpeg",
          0.85,
        );
      };

      img.src = e.target.result as string;
    };

    reader.readAsDataURL(file);
  });
}
