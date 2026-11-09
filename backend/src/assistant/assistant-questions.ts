import type { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import type { AssistantInsight } from './assistant-model.js';

// The anonymised question text is erased after this many days; the topic stays.
export const QUESTION_KEEP_DAYS = 90;

/**
 * Keeps a question for statistics (Seb, 5 Nov 2026), never linked to the
 * person who asked; a failure here never costs the answer.
 */
export async function recordAssistantQuestion(
  dataSource: DataSource,
  logger: Logger,
  poiId: string,
  audience: 'member' | 'admin',
  language: string,
  insight: AssistantInsight,
): Promise<void> {
  try {
    await dataSource.query(
      `INSERT INTO assistant_questions (poi_id, audience, topic, answered, language, question) VALUES ($1, $2, $3, $4, $5, $6)`,
      [poiId, audience, insight.topic, insight.answered, language, insight.question || null],
    );
    await dataSource.query(
      `UPDATE assistant_questions SET question = NULL
       WHERE question IS NOT NULL AND created_at < now() - make_interval(days => $1)`,
      [QUESTION_KEEP_DAYS],
    );
  } catch (error) {
    logger.warn(`Could not record an assistant question: ${(error as Error).message}`);
  }
}
