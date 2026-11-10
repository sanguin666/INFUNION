import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { HomePageVersion, VersionBadge, VersionBlock } from './home-version.entity.js';

/** At most this many versions per community (Seb, 9 Nov 2026). */
export const MAX_HOME_VERSIONS = 5;

export type HomeVersionSummary = {
  id: string;
  name: string;
  auto: boolean;
  live: boolean;
  sections: { type: string; title: string | null }[];
  badges: number;
  important: boolean;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class HomeVersionsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async list(poiId: string): Promise<{ versions: HomeVersionSummary[]; max: number }> {
    const versions = await this.dataSource.getRepository(HomePageVersion).find({
      where: { poiId },
      order: { live: 'DESC', updatedAt: 'DESC' },
    });
    return { versions: versions.map(summary), max: MAX_HOME_VERSIONS };
  }

  /** Saves the page as it is now under a name; it becomes the live version. */
  async save(poiId: string, name: string): Promise<HomeVersionSummary> {
    return this.dataSource.transaction(async (manager) => {
      await this.makeRoom(manager, poiId);
      const { blocks, badges } = await this.snapshot(manager, poiId);
      await manager.update(HomePageVersion, { poiId, live: true }, { live: false });
      const version = await manager.save(
        manager.create(HomePageVersion, { poiId, name: name.trim(), auto: false, live: true, blocks, badges }),
      );
      return summary(version);
    });
  }

  /**
   * Puts a version live. The page as it is now is kept first: in the live
   * version when there is one, otherwise in an automatic copy, so going
   * back is always possible.
   */
  async use(poiId: string, id: string): Promise<HomeVersionSummary> {
    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(HomePageVersion);
      const target = await repo.findOne({ where: { id, poiId } });
      if (!target) throw new NotFoundException('Unknown version');
      const now = await this.snapshot(manager, poiId);
      const live = await repo.findOne({ where: { poiId, live: true } });
      if (live && live.id !== target.id) {
        live.blocks = now.blocks;
        live.badges = now.badges;
        live.live = false;
        await repo.save(live);
      } else if (!live && (now.blocks.length > 0 || now.badges.length > 0)) {
        await this.makeRoom(manager, poiId, target.id);
        await repo.save(
          repo.create({
            poiId,
            name: `Before “${target.name}”`.slice(0, 60),
            auto: true,
            live: false,
            blocks: now.blocks,
            badges: now.badges,
          }),
        );
      }
      await this.apply(manager, poiId, target);
      target.live = true;
      return summary(await repo.save(target));
    });
  }

  async rename(poiId: string, id: string, name: string): Promise<HomeVersionSummary> {
    const repo = this.dataSource.getRepository(HomePageVersion);
    const version = await repo.findOne({ where: { id, poiId } });
    if (!version) throw new NotFoundException('Unknown version');
    version.name = name.trim();
    version.auto = false;
    return summary(await repo.save(version));
  }

  async remove(poiId: string, id: string): Promise<void> {
    const result = await this.dataSource.getRepository(HomePageVersion).delete({ id, poiId });
    if (!result.affected) throw new NotFoundException('Unknown version');
  }

  /** At the limit, the oldest automatic copy makes way; with none, saving is refused. */
  private async makeRoom(manager: EntityManager, poiId: string, keepId?: string): Promise<void> {
    const repo = manager.getRepository(HomePageVersion);
    const all = await repo.find({ where: { poiId }, order: { updatedAt: 'ASC' } });
    if (all.length < MAX_HOME_VERSIONS) return;
    const oldestAuto = all.find((v) => v.auto && !v.live && v.id !== keepId);
    if (!oldestAuto) throw new ConflictException('versions_full');
    await repo.delete({ id: oldestAuto.id });
  }

  private async snapshot(manager: EntityManager, poiId: string): Promise<{ blocks: VersionBlock[]; badges: VersionBadge[] }> {
    const blocks: VersionBlock[] = await manager.query(
      `SELECT id, type, position, title, body, image_url AS "imageUrl", item_count AS "itemCount"
         FROM poi_page_blocks WHERE poi_id = $1 ORDER BY position`,
      [poiId],
    );
    const badges: VersionBadge[] = await manager.query(
      `SELECT id, kind, position, enabled, text, important, link_module AS "linkModule",
              campaign_id AS "campaignId", to_char(show_until, 'YYYY-MM-DD') AS "showUntil"
         FROM poi_badges WHERE poi_id = $1 ORDER BY position`,
      [poiId],
    );
    return { blocks, badges };
  }

  /** Replaces the page's sections and badges with the version's (same ids, so translations stay). */
  private async apply(manager: EntityManager, poiId: string, version: HomePageVersion): Promise<void> {
    await manager.query(`DELETE FROM poi_page_blocks WHERE poi_id = $1`, [poiId]);
    await manager.query(`DELETE FROM poi_badges WHERE poi_id = $1`, [poiId]);
    for (const b of version.blocks) {
      await manager.query(
        `INSERT INTO poi_page_blocks (id, poi_id, type, position, title, body, image_url, item_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [b.id, poiId, b.type, b.position, b.title, b.body, b.imageUrl, b.itemCount],
      );
    }
    for (const b of version.badges) {
      await manager.query(
        `INSERT INTO poi_badges (id, poi_id, kind, position, enabled, text, important, link_module, campaign_id, show_until)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [b.id, poiId, b.kind, b.position, b.enabled, b.text, b.important, b.linkModule, b.campaignId, b.showUntil],
      );
    }
  }
}

function summary(version: HomePageVersion): HomeVersionSummary {
  return {
    id: version.id,
    name: version.name,
    auto: version.auto,
    live: version.live,
    sections: version.blocks.map((b) => ({ type: b.type, title: b.title })),
    badges: version.badges.filter((b) => b.enabled).length,
    important: version.badges.some((b) => b.enabled && b.kind === 'message' && b.important),
    createdAt: version.createdAt,
    updatedAt: version.updatedAt,
  };
}
