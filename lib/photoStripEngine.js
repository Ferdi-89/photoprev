const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { getTemplateById } = require('./templateManager');

function escapeXml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function getSlotCoordinates(slotCount, stripWidth = 600, stripHeight = 1800) {
  const slots = [];
  const slotWidth = 500;
  const marginX = Math.round((stripWidth - slotWidth) / 2); // 50px

  if (slotCount === 4) {
    const slotHeight = 310;
    const spacingY = 22;
    const startY = 48;

    for (let i = 0; i < 4; i++) {
      slots.push({
        x: marginX,
        y: startY + i * (slotHeight + spacingY),
        width: slotWidth,
        height: slotHeight
      });
    }

    const lastSlotBottom = startY + 4 * slotHeight + 3 * spacingY;
    const textStartY = lastSlotBottom + 40;
    return { slots, slotWidth, slotHeight, textStartY };
  } else {
    // Default: 3 slots
    const slotHeight = 380;
    const spacingY = 28;
    const startY = 55;

    for (let i = 0; i < 3; i++) {
      slots.push({
        x: marginX,
        y: startY + i * (slotHeight + spacingY),
        width: slotWidth,
        height: slotHeight
      });
    }

    const lastSlotBottom = startY + 3 * slotHeight + 2 * spacingY;
    const textStartY = lastSlotBottom + 45;
    return { slots, slotWidth, slotHeight, textStartY };
  }
}

function getGrid2x2Coordinates() {
  const slotWidth = 510;
  const slotHeight = 580;
  const col1X = 65;
  const col2X = 625;
  const row1Y = 200;
  const row2Y = 970;

  const slots = [
    { x: col1X, y: row1Y, width: slotWidth, height: slotHeight, num: '-01' },
    { x: col2X, y: row1Y, width: slotWidth, height: slotHeight, num: '02' },
    { x: col1X, y: row2Y, width: slotWidth, height: slotHeight, num: '03' },
    { x: col2X, y: row2Y, width: slotWidth, height: slotHeight, num: '04' }
  ];

  return { slots, slotWidth, slotHeight };
}

