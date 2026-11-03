import { IsIn, IsUUID } from 'class-validator';
import {
  REPORT_KINDS,
  REPORT_REASONS,
  type ReportKind,
  type ReportReason,
} from '../entities/content-report.entity.js';

export class CreateReportDto {
  @IsIn(REPORT_KINDS)
  kind!: ReportKind;

  @IsUUID()
  targetId!: string;

  @IsIn(REPORT_REASONS)
  reason!: ReportReason;
}

export class HidePersonDto {
  @IsIn(REPORT_KINDS)
  kind!: ReportKind;

  @IsUUID()
  targetId!: string;
}

export const RESOLVE_ACTIONS = ['remove', 'keep', 'remove_and_ban'] as const;
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

export class ResolveReportDto {
  @IsIn(REPORT_KINDS)
  kind!: ReportKind;

  @IsUUID()
  targetId!: string;

  @IsIn(RESOLVE_ACTIONS)
  action!: ResolveAction;
}
