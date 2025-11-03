CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- c72be13b-a4ac-48f7-b116-d17d77c67545 Rosario
-- d6fea1ee-fea5-4784-867f-dc3f87567357 Córdoba
-- e8be00c7-ff00-4102-bf84-da338a4a3633 Mendoza
-- 1045aaa7-7317-444a-a877-3dc1d97fcea7 Ciudad de Buenos Aires
INSERT INTO listings (
  id, title, description, address, "pricePerNight", "propertyType",
  rooms, bathrooms, beds, "petFriendly", "maxGuests" ,
  "cityId", "userEmail" , "createdAt", "featured"
)
VALUES
-- ===============================
-- Ciudad de Buenos Aires
-- ===============================
('223200df-ee5e-4f61-b26e-b74a455d292e', 'Apartamento moderno en Recoleta',
 'Departamento luminoso, a metros de Av. Santa Fe. Ideal para estadías cortas, totalmente equipado y con balcón.',
 'Av. Santa Fe 2450, Recoleta', 95.0, 'Apartamento completo',
 2, 1, 2, TRUE, 4,
 '1045aaa7-7317-444a-a877-3dc1d97fcea7', 'admin@reservar.com', NOW(), TRUE),

('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', 'Penthouse con vista al río en Puerto Madero',
 'Penthouse exclusivo con terraza privada y vista panorámica al río. Seguridad 24hs y amenities premium.',
 'Olga Cossettini 1200, Puerto Madero', 250.0, 'Penthouse',
 3, 2, 3, FALSE, 6,
 '1045aaa7-7317-444a-a877-3dc1d97fcea7', 'admin@reservar.com', NOW(), TRUE),

-- ===============================
-- Rosario
-- ===============================
('1ede20e6-fa06-4797-a7e3-15cea1cf2af6', 'Estudio con balcón en Pichincha',
 'Estudio cómodo y moderno a pasos de bares y restaurantes. Excelente conexión wifi y aire acondicionado.',
 'Catamarca 1500, Pichincha', 55.0, 'Estudio',
 1, 1, 1, FALSE, 2,
 'c72be13b-a4ac-48f7-b116-d17d77c67545', 'admin@reservar.com', NOW(), TRUE),

('f9f5f0fb-891b-43cc-b034-40d71adef71f', 'Casa completa con patio en Echesortu',
 'Casa familiar con amplio patio y parrilla. Ideal para grupos o familias. Zona tranquila y segura.',
 'Mendoza 3500, Echesortu', 110.0, 'Casa completa',
 3, 2, 4, TRUE, 6,
 'c72be13b-a4ac-48f7-b116-d17d77c67545', 'admin@reservar.com', NOW(), TRUE),

-- ===============================
-- Córdoba
-- ===============================
('1a3317c4-ad16-4596-88ae-96fa64d18c6d', 'Loft minimalista en Güemes',
 'Loft luminoso con cocina integrada y cama king. A pocos metros del Paseo Güemes y del Buen Pastor.',
 'Achával Rodríguez 300, Güemes', 78.0, 'Loft',
 1, 1, 1, FALSE, 2,
 'd6fea1ee-fea5-4784-867f-dc3f87567357', 'admin@reservar.com', NOW(), TRUE),

('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', 'Cabaña en las sierras de Córdoba',
 'Cabaña rústica con deck y vista a las sierras. Parrilla, pileta y cochera techada. Ideal para descansar.',
 'Av. Julio A. Roca s/n, Villa General Belgrano', 130.0, 'Cabaña',
 2, 1, 3, TRUE, 5,
 'd6fea1ee-fea5-4784-867f-dc3f87567357', 'admin@reservar.com', NOW(), TRUE),

-- ===============================
-- Mendoza
-- ===============================
('83d79e1d-0c68-4b0e-960b-f95c7d2142ea', 'Bungalow entre viñedos en Luján de Cuyo',
 'Bungalow privado rodeado de viñedos, con galería, fogón y parrilla. A minutos de bodegas reconocidas.',
 'Ruta 15 km 10, Luján de Cuyo', 185.0, 'Bungalow',
 2, 1, 2, TRUE, 4,
 'e8be00c7-ff00-4102-bf84-da338a4a3633', 'admin@reservar.com', NOW(), TRUE),

('5d737958-a1e9-4d60-be21-8f8d55d7e604', 'Suite con vista a la montaña',
 'Suite elegante con ventanales al cordón del Plata, jacuzzi y desayuno incluido. En complejo turístico con spa.',
 'Av. San Martín 3200, Chacras de Coria', 210.0, 'Suite',
 1, 1, 1, FALSE, 2,
 'e8be00c7-ff00-4102-bf84-da338a4a3633', 'admin@reservar.com', NOW(), TRUE);