function generateBaskaraGridSvgOverlay(options) {
  const {
    width,
    height,
    template,
    eventTitle,
    studioFooter,
    dateText,
    slots
  } = options;

  const cleanStudio = escapeXml(studioFooter || eventTitle || 'BASKARA STUDIO').toUpperCase();
  const rawDate = dateText !== undefined && dateText !== '' ? dateText : new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' }).replace(/\//g, '.');
  const cleanDate = escapeXml(rawDate || 'DD.MM.YYYY');
  const cleanCity = escapeXml(eventTitle && eventTitle !== 'PHOTOBOOTH MEMORIES' ? eventTitle : 'LOCATION / CITY').toUpperCase();

  let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
    <!-- Studio Header Brand Mark -->
    <rect x="65" y="85" width="7" height="68" fill="#b91c1c" />
    <text x="96" y="140"
          fill="#18181b"
          font-size="48"
          font-weight="900"
          font-family="'Arial Black', 'Impact', 'Segoe UI', sans-serif"
          letter-spacing="3">
      ${cleanStudio}
    </text>
  `;

  // Draw borders and metadata for each slot
  slots.forEach((slot, index) => {
    // Sharp black border frame
    svgContent += `
      <rect x="${slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}"
            fill="none" stroke="#18181b" stroke-width="4.5" />
    `;

    const bottomY = slot.y + slot.height;
    const numX = slot.x;
    const metaX = slot.x + (slot.num.length > 2 ? 105 : 95);

    // Number (e.g. -01, 02, 03, 04)
    svgContent += `
      <text x="${numX}" y="${bottomY + 74}"
            fill="#18181b"
            font-size="62"
            font-weight="900"
            font-family="'Arial Black', 'Impact', 'Segoe UI', sans-serif"
            letter-spacing="-1">
        ${slot.num}
      </text>
      <!-- Date -->
      <text x="${metaX}" y="${bottomY + 44}"
            fill="#18181b"
            font-size="20"
            font-weight="800"
            font-family="'Segoe UI', -apple-system, sans-serif"
            letter-spacing="0.5">
        ${cleanDate}
      </text>
      <!-- Location / City -->
      <text x="${metaX}" y="${bottomY + 70}"
            fill="#52525b"
            font-size="18"
            font-weight="700"
            font-family="'Segoe UI', -apple-system, sans-serif"
            letter-spacing="1">
        ${cleanCity}
      </text>
    `;
  });

  svgContent += `</svg>`;
  return Buffer.from(svgContent, 'utf8');
}

async function preparePhotoBuffer(photoPath, targetWidth, targetHeight, filter = 'normal', cropOptions = {}) {
  if (!fs.existsSync(photoPath)) {
    // Fallback placeholder buffer if file missing
    return await sharp({
      create: {
        width: targetWidth,
        height: targetHeight,
        channels: 3,
        background: '#e2e8f0'
      }
    }).jpeg().toBuffer();
  }

  let pipeline = sharp(photoPath).rotate(); // auto-orient from EXIF

  if (filter === 'bw') {
    pipeline = pipeline.grayscale().linear(1.12, -8);
  } else if (filter === 'vintage') {
    pipeline = pipeline
      .modulate({ brightness: 1.04, saturation: 0.82 })
      .tint({ r: 246, g: 236, b: 218 });
  } else if (filter === 'sepia') {
    pipeline = pipeline
      .modulate({ brightness: 1.02, saturation: 0.65 })
      .tint({ r: 215, g: 180, b: 140 });
  }

  const cropOffsetY = (cropOptions && typeof cropOptions.cropOffsetY === 'number')
    ? Math.max(0, Math.min(100, cropOptions.cropOffsetY))
    : 50;
  const cropOffsetX = (cropOptions && typeof cropOptions.cropOffsetX === 'number')
    ? Math.max(0, Math.min(100, cropOptions.cropOffsetX))
    : 50;

  try {
    const meta = await sharp(photoPath).rotate().metadata();
    let origW = meta.width || targetWidth;
    let origH = meta.height || targetHeight;
    if (meta.orientation && meta.orientation >= 5) {
      origW = meta.height;
      origH = meta.width;
    }

    const scale = Math.max(targetWidth / origW, targetHeight / origH);
    const extractW = Math.max(1, Math.min(origW, Math.round(targetWidth / scale)));
    const extractH = Math.max(1, Math.min(origH, Math.round(targetHeight / scale)));

    const maxLeft = Math.max(0, origW - extractW);
    const maxTop = Math.max(0, origH - extractH);

    const left = Math.max(0, Math.min(maxLeft, Math.round(maxLeft * (cropOffsetX / 100))));
    const top = Math.max(0, Math.min(maxTop, Math.round(maxTop * (cropOffsetY / 100))));

    return await pipeline
      .extract({ left, top, width: extractW, height: extractH })
      .resize({
        width: targetWidth,
        height: targetHeight,
        fit: 'fill'
      })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch (_) {
    return await pipeline
      .resize({
        width: targetWidth,
        height: targetHeight,
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 92 })
      .toBuffer();
  }
}

function generateStripSvgOverlay(options) {
  const {
    width,
    height,
    template,
    eventTitle,
    studioFooter,
    dateText,
    isDouble,
    textStartY,
    slots
  } = options;

  const textColor = template.textColor || '#18181b';
  const subTextColor = template.subTextColor || '#71717a';
  const accentColor = template.accentColor || '#2563eb';
  const borderColor = template.frameBorderColor || '#e4e4e7';
  const cuttingColor = template.cuttingColor || (template.theme === 'dark' ? '#3f3f46' : '#d4d4d8');

  const cleanEventTitle = escapeXml(eventTitle || 'PHOTOBOOTH STUDIO');
  const cleanStudioFooter = escapeXml(studioFooter || 'RTFTP PHOTO LAB');
  const cleanDate = dateText === '' ? '' : escapeXml(dateText || new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }));

  // Helper to draw text & frames for one strip column (offset X = 0 or 600)
  function renderStripElements(offsetX) {
    const centerX = offsetX + 300;
    let elements = '';

    // Photo Frames / Borders
    for (const slot of slots) {
      elements += `
        <rect x="${offsetX + slot.x}" y="${slot.y}" width="${slot.width}" height="${slot.height}"
              fill="none" stroke="${borderColor}" stroke-width="1.5" rx="4" ry="4" />
      `;
    }

    // Divider Line above typography
    elements += `
      <line x1="${centerX - 60}" y1="${textStartY}" x2="${centerX + 60}" y2="${textStartY}"
            stroke="${accentColor}" stroke-width="2" stroke-linecap="round" />
    `;

    // Event Title
    elements += `
      <text x="${centerX}" y="${textStartY + 52}"
            text-anchor="middle"
            fill="${textColor}"
            font-size="28"
            font-weight="800"
            font-family="'Segoe UI', -apple-system, Roboto, sans-serif"
            letter-spacing="1.5">
        ${cleanEventTitle}
      </text>
    `;

    // Studio Footer
    elements += `
      <text x="${centerX}" y="${textStartY + 95}"
            text-anchor="middle"
            fill="${subTextColor}"
            font-size="16"
            font-weight="600"
            font-family="'Segoe UI', -apple-system, Roboto, sans-serif"
            letter-spacing="2.5">
        ${cleanStudioFooter}
      </text>
    `;

    // Date Badge
    elements += `
      <text x="${centerX}" y="${textStartY + 140}"
            text-anchor="middle"
            fill="${accentColor}"
            font-size="14"
            font-weight="700"
            font-family="'Segoe UI', -apple-system, Roboto, monospace"
            letter-spacing="1">
        ${cleanDate}
      </text>
    `;

    return elements;
  }

  let svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

  // Strip 1 (Left)
  svgContent += renderStripElements(0);

  // If Double Strip 4R, render Strip 2 (Right) & center cutting line
  if (isDouble) {
    svgContent += renderStripElements(600);

    // Cutting dashed line down center (x = 600)
    svgContent += `
      <line x1="600" y1="0" x2="600" y2="${height}"
            stroke="${cuttingColor}" stroke-width="1" stroke-dasharray="6,6" />
    `;
  }

  svgContent += `</svg>`;
  return Buffer.from(svgContent, 'utf8');
}

/**
 * Render Photostrip Composite Image
 * @param {Array<string>|Object} photoPathsOrOptions Array of file paths or options object
 * @param {Object} options Configuration options
 * @returns {Promise<Buffer|Object>}
 */
async function renderPhotostrip(photoPathsOrOptions = [], options = {}) {
  let photoPaths = [];
  let opts = {};
  if (Array.isArray(photoPathsOrOptions)) {
    photoPaths = photoPathsOrOptions;
    opts = options || {};
  } else if (typeof photoPathsOrOptions === 'object' && photoPathsOrOptions !== null) {
    opts = photoPathsOrOptions;
    photoPaths = photoPathsOrOptions.photoPaths || [];
  }

  const templateId = opts.templateId || 'classic-white-3';
  const template = getTemplateById(templateId);

  const slotCount = template.slots || 4;
  const isGrid2x2 = template.layout === 'grid_2x2';
  const isDouble = !isGrid2x2 && ((opts.outputFormat || template.outputFormat) !== 'single_strip');
  const canvasWidth = isDouble || isGrid2x2 ? 1200 : 600;
  const canvasHeight = 1800;
  const filter = opts.filter || 'normal';

  const gridData = isGrid2x2 ? getGrid2x2Coordinates() : null;
  const stripData = !isGrid2x2 ? getSlotCoordinates(slotCount, 600, 1800) : null;
  const slots = isGrid2x2 ? gridData.slots : stripData.slots;
  const slotWidth = isGrid2x2 ? gridData.slotWidth : stripData.slotWidth;
  const slotHeight = isGrid2x2 ? gridData.slotHeight : stripData.slotHeight;
  const textStartY = !isGrid2x2 ? stripData.textStartY : 0;

  // Take up to slotCount photos (pad or loop if fewer photos provided)
  const preparedPhotos = [];
  for (let i = 0; i < slotCount; i++) {
    const rawItem = photoPaths[i] || photoPaths[photoPaths.length - 1] || '';
    let photoPath = '';
    let cropOffsetY = 50;
    let cropOffsetX = 50;

    if (typeof rawItem === 'string') {
      photoPath = rawItem;
      if (Array.isArray(opts.cropOffsets) && typeof opts.cropOffsets[i] === 'number') {
        cropOffsetY = opts.cropOffsets[i];
      } else if (typeof opts.cropOffsetY === 'number') {
        cropOffsetY = opts.cropOffsetY;
      }
    } else if (typeof rawItem === 'object' && rawItem !== null) {
      photoPath = rawItem.path || rawItem.filename || rawItem.filePath || '';
      if (typeof rawItem.cropOffsetY === 'number') cropOffsetY = rawItem.cropOffsetY;
      if (typeof rawItem.cropOffsetX === 'number') cropOffsetX = rawItem.cropOffsetX;
    }

    if (photoPath) {
      const buf = await preparePhotoBuffer(photoPath, slotWidth, slotHeight, filter, { cropOffsetY, cropOffsetX });
      preparedPhotos.push(buf);
    }
  }

  const composites = [];

  if (isGrid2x2) {
    // 2x2 Postcard Layout (Baskara Style)
    for (let i = 0; i < slots.length; i++) {
      if (preparedPhotos[i]) {
        composites.push({
          input: preparedPhotos[i],
          left: slots[i].x,
          top: slots[i].y
        });
      }
    }

    const svgOverlay = generateBaskaraGridSvgOverlay({
      width: canvasWidth,
      height: canvasHeight,
      template,
      eventTitle: opts.eventTitle || options.eventTitle,
      studioFooter: opts.studioFooter || options.studioFooter,
      dateText: opts.dateText !== undefined ? opts.dateText : options.dateText,
      slots
    });

    composites.push({
      input: svgOverlay,
      left: 0,
      top: 0
    });
  } else {
    // Strip Layout: Place photos for left strip (Column 1)
    for (let i = 0; i < slots.length; i++) {
      if (preparedPhotos[i]) {
        composites.push({
          input: preparedPhotos[i],
          left: slots[i].x,
          top: slots[i].y
        });
      }
    }

    // If Double 4R, duplicate photos for right strip (Column 2)
    if (isDouble) {
      for (let i = 0; i < slots.length; i++) {
        if (preparedPhotos[i]) {
          composites.push({
            input: preparedPhotos[i],
            left: slots[i].x + 600,
            top: slots[i].y
          });
        }
      }
    }

    // If custom template has an overlay PNG
    if (template.type === 'custom' && template.overlayPath && fs.existsSync(template.overlayPath)) {
      const overlayBuffer = await sharp(template.overlayPath)
        .resize({ width: isDouble ? 1200 : 600, height: canvasHeight, fit: 'fill' })
        .toBuffer();
      composites.push({
        input: overlayBuffer,
        left: 0,
        top: 0
      });
    } else {
      // Built-in template: composite SVG typography, borders, and cutting line
      const svgOverlay = generateStripSvgOverlay({
        width: isDouble ? 1200 : 600,
        height: canvasHeight,
        template,
        eventTitle: opts.eventTitle || options.eventTitle,
        studioFooter: opts.studioFooter || options.studioFooter,
        dateText: opts.dateText !== undefined ? opts.dateText : options.dateText,
        isDouble,
        textStartY,
        slots
      });

      composites.push({
        input: svgOverlay,
        left: 0,
        top: 0
      });
    }
  }

  // Create base background canvas
  let basePipeline = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: template.bgColor || '#ffffff'
    }
  }).composite(composites);

  const targetOutPath = opts.outputPath || options.outputPath;
  if (targetOutPath) {
    const outDir = path.dirname(targetOutPath);
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    const outPath = targetOutPath;
    const ext = path.extname(outPath).toLowerCase();
    if (ext === '.png') {
      await basePipeline.png({ quality: 95 }).toFile(outPath);
    } else {
      await basePipeline.jpeg({ quality: 95, chromaSubsampling: '4:4:4' }).toFile(outPath);
    }

    return {
      success: true,
      outputPath: outPath,
      width: canvasWidth,
      height: canvasHeight,
      dpi: 300,
      templateId,
      slotCount,
      isDouble
    };
  } else {
    // Return buffer (e.g. for preview endpoint)
    const buf = await basePipeline.jpeg({ quality: 88 }).toBuffer();
    return {
      success: true,
      buffer: buf,
      contentType: 'image/jpeg',
      width: canvasWidth,
      height: canvasHeight,
      dpi: 300,
      templateId
    };
  }
}

/**
 * Fast Photostrip Preview DataURL Generator
 */
async function renderPhotostripPreview(photoPathsOrOptions = [], options = {}) {
  const result = await renderPhotostrip(photoPathsOrOptions, options);
  if (!result || !result.buffer) {
    throw new Error('Gagal menghasilkan preview photostrip');
  }
  return `data:image/jpeg;base64,${result.buffer.toString('base64')}`;
}

module.exports = {
  renderPhotostrip,
  renderPhotostripPreview,
  getSlotCoordinates
};
