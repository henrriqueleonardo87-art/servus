import fs from 'fs';
import path from 'path';

const publicDir = 'c:/Leonardo/Meus Projetos/Sites/Servus/public';

// 1. Definição do SVG Mestre 512x512 com design profissional
function generateSvg(size = 512, isFavicon = false) {
  const rx = isFavicon ? Math.round(size * 0.24) : Math.round(size * 0.22);
  const strokeWidth = (size / 24) * 2.2;
  const scale = size / 24;

  // Path original escalado: M7 7.2c1.2-1.1 2.8-1.7 4.8-1.7 2.8 0 4.7 1.2 4.7 3.2 0 4.5-8.9 2.1-8.9 6.5 0 2 1.9 3.3 4.8 3.3 2 0 3.7-.6 4.9-1.8
  // Pontos absolutos e cúbicos escalados exatamente
  const p1x = (7 * scale).toFixed(1);
  const p1y = (7.2 * scale).toFixed(1);

  const c1x = (8.2 * scale).toFixed(1);
  const c1y = (6.1 * scale).toFixed(1);
  const c2x = (9.8 * scale).toFixed(1);
  const c2y = (5.5 * scale).toFixed(1);
  const p2x = (11.8 * scale).toFixed(1);
  const p2y = (5.5 * scale).toFixed(1);

  const c3x = (14.6 * scale).toFixed(1);
  const c3y = (5.5 * scale).toFixed(1);
  const c4x = (16.5 * scale).toFixed(1);
  const c4y = (6.7 * scale).toFixed(1);
  const p3x = (16.5 * scale).toFixed(1);
  const p3y = (8.7 * scale).toFixed(1);

  const c5x = (16.5 * scale).toFixed(1);
  const c5y = (13.2 * scale).toFixed(1);
  const c6x = (7.6 * scale).toFixed(1);
  const c6y = (10.8 * scale).toFixed(1);
  const p4x = (7.6 * scale).toFixed(1);
  const p4y = (15.2 * scale).toFixed(1);

  const c7x = (7.6 * scale).toFixed(1);
  const c7y = (17.2 * scale).toFixed(1);
  const c8x = (9.5 * scale).toFixed(1);
  const c8y = (18.5 * scale).toFixed(1);
  const p5x = (12.4 * scale).toFixed(1);
  const p5y = (18.5 * scale).toFixed(1);

  const c9x = (14.4 * scale).toFixed(1);
  const c9y = (18.5 * scale).toFixed(1);
  const c10x = (16.1 * scale).toFixed(1);
  const c10y = (17.9 * scale).toFixed(1);
  const p6x = (17.3 * scale).toFixed(1);
  const p6y = (16.7 * scale).toFixed(1);

  const d = `M ${p1x} ${p1y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2x} ${p2y} C ${c3x} ${c3y}, ${c4x} ${c4y}, ${p3x} ${p3y} C ${c5x} ${c5y}, ${c6x} ${c6y}, ${p4x} ${p4y} C ${c7x} ${c7y}, ${c8x} ${c8y}, ${p5x} ${p5y} C ${c9x} ${c9y}, ${c10x} ${c10y}, ${p6x} ${p6y}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="servusBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9d8df8"/>
      <stop offset="45%" stop-color="#735fd9"/>
      <stop offset="100%" stop-color="#4d3ec2"/>
    </linearGradient>
    <linearGradient id="innerShine" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.32"/>
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0.04"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${Math.max(2, size * 0.02)}" stdDeviation="${Math.max(2, size * 0.025)}" flood-color="#1e135e" flood-opacity="0.45"/>
    </filter>
  </defs>

  <!-- Fundo Squircle com gradiente nobre SERVUS -->
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#servusBg)"/>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#innerShine)"/>
  <rect x="1" y="1" width="${size - 2}" height="${size - 2}" rx="${rx}" fill="none" stroke="#ffffff" stroke-opacity="0.2" stroke-width="${Math.max(1, size * 0.005)}"/>

  <!-- Emblema Oficial S com sombra refinada -->
  <g filter="url(#shadow)">
    <path d="${d}"
          fill="none"
          stroke="#ffffff"
          stroke-width="${strokeWidth.toFixed(1)}"
          stroke-linecap="round"
          stroke-linejoin="round"/>
  </g>
</svg>`;
}

// Gravar SVGs
const svg512 = generateSvg(512);
const svg192 = generateSvg(192);
const svgFavicon = generateSvg(64, true);

fs.writeFileSync(path.join(publicDir, 'icon-512.svg'), svg512);
fs.writeFileSync(path.join(publicDir, 'icon-192.svg'), svg192);
fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgFavicon);

console.log('SVGs gerados com sucesso em', publicDir);
