const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function generateLogo() {
  const iconPath = path.join(__dirname, '../public/logo-icon.png');
  const iconBuffer = await sharp(iconPath).resize(240, 240, { fit: 'contain' }).toBuffer();
  
  const width = 850;
  const height = 260;

  // SVG with explicit font styling
  const svgText = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .title-main { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 80px; font-weight: 900; fill: #0f172a; letter-spacing: -1.5px; }
          .title-accent { fill: #4f46e5; }
          .subtitle { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; font-size: 34px; font-weight: 600; fill: #334155; letter-spacing: -0.3px; }
        </style>
      </defs>
      <text x="275" y="125" class="title-main">TESTCLM<tspan class="title-accent">/CM</tspan></text>
      <text x="278" y="195" class="subtitle">Policía Local y Municipal</text>
    </svg>
  `;

  const canvas = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    }
  })
  .composite([
    { input: iconBuffer, top: 10, left: 10 },
    { input: Buffer.from(svgText), top: 0, left: 0 }
  ])
  .png()
  .toBuffer();

  const publicDir = path.join(__dirname, '../public');
  fs.writeFileSync(path.join(publicDir, 'logo-full.png'), canvas);
  fs.writeFileSync(path.join(publicDir, 'logo.png'), canvas);
  console.log('Successfully written logo-full.png and logo.png');
}

generateLogo().catch(err => {
  console.error('Error generating logo:', err);
  process.exit(1);
});
