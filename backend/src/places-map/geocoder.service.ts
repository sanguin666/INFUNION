import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export type GeocodeResult = {
  label: string;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string | null;
  postalCode: string | null;
};

type NominatimHit = {
  display_name: string;
  lat: string;
  lon: string;
  address?: Record<string, string | undefined>;
};

const CACHE_LIMIT = 500;
const PACE_KEY = 'geocoder:last-call';

/**
 * Turns an address or a town into coordinates with OpenStreetMap's
 * Nominatim: free and keyless, in exchange for its usage policy — at most
 * one request a second, a User-Agent naming the app, and no
 * search-as-you-type. So this is only called when somebody presses
 * Search, requests are queued a second apart, and answers are cached.
 * NOMINATIM_URL can point at another Nominatim (a paid one, or our own)
 * if infunion outgrows the public server, and GEOCODER_MIN_INTERVAL_MS
 * loosens the pace for one that allows more.
 *
 * The second apart holds across every copy of the API: each call takes
 * its turn through a Postgres lock and a shared last-call time.
 */
@Injectable()
export class GeocoderService {
  private readonly logger = new Logger(GeocoderService.name);
  private readonly baseUrl = (process.env.NOMINATIM_URL ?? 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
  private readonly cache = new Map<string, GeocodeResult[]>();
  private readonly minIntervalMs = Number(process.env.GEOCODER_MIN_INTERVAL_MS ?? 1000);

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async search(query: string, language?: string): Promise<GeocodeResult[]> {
    const q = query.trim().replace(/\s+/g, ' ');
    if (q.length < 2) return [];
    const key = `${language ?? ''}|${q.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const results = await this.throttled(() => this.fetchFromNominatim(q, language));
    if (this.cache.size >= CACHE_LIMIT) {
      this.cache.delete(this.cache.keys().next().value as string);
    }
    this.cache.set(key, results);
    return results;
  }

  // One call at a time, a second apart, whoever asks and on whichever copy.
  private async throttled<T>(task: () => Promise<T>): Promise<T> {
    if (this.minIntervalMs > 0) {
      await this.dataSource.transaction(async (manager) => {
        await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [PACE_KEY]);
        const rows = (await manager.query('SELECT first_at FROM rate_limits WHERE key = $1', [PACE_KEY])) as {
          first_at: Date;
        }[];
        const last = rows[0] ? new Date(rows[0].first_at).getTime() : 0;
        const wait = last + this.minIntervalMs - Date.now();
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
        await manager.query(
          `INSERT INTO rate_limits (key, count, first_at, updated_at) VALUES ($1, 1, now(), now())
           ON CONFLICT (key) DO UPDATE SET first_at = now(), count = rate_limits.count + 1, updated_at = now()`,
          [PACE_KEY],
        );
      });
    }
    return task();
  }

  private async fetchFromNominatim(q: string, language?: string): Promise<GeocodeResult[]> {
    const url = new URL(`${this.baseUrl}/search`);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', '5');
    let hits: NominatimHit[];
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'infunion community app (hello@infunion.app)',
          ...(language ? { 'Accept-Language': language === 'va' ? 'ca' : language } : {}),
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      hits = (await response.json()) as NominatimHit[];
    } catch (error) {
      this.logger.warn(`Address lookup failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException('Address lookup is unavailable right now');
    }
    return hits.map(toResult);
  }
}

function toResult(hit: NominatimHit): GeocodeResult {
  const a = hit.address ?? {};
  const street = [a.road ?? a.pedestrian ?? a.square ?? a.place, a.house_number].filter(Boolean).join(' ');
  return {
    label: hit.display_name,
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    address: street || null,
    city: a.city ?? a.town ?? a.village ?? a.municipality ?? null,
    postalCode: a.postcode ?? null,
  };
}
