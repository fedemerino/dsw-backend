/**
 * One-off helper to load local demo images into a listing: uploads each file
 * to Cloudinary, creates the matching `Image` rows in your local dev DB
 * (replacing whatever placeholder images, e.g. /default.jpg, the listing had
 * before), and prints the SQL to replicate that same end state on another
 * database (e.g. the VPS, which this script has no direct network access to).
 *
 * Usage (needs --env-file, same as nodemon.json, since the project doesn't use dotenv):
 *   node --env-file=.env scripts/upload-listing-images.js <listingId> <file1> [file2] [file3] ...
 *
 * Example:
 *   node --env-file=.env scripts/upload-listing-images.js 223200df-ee5e-4f61-b26e-b74a455d292e \
 *     ../dsw-frontend/public/recoleta_1.jpg \
 *     ../dsw-frontend/public/recoleta_2.jpg \
 *     ../dsw-frontend/public/recoleta_3.jpg
 *
 * Corriéndolo varias veces para el mismo listing (por ej. agregando fotos de
 * a una) es seguro: el SQL impreso siempre refleja el set completo y actual
 * de imágenes de ese listing en tu DB local, no solo las de esta corrida.
 */
import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';
import { buildImagesSql } from './lib/images-sql.js';

const [listingId, ...filePaths] = process.argv.slice(2);

if (!listingId || filePaths.length === 0) {
  console.error(
    'Uso: node scripts/upload-listing-images.js <listingId> <archivo1> [archivo2] ...'
  );
  process.exit(1);
}

if (
  !process.env.CLOUDINARY_CLOUD_NAME ||
  !process.env.CLOUDINARY_API_KEY ||
  !process.env.CLOUDINARY_API_SECRET
) {
  console.error(
    'Faltan las credenciales de Cloudinary en .env (CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET).'
  );
  process.exit(1);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const prisma = new PrismaClient();

async function main() {
  const listing = await prisma.listing.findUnique({
    where: { id: listingId },
  });
  if (!listing) {
    throw new Error(`No existe ningún listing con id ${listingId}`);
  }

  console.log(`📤 Subiendo ${filePaths.length} imagen(es) a Cloudinary...`);
  const urls = [];
  for (const filePath of filePaths) {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: 'bookings/images',
    });
    console.log(`  ✅ ${filePath} -> ${result.secure_url}`);
    urls.push(result.secure_url);
  }

  const { count } = await prisma.image.deleteMany({
    where: { listingId, url: { not: { contains: 'res.cloudinary.com' } } },
  });
  if (count > 0) {
    console.log(`🗑️  Borré ${count} imagen(es) placeholder existentes.`);
  }

  await prisma.image.createMany({
    data: urls.map((url) => ({ url, listingId })),
  });

  const allImages = await prisma.image.findMany({
    where: { listingId },
    orderBy: { createdAt: 'asc' },
    select: { url: true },
  });
  const allUrls = allImages.map((img) => img.url);

  console.log(
    `🎉 Listo. "${listing.title}" ahora tiene ${allUrls.length} imagen(es) reales en Cloudinary (en esta corrida).\n`
  );
  console.log(
    '--- SQL para replicar este mismo estado en otra base (ej. la VPS) ---\n'
  );
  console.log(
    buildImagesSql({ listingId, urls: allUrls, title: listing.title })
  );
}

main()
  .catch((e) => {
    console.error('❌ Falló:', e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
