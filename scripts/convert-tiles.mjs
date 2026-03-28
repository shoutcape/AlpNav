import sharp from 'sharp';
import { readdir, unlink } from 'fs/promises';
import { join } from 'path';

const targetDir = process.argv[2];
if (!targetDir) {
  console.error("Usage: node convert-tiles.mjs <directory>");
  process.exit(1);
}

async function findJpegs(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => e.isFile() && (e.name.endsWith('.jpg') || e.name.endsWith('.jpeg')))
    .map(e => join(e.parentPath ?? e.path, e.name));
}

const files = await findJpegs(targetDir);
for (const file of files) {
  const webpPath = file.replace(/\.jpe?g$/, '.webp');
  await sharp(file).webp({ quality: 85 }).toFile(webpPath);
  await unlink(file);
  console.log(`✓ ${file} → ${webpPath}`);
}
console.log(`Done: ${files.length} tiles converted.`);
