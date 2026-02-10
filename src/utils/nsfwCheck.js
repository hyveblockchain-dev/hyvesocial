// src/utils/nsfwCheck.js
// Client-side NSFW image detection using NSFWJS (TensorFlow.js)
// Classifies images into: Drawing, Hentai, Neutral, Porn, Sexy
// Blocks uploads that exceed safety thresholds
// Uses dynamic imports so TF.js is only loaded when first image is checked
// Supports animated GIF scanning by extracting multiple frames

let model = null;
let modelPromise = null;

// Thresholds — an image is blocked if ANY of these are exceeded
const THRESHOLDS = {
  Porn: 0.25,
  Hentai: 0.25,
  Sexy: 0.60
};

// How many frames to sample from animated GIFs
const GIF_FRAMES_TO_CHECK = 8;

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
 * Check if a file is an animated GIF (has multiple frames)
 */
function isAnimatedGif(file) {
  return file.type === 'image/gif';
}

/**
 * Extract evenly-spaced frames from an animated GIF using canvas.
 * Renders the GIF into an offscreen video-like playback by setting currentTime
 * on a blob URL, or by parsing GIF frame data directly.
 * Falls back to single-frame check if extraction fails.
 *
 * @param {File} file - The GIF file
 * @param {number} numFrames - Number of frames to extract
 * @returns {Promise<HTMLCanvasElement[]>} Array of canvas elements with frame data
 */
async function extractGifFrames(file, numFrames) {
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  // Parse GIF to find frame boundaries
  // GIF frames start with graphic control extension (0x21 0xF9) or image descriptor (0x2C)
  const frameOffsets = [];
  for (let i = 0; i < bytes.length - 2; i++) {
    // Image descriptor marker
    if (bytes[i] === 0x2C) {
      frameOffsets.push(i);
    }
  }

  const totalFrames = frameOffsets.length;
  if (totalFrames <= 1) {
    // Not actually animated or single frame — return empty to fall through to static check
    return [];
  }

  // We'll use a different approach: render the GIF at different time offsets
  // by creating an ImageBitmap from the file at various points
  // Since browsers render GIFs frame-by-frame, we use a canvas + img approach
  // with timed snapshots

  const canvasFrames = [];
  const url = URL.createObjectURL(file);

  try {
    // Create a canvas to capture frames
    const img = new Image();
    img.crossOrigin = 'anonymous';

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = url;
    });

    const w = Math.min(img.naturalWidth, 224);
    const h = Math.min(img.naturalHeight, 224);

    // For animated GIFs, browsers only show the first frame on an <img> element
    // that isn't in the DOM being animated. To get multiple frames we need to
    // actually decode different parts of the GIF.
    // Strategy: use the ImageDecoder API if available (Chrome 94+), otherwise
    // fall back to rendering via a temporary <img> in the DOM with delays

    if (typeof ImageDecoder !== 'undefined') {
      // Modern approach: use ImageDecoder API to extract individual frames
      try {
        const decoder = new ImageDecoder({
          data: arrayBuffer,
          type: 'image/gif'
        });
        await decoder.completed;

        const frameCount = decoder.tracks.selectedTrack.frameCount;
        const step = Math.max(1, Math.floor(frameCount / numFrames));

        for (let i = 0; i < frameCount && canvasFrames.length < numFrames; i += step) {
          try {
            const frameResult = await decoder.decode({ frameIndex: i });
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(frameResult.image, 0, 0, w, h);
            frameResult.image.close();
            canvasFrames.push(canvas);
          } catch (_) {
            // Skip frames that fail to decode
          }
        }
        decoder.close();
      } catch (decoderErr) {
        console.warn('ImageDecoder failed, falling back:', decoderErr.message);
      }
    }

    // Fallback: if ImageDecoder didn't work or isn't available,
    // create canvas snapshots using the img element at timed intervals
    // by inserting it into the DOM temporarily so the browser animates it
    if (canvasFrames.length === 0) {
      // Estimate frame duration (typical GIF: 50-100ms per frame)
      const estFrameDuration = 80; // ms
      const estTotalDuration = totalFrames * estFrameDuration;
      const interval = Math.max(estFrameDuration, Math.floor(estTotalDuration / numFrames));

      // Insert img off-screen so the browser plays through the animation
      img.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;pointer-events:none;';
      document.body.appendChild(img);

      // Force the browser to restart the animation
      img.src = '';
      img.src = url;
      await new Promise(r => setTimeout(r, 50)); // Let first frame render

      for (let f = 0; f < numFrames; f++) {
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvasFrames.push(canvas);
        if (f < numFrames - 1) {
          await new Promise(r => setTimeout(r, interval));
        }
      }

      document.body.removeChild(img);
    }
  } finally {
    URL.revokeObjectURL(url);
  }

  return canvasFrames;
}

/**
 * Classify a single image element or canvas against the NSFW model
 */
function classifyElement(nsfwModel, element) {
  return nsfwModel.classify(element);
}

/**
 * Check predictions against thresholds
 */
function checkPredictions(predictions) {
  const scores = {};
  for (const p of predictions) {
    scores[p.className] = p.probability;
  }

  for (const [category, threshold] of Object.entries(THRESHOLDS)) {
    if ((scores[category] || 0) > threshold) {
      const pct = Math.round((scores[category] || 0) * 100);
      return { safe: false, category, confidence: scores[category], pct, scores };
    }
  }
  return { safe: true, scores };
}

/**
 * Check if a file contains NSFW content.
 * For animated GIFs, extracts and scans multiple frames.
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

    // For animated GIFs, check multiple frames
    if (isAnimatedGif(file)) {
      console.log('Animated GIF detected — scanning multiple frames...');
      let frames = [];
      try {
        frames = await extractGifFrames(file, GIF_FRAMES_TO_CHECK);
      } catch (err) {
        console.warn('GIF frame extraction failed:', err.message);
      }

      if (frames.length > 0) {
        for (let i = 0; i < frames.length; i++) {
          const predictions = await classifyElement(nsfwModel, frames[i]);
          const result = checkPredictions(predictions);
          if (!result.safe) {
            console.warn(`NSFW content detected in GIF frame ${i + 1}/${frames.length}: ${result.category} (${result.pct}%)`, result.scores);
            return {
              safe: false,
              reason: 'This animated image appears to contain inappropriate content and cannot be uploaded. Please choose a different image.',
              category: result.category,
              confidence: result.confidence,
              predictions
            };
          }
        }
        console.log(`GIF passed NSFW check (${frames.length} frames scanned)`);
        return { safe: true };
      }
      // If frame extraction failed, fall through to static check below
      console.warn('GIF frame extraction yielded 0 frames, falling back to static check');
    }

    // Static image check (also fallback for GIFs if frame extraction fails)
    const img = await fileToImage(file);
    const predictions = await classifyElement(nsfwModel, img);
    const result = checkPredictions(predictions);

    if (!result.safe) {
      console.warn(`NSFW content detected: ${result.category} (${result.pct}%)`, result.scores);
      return {
        safe: false,
        reason: 'This image appears to contain inappropriate content and cannot be uploaded. Please choose a different image.',
        category: result.category,
        confidence: result.confidence,
        predictions
      };
    }

    return { safe: true, predictions };
  } catch (err) {
    console.error('NSFW check error:', err);
    // If the model fails to load, BLOCK the upload (fail closed for safety)
    return {
      safe: false,
      reason: 'Unable to verify image safety. Please try again.',
      error: err.message
    };
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
