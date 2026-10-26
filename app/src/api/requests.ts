import { apiGet, apiPost, apiPostForm } from './client';
import { appendPickedFile, type PickedFile } from './files';

// What a member can ask their community for from the app. The office
// answers each one from the dashboard.
export type RequestType =
  | 'baptism'
  | 'wedding'
  | 'funeral'
  | 'first_communion'
  | 'confirmation'
  | 'certificate'
  | 'meeting'
  | 'blessing'
  | 'sick_visit'
  | 'registration'
  | 'other';

export type RequestStatus = 'received' | 'in_progress' | 'appointment_set' | 'completed' | 'cancelled';

// A private file. `url` is a relative, signed link that works for about an
// hour: prefix it with API_BASE_URL (see uploadUri in api/client.ts).
export type RequestFile = { name: string; mime: string | null; url: string };

export type RequestMessage = {
  id: string;
  fromStaff: boolean;
  authorName: string | null;
  body: string | null;
  attachment: RequestFile | null;
  createdAt: string;
};

// A paper the office asked for (a birth certificate, a baptism record).
export type RequestDocument = {
  id: string;
  label: string;
  note: string | null;
  receivedAt: string | null;
  file: RequestFile | null;
  createdAt: string;
};

export type RequestSummary = {
  id: string;
  type: RequestType;
  status: RequestStatus;
  contactName: string;
  contactPhone: string | null;
  details: string;
  preferredDate: string | null;
  appointmentAt: string | null;
  appointmentPlace: string | null;
  documentsPending: number;
  // The office did something since the member last opened it.
  unread: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RequestDetail = RequestSummary & {
  messages: RequestMessage[];
  documents: RequestDocument[];
};

export type NewRequest = {
  type: RequestType;
  contactName: string;
  contactPhone?: string | null;
  details: string;
  preferredDate?: string | null;
};

const base = (poiId: string) => `/pois/${encodeURIComponent(poiId)}/requests`;

export function createRequest(poiId: string, body: NewRequest): Promise<RequestDetail> {
  return apiPost<RequestDetail>(base(poiId), body);
}

export function getMyRequests(poiId: string): Promise<RequestSummary[]> {
  return apiGet<RequestSummary[]>(`${base(poiId)}/mine`);
}

/** Opening a request also marks what the office wrote as read. */
export function getMyRequest(poiId: string, id: string): Promise<RequestDetail> {
  return apiGet<RequestDetail>(`${base(poiId)}/mine/${encodeURIComponent(id)}`);
}

export function cancelMyRequest(poiId: string, id: string): Promise<RequestDetail> {
  return apiPost<RequestDetail>(`${base(poiId)}/mine/${encodeURIComponent(id)}/cancel`);
}

export async function sendRequestMessage(
  poiId: string,
  id: string,
  body: string,
  file?: PickedFile | null,
): Promise<RequestDetail> {
  const formData = new FormData();
  if (body) formData.append('body', body);
  if (file) await appendPickedFile(formData, 'file', file);
  return apiPostForm<RequestDetail>(`${base(poiId)}/mine/${encodeURIComponent(id)}/messages`, formData);
}

export async function uploadRequestDocument(
  poiId: string,
  id: string,
  documentId: string,
  file: PickedFile,
): Promise<RequestDetail> {
  const formData = new FormData();
  await appendPickedFile(formData, 'file', file);
  return apiPostForm<RequestDetail>(
    `${base(poiId)}/mine/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/file`,
    formData,
  );
}
