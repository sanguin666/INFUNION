import { DataSource, In, IsNull } from 'typeorm';
import { Poi } from './pois/entities/poi.entity.js';
import { PoiType } from './common/enums/poi-type.enum.js';
import { Language } from './common/enums/language.enum.js';
import { CARMEN_QR_TOKEN } from './seed-carmen.js';

// Carmen's church on the Plaça de l'Església, L'Eliana.
const CARMEN_PIN = { latitude: 39.5664, longitude: -0.5287 };

/**
 * Made-up neighbours for the demo of the map of communities (Seb, 18 Oct
 * 2026), one of each kind around L'Eliana and Valencia, so the map and
 * "near you" have something to show beside Carmen. They have no admin and
 * no content: tapping one shows its card and lets you join, nothing more.
 */
const DEMO_PLACES: Array<Partial<Poi> & { qrCodeToken: string }> = [
  {
    qrCodeToken: 'DEMO-MAP-SANTA-CECILIA',
    name: 'Coral Santa Cecilia',
    type: PoiType.CULTURE,
    description: 'Coro de voces mixtas. Ensayos los martes y jueves por la tarde.',
    address: 'Carrer Major, 12',
    city: 'L’Eliana',
    postalCode: '46183',
    latitude: 39.5652,
    longitude: -0.5262,
  },
  {
    qrCodeToken: 'DEMO-MAP-EL-PINAR',
    name: 'Asociación Vecinal El Pinar',
    type: PoiType.ASSOCIATION,
    description: 'Vecinos que se ayudan: reparto de alimentos, clases de español y fiestas del barrio.',
    address: 'Avinguda de les Corts Valencianes, 40',
    city: 'L’Eliana',
    postalCode: '46183',
    latitude: 39.5701,
    longitude: -0.5241,
  },
  {
    qrCodeToken: 'DEMO-MAP-AL-NOUR',
    name: 'Comunidad Islámica Al-Nour',
    type: PoiType.MOSQUE,
    description: 'Oración diaria, clases de árabe y acogida a las familias recién llegadas.',
    address: 'Carrer de València, 7',
    city: 'La Pobla de Vallbona',
    postalCode: '46185',
    latitude: 39.5878,
    longitude: -0.5523,
  },
  {
    qrCodeToken: 'DEMO-MAP-SAN-VICENTE',
    name: 'San Vicente Mártir',
    type: PoiType.CHURCH,
    description: 'Comunidad del centro de San Antonio de Benagéber.',
    address: 'Plaza de la Iglesia, 3',
    city: 'San Antonio de Benagéber',
    postalCode: '46184',
    latitude: 39.5574,
    longitude: -0.4994,
  },
  {
    qrCodeToken: 'DEMO-MAP-BET-SHALOM',
    name: 'Comunidad Bet Shalom',
    type: PoiType.SYNAGOGUE,
    description: 'Comunidad judía abierta a todos: Shabat, festividades y visitas guiadas.',
    address: 'Carrer de la Pau, 18',
    city: 'València',
    postalCode: '46002',
    latitude: 39.4738,
    longitude: -0.3734,
  },
  {
    qrCodeToken: 'DEMO-MAP-SANGHA',
    name: 'Centro Budista Sangha Túria',
    type: PoiType.OTHER_WORSHIP,
    description: 'Meditación los sábados por la mañana, abierta a principiantes.',
    address: 'Carrer de Sueca, 25',
    city: 'València',
    postalCode: '46006',
    latitude: 39.4616,
    longitude: -0.3772,
  },
  {
    qrCodeToken: 'DEMO-MAP-CLUB-PILOTA',
    name: 'Club de Pilota L’Eliana',
    type: PoiType.CULTURE,
    description: 'Pilota valenciana para todas las edades. Entrenamientos y partidas en el trinquet.',
    address: 'Carrer del Poliesportiu, 2',
    city: 'L’Eliana',
    postalCode: '46183',
    latitude: 39.5622,
    longitude: -0.5335,
  },
];

export async function seedMap(dataSource: DataSource): Promise<void> {
  const pois = dataSource.getRepository(Poi);

  // Carmen gets its pin once; after that the admin owns it.
  await pois.update({ qrCodeToken: CARMEN_QR_TOKEN, latitude: IsNull() }, CARMEN_PIN);

  const existing = await pois.find({ where: { qrCodeToken: In(DEMO_PLACES.map((p) => p.qrCodeToken)) } });
  const missing = DEMO_PLACES.filter((place) => !existing.some((row) => row.qrCodeToken === place.qrCodeToken));
  if (missing.length) {
    await pois.save(missing.map((place) => pois.create({ ...place, language: Language.ES })));
    console.log(`Seeded ${missing.length} demo places for the map`);
  }
}
