const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SAMPLE_DATA = [
  {
    name: 'STUDIO_001_16x9_MasterSet.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#1a1c29',
    color2: '#3d2645',
    title: 'Pose 1 - Master Studio Set',
    lens: '85mm f/1.4 | 1/200s | ISO 100'
  },
  {
    name: 'STUDIO_002_16x9_FamilyGroup.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#141e30',
    color2: '#243b55',
    title: 'Pose 2 - Family & Group Studio',
    lens: '35mm f/2.8 | 1/160s | ISO 100'
  },
  {
    name: 'STUDIO_003_16x9_FashionRunway.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#1f1c2c',
    color2: '#928dab',
    title: 'Pose 3 - Fashion Editorial Horizon',
    lens: '70mm f/2.0 | 1/250s | ISO 100'
  },
  {
    name: 'STUDIO_004_16x9_WideHorizon.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#0f2027',
    color2: '#203a43',
    title: 'Pose 4 - Wide Horizon Studio Set',
    lens: '24mm f/4.0 | 1/125s | ISO 200'
  },
  {
    name: 'STUDIO_005_16x9_BeautyCinema.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#232526',
    color2: '#414345',
    title: 'Pose 5 - Beauty Cinema Lighting',
    lens: '105mm f/1.4 | 1/200s | ISO 64'
  },
  {
    name: 'STUDIO_006_16x9_CoupleWarm.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#200122',
    color2: '#6f0000',
    title: 'Pose 6 - Couple Warm Rim Light',
    lens: '50mm f/1.8 | 1/160s | ISO 100'
  },
  {
    name: 'STUDIO_007_16x9_EditorialColor.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#2c3e50',
    color2: '#3498db',
    title: 'Pose 7 - Editorial Magazine Horizon',
    lens: '50mm f/1.4 | 1/320s | ISO 100'
  },
  {
    name: 'STUDIO_008_16x9_DramaticKey.jpg',
    width: 3840,
    height: 2160,
    orientation: 'landscape',
    color1: '#000000',
    color2: '#434343',
    title: 'Pose 8 - Monochromatic Dramatic Key',
    lens: '85mm f/1.2 | 1/200s | ISO 100'
  }
];

