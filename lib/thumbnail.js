const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { DEFAULT_CACHE } = require('./config');

const SUPPORTED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tiff', '.bmp']);
const metadataCache = new Map(); // key: `${filePath}_${mtimeMs}` -> metadata object

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

  if (fs.existsSync(cachePath)) {
    return cachePath;
  }

  // Ensure cache directory exists
  if (!fs.existsSync(DEFAULT_CACHE)) {
    fs.mkdirSync(DEFAULT_CACHE, { recursive: true });
  }

  const pipeline = sharp(filePath).rotate(); // auto-rotate according to EXIF orientation

  if (type === 'thumb') {
    // 1200px max dimension for crystal-clear, ultra-sharp studio inspection on 1080p, 2K & 4K displays
    await pipeline
      .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 88, effort: 4 })
      .toFile(cachePath);
  } else if (type === 'preview') {
    // 2560px max dimension for 2K/4K Deep Zoom inspection
    await pipeline
      .resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 90, effort: 4 })
      .toFile(cachePath);
  }

  return cachePath;
}

module.exports = {
  isImageFile,
  getImageMetadata,
  getOrGenerateImage
};
