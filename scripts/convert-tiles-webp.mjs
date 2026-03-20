import sharp from 'sharp';
import { readdir, unlink } from 'fs/promises';
import { join } from 'path';

async function findJpegs(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.jpg'))
    .map(e => join(e.parentPath ?? e.path, e.name));
}

const files = await findJpegs('public/resorts/zillertal-arena/panorama');
for (const file of files) {
  const webpPath = file.replace(/\.jpg$/, '.webp');
  await sharp(file).webp({ quality: 85 }).toFile(webpPath);
  await unlink(file);
  console.log(`✓ ${file} → ${webpPath}`);
}
console.log(`Done: ${files.length} tiles converted.`);
