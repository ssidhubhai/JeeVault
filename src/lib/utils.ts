import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const compressImageBase64 = async (base64: string, maxSizeKB: number = 700): Promise<string> => {
  if (base64.length < maxSizeKB * 1300) return base64; // Under limit
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Scale down image to save space
      const scale = Math.min(1, Math.sqrt((maxSizeKB * 1024) / (img.width * img.height * 0.5)));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(base64);
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL('image/jpeg', 0.85);
      
      if (compressed.length > maxSizeKB * 1300) {
        // Still too big, compress more
        resolve(canvas.toDataURL('image/jpeg', 0.65));
      } else {
        resolve(compressed);
      }
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
};
