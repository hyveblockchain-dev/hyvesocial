export async function compressImage(file, maxSizeMB = 2, maxWidthOrHeight = 1920) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidthOrHeight) {
            height = (height * maxWidthOrHeight) / width;
            width = maxWidthOrHeight;
          }
        } else {
          if (height > maxWidthOrHeight) {
            width = (width * maxWidthOrHeight) / height;
            height = maxWidthOrHeight;
          }
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to blob with quality adjustment
        canvas.toBlob(
          (blob) => {
            if (blob) {
              // Check size and reduce quality if needed
              const sizeMB = blob.size / 1024 / 1024;
              if (sizeMB > maxSizeMB) {
                // Reduce quality
                canvas.toBlob(
                  (reducedBlob) => {
                    if (reducedBlob) {
                      resolve(new File([reducedBlob], file.name, { type: 'image/jpeg' }));
                    } else {
                      reject(new Error('Compression failed'));
                    }
                  },
                  'image/jpeg',
                  0.6
                );
              } else {
                resolve(new File([blob], file.name, { type: 'image/jpeg' }));
              }
            } else {
              reject(new Error('Compression failed'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target.result;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}