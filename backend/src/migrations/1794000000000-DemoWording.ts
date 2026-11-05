import type { MigrationInterface, QueryRunner } from 'typeorm';

const DEMOS = `(SELECT id FROM pois WHERE qr_code_token IN ('DEMO-CARMEN', 'DEMO-STMARYS', 'DEMO-HOLYTRINITY'))`;

/**
 * The demo communities follow the glossary (Seb, 3 Nov 2026): the team,
 * never the office or "despacho". Only the demo communities change; real
 * communities keep what they wrote.
 */
export class DemoWording1794000000000 implements MigrationInterface {
  name = 'DemoWording1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const renames: [string, string, string, string][] = [
      ['Despacho abierto', 'Despacho', 'Horario de atención', 'Entrada lateral'],
      ['Despacho abierto (sábado)', 'Despacho', 'Horario de atención (sábado)', 'Entrada lateral'],
      ['Office open', 'Community office', 'Opening hours', 'Side entrance'],
    ];
    for (const [oldTitle, oldLocation, title, location] of renames) {
      await queryRunner.query(
        `UPDATE events SET title = $3, location = CASE WHEN location = $2 THEN $4 ELSE location END
         WHERE title = $1 AND poi_id IN ${DEMOS}`,
        [oldTitle, oldLocation, title, location],
      );
    }
    const texts: [string, string][] = [
      ['Inscripción en el despacho.', 'Inscripción con el equipo.'],
      ['El despacho abre martes y jueves', 'El equipo atiende martes y jueves'],
      ['o en el despacho.', 'o con el equipo.'],
      ['the community office will be closed on Monday', 'the team will be away on Monday'],
      ['The community office is open weekdays', 'The team is here weekdays'],
    ];
    for (const [from, to] of texts) {
      await queryRunner.query(
        `UPDATE events SET description = replace(description, $1, $2) WHERE poi_id IN ${DEMOS}`,
        [from, to],
      );
      await queryRunner.query(`UPDATE announcements SET body = replace(body, $1, $2) WHERE poi_id IN ${DEMOS}`, [
        from,
        to,
      ]);
      await queryRunner.query(`UPDATE poi_page_blocks SET body = replace(body, $1, $2) WHERE poi_id IN ${DEMOS}`, [
        from,
        to,
      ]);
    }
    await queryRunner.query(
      `UPDATE service_requests SET appointment_place = 'Sala de reuniones'
       WHERE appointment_place = 'Despacho' AND poi_id IN ${DEMOS}`,
    );
    await queryRunner.query(
      `UPDATE users SET last_name = 'Equipo' WHERE email = 'admin@carmen.example' AND last_name = 'Despacho'`,
    );
  }

  public async down(): Promise<void> {
    // Demo wording only: nothing to undo.
  }
}
