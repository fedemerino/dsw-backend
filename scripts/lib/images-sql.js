const sqlEscape = (s) => s.replace(/'/g, "''");

/**
 * Builds the ready-to-paste SQL that replaces a listing's images with the
 * given (already uploaded) URLs. Used both by upload-listing-images.js
 * (to print it right after uploading) and generate-listing-images-sql.js
 * (to generate it standalone from URLs you already have).
 * @param {Object} params
 * @param {string} params.listingId
 * @param {string[]} params.urls
 * @param {string | null} [params.title] - Only used for a readable comment.
 * @returns {string}
 */
export function buildImagesSql({ listingId, urls, title }) {
  const values = urls
    .map(
      (url) =>
        `  (uuid_generate_v4(), '${sqlEscape(url)}', NOW(), '${sqlEscape(listingId)}')`
    )
    .join(',\n');

  const header = title
    ? `-- "${title}" (${listingId})`
    : `-- listing ${listingId}`;

  return `${header}
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DELETE FROM images WHERE "listingId" = '${sqlEscape(listingId)}';

INSERT INTO images (id, url, "createdAt", "listingId") VALUES
${values};
`;
}
