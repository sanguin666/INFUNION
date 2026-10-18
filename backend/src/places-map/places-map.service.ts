import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Poi } from '../pois/entities/poi.entity.js';
import { PoiType } from '../common/enums/poi-type.enum.js';
import { PlacesQueryDto } from './dto/places-query.dto.js';

/** One place on the map or in "near you": what a passer-by may see. */
export type MapPlace = {
  id: string;
  name: string;
  type: PoiType;
  description: string | null;
  pictureUrl: string | null;
  address: string | null;
  city: string | null;
  postalCode: string | null;
  latitude: number;
  longitude: number;
  qrCodeToken: string;
  menuOrder: string[];
  memberCount: number;
  // Kilometres from the point asked about; null when none was given.
  distanceKm: number | null;
};

// Great-circle distance in km (haversine), straight in SQL so the database
// sorts and cuts. Fine for the thousands of places ANSAE will hold; PostGIS
// can take over if that ever becomes millions.
const DISTANCE_SQL = `(2 * 6371 * asin(sqrt(
  power(sin(radians(poi.latitude - :lat) / 2), 2) +
  cos(radians(:lat)) * cos(radians(poi.latitude)) *
  power(sin(radians(poi.longitude - :lng) / 2), 2)
)))`;

@Injectable()
export class PlacesMapService {
  constructor(
    @InjectRepository(Poi)
    private readonly poisRepository: Repository<Poi>,
  ) {}

  async findPlaces(query: PlacesQueryDto): Promise<MapPlace[]> {
    const near = query.lat !== undefined && query.lng !== undefined;
    if ((query.lat === undefined) !== (query.lng === undefined)) {
      throw new BadRequestException('lat and lng go together');
    }

    const qb = this.poisRepository
      .createQueryBuilder('poi')
      .select([
        'poi.id AS id',
        'poi.name AS name',
        'poi.type AS type',
        'poi.description AS description',
        'poi.picture_url AS "pictureUrl"',
        'poi.address AS address',
        'poi.city AS city',
        'poi.postal_code AS "postalCode"',
        'poi.latitude AS latitude',
        'poi.longitude AS longitude',
        'poi.qr_code_token AS "qrCodeToken"',
        'poi.menu_order AS "menuOrder"',
      ])
      .addSelect(
        (sub) => sub.select('COUNT(*)::int').from('user_pois', 'm').where('m.poi_id = poi.id'),
        'memberCount',
      )
      // Left off: suspended places, the ones that asked not to be shown,
      // and those nobody has placed on the map yet.
      .where('poi.suspended_at IS NULL')
      .andWhere('poi.map_visible = true')
      .andWhere('poi.latitude IS NOT NULL AND poi.longitude IS NOT NULL')
      .limit(query.limit ?? (near ? 50 : 500));

    if (query.types?.length) {
      qb.andWhere('poi.type IN (:...types)', { types: query.types });
    }

    if (near) {
      qb.addSelect(DISTANCE_SQL, 'distanceKm').setParameters({ lat: query.lat, lng: query.lng });
      if (query.radiusKm !== undefined) {
        qb.andWhere(`${DISTANCE_SQL} <= :radiusKm`, { radiusKm: query.radiusKm });
      }
      qb.orderBy('"distanceKm"', 'ASC');
    } else {
      qb.orderBy('poi.name', 'ASC');
    }

    const rows = await qb.getRawMany<MapPlace & { distanceKm?: number | string | null }>();
    return rows.map((row) => ({
      ...row,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      memberCount: Number(row.memberCount ?? 0),
      distanceKm: near ? Math.round(Number(row.distanceKm) * 100) / 100 : null,
    }));
  }
}
