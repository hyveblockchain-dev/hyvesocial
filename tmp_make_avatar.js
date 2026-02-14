import fs from 'fs';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="64" fill="#5865f2"/>
  <path d="M64 69c11 0 20-9 20-20s-9-20-20-20-20 9-20 20 9 20 20 20zm0 10c-13.3 0-40 6.7-40 20v10h80v-10c0-13.3-26.7-20-40-20z" fill="rgba(255,255,255,0.8)"/>
</svg>`;
fs.writeFileSync('public/default-avatar.svg', svg);
// Also write as .png extension (browsers will render SVG content fine)
fs.writeFileSync('public/default-avatar.png', svg);
console.log('Created default-avatar.svg and default-avatar.png');
