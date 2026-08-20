/**
 * Prints ready-to-paste SQL to replace a listing's images, given URLs that
 * are ALREADY uploaded to Cloudinary (e.g. from a previous `npm run
 * upload-images` run). Doesn't touch any database itself — just generates
 * the SQL so you can run it wherever the target Postgres actually lives
 * (e.g. via psql on the VPS, where this script has no direct network access).
 *
 * If you're uploading fresh files, `npm run upload-images` already prints
 * this same SQL at the end — you only need this script when you already
 * have the Cloudinary URLs from somewhere else.
 *
 * Usage:
 *   node scripts/generate-listing-images-sql.js <listingId> <url1> [url2] [url3] ...
 */
import { PrismaClient } from '@prisma/client';
import { buildImagesSql } from './lib/images-sql.js';

const [listingId, ...urls] = process.argv.slice(2);

if (!listingId || urls.length === 0) {
  console.error(
    'Uso: node scripts/generate-listing-images-sql.js <listingId> <url1> [url2] ...'
  );
  process.exit(1);
}

const invalidUrls = urls.filter((u) => !/^https?:\/\//.test(u));
if (invalidUrls.length > 0) {
  console.error(`Esto no parece una URL: ${invalidUrls.join(', ')}`);
  process.exit(1);
}

// Solo para el comentario del SQL - no es necesario que la DB esté
// accesible desde acá (por eso el catch silencioso).
async function tryGetListingTitle() {
  try {
    const prisma = new PrismaClient();
    const listing = await prisma.listing.findUnique({
      where: { id: listingId },
      select: { title: true },
    });
    await prisma.$disconnect();
    return listing?.title ?? null;
  } catch {
    return null;
  }
}

async function main() {
  const title = await tryGetListingTitle();
  console.log(buildImagesSql({ listingId, urls, title }));
}

main();
