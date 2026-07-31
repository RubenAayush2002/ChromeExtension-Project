import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { join, extname, basename } from 'node:path';

const WIDTH = 1920;
const HEIGHT = 1080;
const WEBP_QUALITY = 82;
const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.tiff', '.avif', '.webp']);

const targetDir = process.argv[2];
if (!targetDir) {
  console.error('Usage: node scripts/process-assets.mjs <path-to-assets-subfolder>');
  process.exit(1);
}

async function processFolder(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const images = entries.filter((e) => e.isFile() && SOURCE_EXTENSIONS.has(extname(e.name).toLowerCase()));

  if (images.length === 0) {
    console.log(`No source images found in ${dir}`);
    return;
  }

  const processedDir = join(dir, 'processed');
  await mkdir(processedDir, { recursive: true });

  for (const entry of images) {
    const inputPath = join(dir, entry.name);
    const outputName = `${basename(entry.name, extname(entry.name))}.webp`;
    const outputPath = join(processedDir, outputName);

    const beforeSize = (await stat(inputPath)).size;

    await sharp(inputPath)
      .resize(WIDTH, HEIGHT, { fit: 'cover', position: 'attention' })
      .webp({ quality: WEBP_QUALITY })
      .toFile(outputPath);

    const afterSize = (await stat(outputPath)).size;
    const savings = (100 * (1 - afterSize / beforeSize)).toFixed(0);
    console.log(
      `${entry.name} -> processed/${outputName}  (${(beforeSize / 1024).toFixed(0)}KB -> ${(afterSize / 1024).toFixed(0)}KB, -${savings}%)`,
    );
  }

  console.log(`\nDone: ${images.length} image(s) written to ${processedDir}`);
}

await processFolder(targetDir);
