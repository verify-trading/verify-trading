import sharp from "sharp";

const src = "public/favicon.svg";
const out = "public";
const navy = { r: 11, g: 15, b: 32, alpha: 1 };

async function png(size, name) {
  const density = Math.min(600, Math.ceil((96 * size) / 48));
  await sharp(src, { density, limitInputPixels: false })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .flatten({ background: navy })
    .png()
    .toFile(`${out}/${name}`);
  console.log("wrote", name);
}

for (const [size, name] of [[512, "icon-512.png"], [192, "icon-192.png"], [180, "apple-icon.png"], [48, "icon-48.png"], [32, "icon-32.png"], [16, "icon-16.png"]]) {
  await png(size, name);
}