function buildSvg(item) {
  const isLandscape = item.orientation === 'landscape';
  const W = item.width;
  const H = item.height;

  // Silhouettes based on orientation
  let silhouettes = '';
  if (isLandscape) {
    // 3 figures for family / wide studio
    silhouettes = `
      <!-- Center Main Figure -->
      <circle cx="${W * 0.5}" cy="${H * 0.42}" r="${H * 0.12}" fill="rgba(255,255,255,0.85)" />
      <path d="M ${W * 0.45} ${H * 0.54} Q ${W * 0.5} ${H * 0.57} ${W * 0.55} ${H * 0.54} L ${W * 0.6} ${H * 0.68} Q ${W * 0.72} ${H * 0.8} ${W * 0.75} ${H * 0.95} L ${W * 0.25} ${H * 0.95} Q ${W * 0.28} ${H * 0.8} ${W * 0.4} ${H * 0.68} Z" fill="rgba(255,255,255,0.75)" />

      <!-- Left Figure -->
      <circle cx="${W * 0.32}" cy="${H * 0.46}" r="${H * 0.1}" fill="rgba(255,255,255,0.7)" />
      <path d="M ${W * 0.28} ${H * 0.56} L ${W * 0.36} ${H * 0.56} L ${W * 0.42} ${H * 0.95} L ${W * 0.18} ${H * 0.95} Z" fill="rgba(255,255,255,0.6)" />

      <!-- Right Figure -->
      <circle cx="${W * 0.68}" cy="${H * 0.46}" r="${H * 0.1}" fill="rgba(255,255,255,0.7)" />
      <path d="M ${W * 0.64} ${H * 0.56} L ${W * 0.72} ${H * 0.56} L ${W * 0.82} ${H * 0.95} L ${W * 0.58} ${H * 0.95} Z" fill="rgba(255,255,255,0.6)" />
    `;
  } else {
    // Single portrait model
    silhouettes = `
      <circle cx="${W * 0.5}" cy="${H * 0.36}" r="${W * 0.14}" fill="rgba(255,255,255,0.85)" />
      <path d="M ${W * 0.44} ${H * 0.46} Q ${W * 0.5} ${H * 0.49} ${W * 0.56} ${H * 0.46} L ${W * 0.61} ${H * 0.56} Q ${W * 0.77} ${H * 0.64} ${W * 0.83} ${H * 0.94} L ${W * 0.17} ${H * 0.94} Q ${W * 0.23} ${H * 0.64} ${W * 0.39} ${H * 0.56} Z" fill="rgba(255,255,255,0.75)" />
    `;
  }

  const badgeWidth = isLandscape ? 400 : 380;
  const badgeX = W - badgeWidth - 60;
  const footerH = Math.round(H * 0.08);
  const footerY = H - footerH - 40;

  return `
  <svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="bgGrad" cx="50%" cy="40%" r="70%">
        <stop offset="0%" stop-color="${item.color2}" />
        <stop offset="100%" stop-color="${item.color1}" />
      </radialGradient>
      <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
        <stop offset="60%" stop-color="transparent" stop-opacity="0" />
        <stop offset="100%" stop-color="#000000" stop-opacity="0.8" />
      </radialGradient>
      <filter id="softGlow">
        <feGaussianBlur stdDeviation="30" result="coloredBlur"/>
        <feMerge>
          <feMergeNode in="coloredBlur"/>
          <feMergeNode in="SourceGraphic"/>
        </feMerge>
      </filter>
    </defs>

    <!-- Studio Background -->
    <rect width="${W}" height="${H}" fill="url(#bgGrad)" />
    <rect width="${W}" height="${H}" fill="url(#vignette)" />

    <!-- Studio Frame -->
    <rect x="50" y="50" width="${W - 100}" height="${H - 100}" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="4" rx="20"/>

    <!-- Silhouettes -->
    <g filter="url(#softGlow)">
      ${silhouettes}
    </g>

    <!-- Orientation & Brand Badge top right -->
    <rect x="${badgeX}" y="70" width="${badgeWidth}" height="80" rx="16" fill="rgba(0,0,0,0.65)" stroke="rgba(255,255,255,0.2)" stroke-width="2"/>
    <text x="${badgeX + badgeWidth / 2}" y="122" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="bold" fill="#38bdf8" text-anchor="middle">
      16:9 WIDESCREEN
    </text>

    <!-- Metadata Footer Bar -->
    <rect x="70" y="${footerY}" width="${W - 140}" height="${footerH}" rx="20" fill="rgba(10,12,20,0.8)" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>
    <text x="110" y="${footerY + footerH * 0.42}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(footerH * 0.28)}" font-weight="bold" fill="#ffffff" letter-spacing="1">
      ${item.title.toUpperCase().replace(/&/g, '&amp;')}
    </text>
    <text x="110" y="${footerY + footerH * 0.78}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.round(footerH * 0.20)}" fill="#94a3b8">
      ${item.lens} | ${W}x${H} | ${item.name}
    </text>
  </svg>
  `;
}

async function generateSamplePhotos(targetDir, force = false) {
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const existingFiles = fs.readdirSync(targetDir).filter(f => !f.startsWith('.'));
  if (existingFiles.length > 0 && !force) {
    return false;
  }

  // Clear existing images if force
  if (force) {
    for (const f of existingFiles) {
      if (f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png')) {
        try { fs.unlinkSync(path.join(targetDir, f)); } catch (_) {}
      }
    }
  }

  for (const item of SAMPLE_DATA) {
    const filePath = path.join(targetDir, item.name);
    const svg = buildSvg(item);
    await sharp(Buffer.from(svg))
      .jpeg({ quality: 92 })
      .toFile(filePath);
  }

  return true;
}

module.exports = {
  generateSamplePhotos,
  SAMPLE_DATA
};
