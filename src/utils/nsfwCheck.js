// src/utils/nsfwCheck.js
// Client-side NSFW image detection using NSFWJS (TensorFlow.js)
// Classifies images into: Drawing, Hentai, Neutral, Porn, Sexy
// Blocks uploads that exceed safety thresholds
// Uses dynamic imports so TF.js is only loaded when first image is checked

let model = null;
let modelPromise = null;

// Thresholds — an image is blocked if ANY of these are exceeded
const THRESHOLDS = {
  Porn: 0.25,
  Hentai: 0.25,
  Sexy: 0.60
};

/**
 * Load the NSFWJS model (cached after first load)
 */
async function loadModel() {
  if (model) return model;
  if (modelPromise) return modelPromise;

  modelPromise = (async () => {
    try {
      // Dynamic imports — TF.js + NSFWJS only loaded on first use
      const tf = await import('@tensorflow/tfjs');
      tf.enableProdMode();
      const nsfwjs = await import('nsfwjs');
      model = await nsfwjs.load();
      console.log('NSFW model loaded');
      return model;
    } catch (err) {
      console.error('Failed to load NSFW model:', err);
      modelPromise = null;
      throw err;
    }
  })();

  return modelPromise;
}

/**
 * Create an HTMLImageElement from a File or Blob
 */
function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}

/**
 * Check if a file contains NSFW content.
 *
 * @param {File|Blob} file - The image file to check
 * @returns {Promise<{ safe: boolean, reason?: string, predictions?: object[] }>}
 *
 * Usage:
 *   const result = await checkImageNSFW(file);
 *   if (!result.safe) {
 *     alert(result.reason);
 *     return;
 *   }
 */
export async function checkImageNSFW(file) {
  try {
    const nsfwModel = await loadModel();
    const img = await fileToImage(file);
    const predictions = await nsfwModel.classify(img);

    // Convert to a lookup
    const scores = {};
    for (const p of predictions) {
      scores[p.className] = p.probability;
    }

    // Check thresholds
    for (const [category, threshold] of Object.entries(THRESHOLDS)) {
      if ((scores[category] || 0) > threshold) {
        const pct = Math.round((scores[category] || 0) * 100);
        console.warn(`NSFW content detected: ${category} (${pct}%)`, scores);
        return {
          safe: false,
          reason: 'This image appears to contain inappropriate content and cannot be uploaded. Please choose a different image.',
          category,
          confidence: scores[category],
          predictions
        };
      }
    }

    return { safe: true, predictions };
  } catch (err) {
    console.error('NSFW check error:', err);
    // If the model fails to load, allow the upload (fail open)
    // Server-side check will still catch it
    return { safe: true, error: err.message };
  }
}

/**
 * Pre-load the NSFW model (call on app init for faster first-check)
 */
export function preloadNSFWModel() {
  loadModel().catch(() => {
    // Silently fail — will retry on first check
  });
}

export default checkImageNSFW;