INSERT INTO "listingAmenities" ("listingId", "amenityId")
VALUES
-- 🏙️ Apartamento moderno en Recoleta
('223200df-ee5e-4f61-b26e-b74a455d292e', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('223200df-ee5e-4f61-b26e-b74a455d292e', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('223200df-ee5e-4f61-b26e-b74a455d292e', '8a5f5874-9afd-4d21-9df4-93e4bb2d0a95'), -- Aire acondicionado
('223200df-ee5e-4f61-b26e-b74a455d292e', '8703c30d-027d-4a21-8152-2a4b9f4ae669'), -- TV
('223200df-ee5e-4f61-b26e-b74a455d292e', 'bc7c7a9b-5230-42b5-8a1d-e3ae60d199bc'), -- Balcón
('223200df-ee5e-4f61-b26e-b74a455d292e', 'dd05368f-b998-4957-bc9b-9e4aad1eda9b'), -- Ascensor

-- 🌇 Penthouse con vista al río en Puerto Madero
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', '8a5f5874-9afd-4d21-9df4-93e4bb2d0a95'), -- Aire acondicionado
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', '8703c30d-027d-4a21-8152-2a4b9f4ae669'), -- TV
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', 'b6146db4-55a8-4602-9205-d792c90c8629'), -- Terraza
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', '5a46475e-1cc4-4a37-80b6-d8c38e6dddae'), -- Jacuzzi
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', '94c4cacf-d846-4dfe-99e6-6292f242153a'), -- Vista al mar
('a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', 'dd05368f-b998-4957-bc9b-9e4aad1eda9b'), -- Ascensor

-- 🏢 Estudio con balcón en Pichincha
('1ede20e6-fa06-4797-a7e3-15cea1cf2af6', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('1ede20e6-fa06-4797-a7e3-15cea1cf2af6', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('1ede20e6-fa06-4797-a7e3-15cea1cf2af6', '8a5f5874-9afd-4d21-9df4-93e4bb2d0a95'), -- Aire acondicionado
('1ede20e6-fa06-4797-a7e3-15cea1cf2af6', '8703c30d-027d-4a21-8152-2a4b9f4ae669'), -- TV
('1ede20e6-fa06-4797-a7e3-15cea1cf2af6', 'bc7c7a9b-5230-42b5-8a1d-e3ae60d199bc'), -- Balcón

-- 🏡 Casa completa con patio en Echesortu
('f9f5f0fb-891b-43cc-b034-40d71adef71f', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('f9f5f0fb-891b-43cc-b034-40d71adef71f', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('f9f5f0fb-891b-43cc-b034-40d71adef71f', 'd1bc3b46-90d3-4ecf-96e7-62c37f72fb8e'), -- Parking
('f9f5f0fb-891b-43cc-b034-40d71adef71f', '40ed7355-e7a9-41d5-8126-e41bd195a302'), -- BBQ
('f9f5f0fb-891b-43cc-b034-40d71adef71f', 'ba3c9309-b17c-4d2a-b314-228adcd852ef'), -- Jardín
('f9f5f0fb-891b-43cc-b034-40d71adef71f', 'bc7c7a9b-5230-42b5-8a1d-e3ae60d199bc'), -- Balcón

-- 🏢 Loft minimalista en Güemes
('1a3317c4-ad16-4596-88ae-96fa64d18c6d', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('1a3317c4-ad16-4596-88ae-96fa64d18c6d', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('1a3317c4-ad16-4596-88ae-96fa64d18c6d', '8a5f5874-9afd-4d21-9df4-93e4bb2d0a95'), -- Aire acondicionado
('1a3317c4-ad16-4596-88ae-96fa64d18c6d', '48599004-fd83-44a2-adde-61d570283a6f'), -- Calefacción
('1a3317c4-ad16-4596-88ae-96fa64d18c6d', 'bc7c7a9b-5230-42b5-8a1d-e3ae60d199bc'), -- Balcón
('1a3317c4-ad16-4596-88ae-96fa64d18c6d', 'dd05368f-b998-4957-bc9b-9e4aad1eda9b'), -- Ascensor

-- 🌲 Cabaña en las sierras de Córdoba
('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', '4645e533-b97d-4479-b20b-f96b0d7b9aa5'), -- Piscina
('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', '40ed7355-e7a9-41d5-8126-e41bd195a302'), -- BBQ
('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', '5211225e-636a-4e25-930d-b7a4ab6923e5'), -- Chimenea
('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', 'fd4d15f5-82d4-4428-939a-3967a6637a38'), -- Vistas a la montaña
('fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', 'ba3c9309-b17c-4d2a-b314-228adcd852ef'), -- Jardín

-- 🍇 Bungalow entre viñedos en Luján de Cuyo
('83d79e1d-0c68-4b0e-960b-f95c7d2142ea', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('83d79e1d-0c68-4b0e-960b-f95c7d2142ea', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('83d79e1d-0c68-4b0e-960b-f95c7d2142ea', 'd1bc3b46-90d3-4ecf-96e7-62c37f72fb8e'), -- Parking
('83d79e1d-0c68-4b0e-960b-f95c7d2142ea', '40ed7355-e7a9-41d5-8126-e41bd195a302'), -- BBQ
('83d79e1d-0c68-4b0e-960b-f95c7d2142ea', 'ba3c9309-b17c-4d2a-b314-228adcd852ef'), -- Jardín
('83d79e1d-0c68-4b0e-960b-f95c7d2142ea', 'fd4d15f5-82d4-4428-939a-3967a6637a38'), -- Vistas a la montaña

-- 🏔️ Suite con vista a la montaña
('5d737958-a1e9-4d60-be21-8f8d55d7e604', '9ee5bb7e-78b5-4491-ade5-223d4dccadce'), -- WiFi
('5d737958-a1e9-4d60-be21-8f8d55d7e604', '165f8f8e-ce81-4851-b487-636edde6d79f'), -- Cocina
('5d737958-a1e9-4d60-be21-8f8d55d7e604', '8a5f5874-9afd-4d21-9df4-93e4bb2d0a95'), -- Aire acondicionado
('5d737958-a1e9-4d60-be21-8f8d55d7e604', '5a46475e-1cc4-4a37-80b6-d8c38e6dddae'), -- Jacuzzi
('5d737958-a1e9-4d60-be21-8f8d55d7e604', 'fd4d15f5-82d4-4428-939a-3967a6637a38'), -- Vistas a la montaña
('5d737958-a1e9-4d60-be21-8f8d55d7e604', '2b0a2f4d-e1e4-4503-b07e-68836cea558c'); -- Spa


CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO reviews (id, rating, comment, "userEmail", "listingId", "createdAt")
VALUES
-- 🏙️ Apartamento moderno en Recoleta
(uuid_generate_v4(), 5, 'Excelente ubicación, limpio y moderno. Ideal para escapadas cortas.', 'admin@reservar.com', '223200df-ee5e-4f61-b26e-b74a455d292e', NOW()),

-- 🌇 Penthouse con vista al río en Puerto Madero
(uuid_generate_v4(), 5, 'Un lujo total. Las vistas al río son increíbles y el jacuzzi un plus.', 'admin@reservar.com', 'a48c15b7-44d2-4dba-8b8b-e2b5947a9aeb', NOW()),

-- 🏢 Estudio con balcón en Pichincha
(uuid_generate_v4(), 4, 'Cómodo y bien ubicado. Ideal para una o dos personas.', 'admin@reservar.com', '1ede20e6-fa06-4797-a7e3-15cea1cf2af6', NOW()),

-- 🏡 Casa completa con patio en Echesortu
(uuid_generate_v4(), 5, 'Casa espaciosa, con parrilla y patio hermoso. Perfecta para familias.', 'admin@reservar.com', 'f9f5f0fb-891b-43cc-b034-40d71adef71f', NOW()),

-- 🏢 Loft minimalista en Güemes
(uuid_generate_v4(), 4, 'Muy moderno y bien decorado. El barrio es excelente.', 'admin@reservar.com', '1a3317c4-ad16-4596-88ae-96fa64d18c6d', NOW()),

-- 🌲 Cabaña en las sierras de Córdoba
(uuid_generate_v4(), 5, 'La mejor experiencia, rodeado de naturaleza. Súper recomendable.', 'admin@reservar.com', 'fc2ad8d4-d24e-4dd1-ac93-2dcabeba42e3', NOW()),

-- 🍇 Bungalow entre viñedos en Luján de Cuyo
(uuid_generate_v4(), 5, 'Increíble lugar entre viñedos, paz total y atención de primera.', 'admin@reservar.com', '83d79e1d-0c68-4b0e-960b-f95c7d2142ea', NOW()),

-- 🏔️ Suite con vista a la montaña
(uuid_generate_v4(), 5, 'Un lujo. Despertarse con las montañas enfrente no tiene precio.', 'admin@reservar.com', '5d737958-a1e9-4d60-be21-8f8d55d7e604', NOW());


CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

INSERT INTO images (id, url, "createdAt", "listingId")
SELECT
  uuid_generate_v4(),
  '/default.jpg',
  NOW(),
  l.id
FROM listings l;