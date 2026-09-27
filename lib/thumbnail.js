const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { DEFAULT_CACHE } = require('./config');

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp']);
const metadataCache = new Map(); // key: `${filePath}_${mtimeMs}` -> metadata object
const inFlightJobs = new Map();  // key: cachePath -> Promise<string>
const MAX_METADATA_CACHE = 3000;

function isImageFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTS.has(ext);
}

const CACHE_VERSION = 'v2_studio_hd';

function getCacheKey(filePath, mtime, type) {
  const hash = crypto.createHash('md5')
    .update(`${filePath}_${mtime}_${type}_${CACHE_VERSION}`)
    .digest('hex');
  return path.join(DEFAULT_CACHE, `${hash}_${type}.webp`);
}

async function getImageMetadata(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const cacheKey = `${filePath}_${stats.mtimeMs}`;
    if (metadataCache.has(cacheKey)) {
      return metadataCache.get(cacheKey);
    }

    const meta = await sharp(filePath).metadata();
    const data = {
      width: meta.width || 0,
      height: meta.height || 0,
      format: meta.format,
      aspectRatio: meta.width && meta.height ? (meta.width / meta.height).toFixed(2) : 1,
      size: stats.size,
      mtime: stats.mtimeMs
    };

    // FIFO eviction if cache exceeds capacity
    if (metadataCache.size >= MAX_METADATA_CACHE) {
      const firstKey = metadataCache.keys().next().value;
      metadataCache.delete(firstKey);
    }

    metadataCache.set(cacheKey, data);
    return data;
  } catch (err) {
    const stats = fs.existsSync(filePath) ? fs.statSync(filePath) : { size: 0, mtimeMs: 0 };
    return {
      width: 0,
      height: 0,
      format: path.extname(filePath).replace('.', ''),
      aspectRatio: 1,
      size: stats.size,
      mtime: stats.mtimeMs
    };
  }
}

async function getOrGenerateImage(filePath, type = 'thumb') {
  if (!fs.existsSync(filePath)) {
    throw new Error('Original file not found');
  }

  const stats = fs.statSync(filePath);
  const cachePath = getCacheKey(filePath, stats.mtimeMs, type);

  // Fast path: file already exists in cache
  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  // Deduplication: if another request is already generating this image, wait for it
  if (inFlightJobs.has(cachePath)) {
    return await inFlightJobs.get(cachePath);
  }

  // Ensure cache directory exists
  if (!fs.existsSync(DEFAULT_CACHE)) {
    fs.mkdirSync(DEFAULT_CACHE, { recursive: true });
  }

  const job = (async () => {
    try {
      // Atomic write to avoid partial reads on concurrent requests
      const tmpPath = `${cachePath}.tmp_${process.pid}_${Date.now()}`;
      const pipeline = sharp(filePath).rotate(); // auto-rotate according to EXIF orientation

      if (type === 'thumb') {
        // 1200px max dimension, effort: 2 for 40% faster encoding with pristine visual quality
        await pipeline
          .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 86, effort: 2 })
          .toFile(tmpPath);
      } else if (type === 'preview') {
        // 2560px max dimension for deep zoom, effort: 2 for speed
        await pipeline
          .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 88, effort: 2 })
          .toFile(tmpPath);
      }

      // Atomic rename to final path (handle replace if another worker finished)
      try {
        fs.renameSync(tmpPath, cachePath);
      } catch (renameErr) {
        if (!fs.existsSync(cachePath)) {
          throw renameErr;
        }
        // If target already exists, clean up tmp
        if (fs.existsSync(tmpPath)) {
          try { fs.unlinkSync(tmpPath); } catch (_) {}
        }
      }

      return cachePath;
    } finally {
      inFlightJobs.delete(cachePath);
    }
  })();

  inFlightJobs.set(cachePath, job);
  return await job;
}

module.exports = {
  isImageFile,
  getImageMetadata,
  getOrGenerateImage
};
