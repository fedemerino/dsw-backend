import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

// Import JSON data
const provincesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, './provinces.json'), 'utf8')
);
const citiesData = JSON.parse(
  fs.readFileSync(path.join(__dirname, './cities.json'), 'utf8')
);
const paymentMethodsData = JSON.parse(
  fs.readFileSync(path.join(__dirname, './paymentMethods.json'), 'utf8')
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

  // Then seed payment methods
  console.log('💳 Seeding payment methods...');

  for (const paymentMethodData of paymentMethodsData) {
    await prisma.paymentMethod.upsert({
      where: { name: paymentMethodData.name },
      update: {
        description: paymentMethodData.description,
        active: paymentMethodData.active,
      },
      create: {
        name: paymentMethodData.name,
        description: paymentMethodData.description,
        active: paymentMethodData.active,
      },
    });
  }

  console.log(`✅ Created ${paymentMethodsData.length} payment methods`);
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

  const user = {
    email: 'admin@reservar.com',
    fullName: 'Admin User',
    phoneNumber: '1234567890',
    password: '$2b$12$cadvd.9S9SDz0f9JuHAnc.vbOkOBQJZMlosYpzrol.Dl6PuH4DH2S',
    isAdmin: true,
    active: true,
  };
  const existingUser = await prisma.user.findUnique({
    where: { email: user.email },
  });
  if (!existingUser) {
    await prisma.user.create({
      data: user,
    });
    console.log(`✅ Created admin user with email: ${user.email}`);
  } else {
    console.log(`ℹ️ Admin user with email ${user.email} already exists`);
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
