import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

/**
 * Reads the admin password from --password=<value> / --password <value>,
 * falling back to the ADMIN_PASSWORD env var. Returns null if neither is set.
 * @returns {string | null}
 */
function getAdminPassword() {
  const args = process.argv.slice(2);
  const eqArg = args.find((arg) => arg.startsWith('--password='));
  if (eqArg) return eqArg.slice('--password='.length);

  const flagIndex = args.indexOf('--password');
  if (flagIndex !== -1 && args[flagIndex + 1]) return args[flagIndex + 1];

  return process.env.ADMIN_PASSWORD || null;
}

// Import JSON data
const provincesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, './provinces.json'), 'utf8')
);
const citiesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, './cities.json'), 'utf8')
);

const amenitiesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, './amenities.json'), 'utf8')
);

// Seed function
async function main() {
  console.log('🌱 Starting database seeding...');

  // First, seed provinces
  console.log('📍 Seeding provinces...');
  const provinceMap = new Map();

  for (const provinceData of provincesData) {
    const province = await prisma.province.upsert({
      where: { id: provinceData.id },
      update: { name: provinceData.name },
      create: {
        id: provinceData.id,
        name: provinceData.name,
      },
    });
    provinceMap.set(provinceData.id, province);
  }

  console.log(`✅ Created ${provincesData.length} provinces`);

  // Then seed cities with references to provinces
  console.log('🏙️ Seeding cities...');

  const validCities = citiesData.filter((cityData) => {
    const hasProvince = provinceMap.has(cityData.province);
    if (!hasProvince) {
      console.warn(
        `⚠️ Province with id ${cityData.province} not found for city ${cityData.name}`
      );
    }
    return hasProvince;
  });

  console.log(`Processing ${validCities.length} valid cities...`);

  // Process cities in batches to avoid memory issues
  const batchSize = 1000;
  for (let i = 0; i < validCities.length; i += batchSize) {
    const batch = validCities.slice(i, i + batchSize);

    const cityCreateData = batch.map((cityData) => ({
      id: cityData.id || undefined,
      name: cityData.name,
      provinceId: cityData.province,
      imageUrl: cityData.imageUrl || null,
    }));

    await prisma.city.createMany({
      data: cityCreateData,
      skipDuplicates: true,
    });

    console.log(
      `Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validCities.length / batchSize)}`
    );
  }

  console.log(`✅ Created ${validCities.length} cities`);

  console.log('🎉 Database seeding completed successfully!');

  // Finally, seed amenities
  console.log('🏖️ Seeding amenities...');

  for (const amenityData of amenitiesData) {
    await prisma.amenity.upsert({
      where: { name: amenityData.name },
      update: {},
      create: {
        id: amenityData.id,
        name: amenityData.name,
      },
    });
  }

  const adminEmail = 'admin@reservar.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const adminPassword = getAdminPassword();
    if (!adminPassword) {
      throw new Error(
        'No se indicó contraseña para el admin. Corré: npm run seed -- --password=<contraseña> (o definí ADMIN_PASSWORD en el entorno).'
      );
    }
    if (adminPassword.length < 8) {
      throw new Error(
        'La contraseña del admin debe tener al menos 8 caracteres.'
      );
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    await prisma.user.create({
      data: {
        email: adminEmail,
        fullName: 'Admin User',
        phoneNumber: '1234567890',
        password: hashedPassword,
        active: true,
        emailVerified: true,
        roles: {
          create: {
            role: 'ADMIN',
          },
        },
      },
    });
    console.log(`✅ Created admin user with email: ${adminEmail}`);
  } else {
    console.log(`ℹ️ Admin user with email ${adminEmail} already exists`);
  }
  console.log(`✅ Created ${amenitiesData.length} amenities`);
  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
