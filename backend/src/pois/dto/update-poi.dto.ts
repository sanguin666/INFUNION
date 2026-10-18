import { OmitType, PartialType } from '@nestjs/mapped-types';
import { CreatePoiDto } from './create-poi.dto.js';

// The kind of place is set when the community is created and changed only
// by the superadmin (Seb, 18 Oct 2026), so a community's own admin can't.
export class UpdatePoiDto extends PartialType(OmitType(CreatePoiDto, ['type'] as const)) {}
