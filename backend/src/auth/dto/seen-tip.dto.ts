import { Matches } from 'class-validator';

/** A tip's key, such as "tour" or "page:events". */
export class SeenTipDto {
  @Matches(/^[a-z0-9:-]{1,40}$/)
  key!: string;
}
