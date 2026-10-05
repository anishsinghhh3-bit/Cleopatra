const sharp = require("sharp");

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" fill="#12181A"/>
  <rect x="136" y="300" width="240" height="40" fill="#B08D57"/>
  <polygon points="136,300 216,300 176,210" fill="#B08D57"/>
  <polygon points="216,300 296,300 256,170" fill="#B08D57"/>
  <polygon points="296,300 376,300 336,210" fill="#B08D57"/>
  <circle cx="176" cy="200" r="10" fill="#B08D57"/>
  <circle cx="256" cy="160" r="12" fill="#B08D57"/>
  <circle cx="336" cy="200" r="10" fill="#B08D57"/>
</svg>
`;

async function generate() {
  const buffer = Buffer.from(svg);
  await sharp(buffer).resize(512, 512).png().toFile("public/pwa-512x512.png");
  await sharp(buffer).resize(192, 192).png().toFile("public/pwa-192x192.png");
  console.log("Icons written to public/");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
