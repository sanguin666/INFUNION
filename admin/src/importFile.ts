/**
 * Reading a community's member list (Seb, 9 Nov 2026): an Excel file, a
 * CSV, or cells pasted from a spreadsheet, into a header row and data
 * rows; then guessing which of our fields each column is, in any of the
 * admin's languages. The rows are cleaned on the server.
 */
import { readSheet } from 'read-excel-file/browser';

export const FIELDS = ['firstName', 'lastName', 'fullName', 'email', 'phone', 'whatsapp', 'telegram', 'language', 'groups'] as const;
export type Field = (typeof FIELDS)[number];
export type Mapping = (Field | 'skip')[];

export type Table = { headers: string[]; rows: string[][] };

function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

/** Drops empty lines and pads every row to the header's width. */
function tidy(all: string[][]): Table {
  const lines = all.filter((row) => row.some((v) => v !== ''));
  if (lines.length === 0) return { headers: [], rows: [] };
  const width = Math.max(...lines.map((r) => r.length));
  const pad = (row: string[]) => Array.from({ length: width }, (_, i) => row[i] ?? '');
  const [first, ...rest] = lines.map(pad);
  // No header row (the first line already holds an email or a phone):
  // name the columns by letter and keep that line as data.
  const looksLikeData = first.some((v) => /@/.test(v) || /^\+?[\d\s().-]{9,}$/.test(v));
  if (looksLikeData) {
    return { headers: first.map((_, i) => String.fromCharCode(65 + (i % 26))), rows: [first, ...rest] };
  }
  return { headers: first.map((h, i) => h || String.fromCharCode(65 + (i % 26))), rows: rest };
}

/** CSV or pasted cells: the separator is whichever of tab, ; or , the first line uses most. */
export function parseText(text: string): Table {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const counts = ['\t', ';', ','].map((sep) => [sep, firstLine.split(sep).length - 1] as const);
  const sep = counts.sort((a, b) => b[1] - a[1])[0][1] > 0 ? counts[0][0] : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else value += ch;
    } else if (ch === '"' && value === '') quoted = true;
    else if (ch === sep) {
      row.push(value.trim());
      value = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value.trim());
      rows.push(row);
      row = [];
      value = '';
    } else value += ch;
  }
  if (value !== '' || row.length > 0) {
    row.push(value.trim());
    rows.push(row);
  }
  return tidy(rows);
}

export async function readFile(file: File): Promise<Table> {
  if (/\.(xlsx|xlsm)$/i.test(file.name)) {
    const data = await readSheet(file);
    return tidy(data.map((r) => r.map(cell)));
  }
  if (/\.xls$/i.test(file.name)) throw new Error('old_excel');
  const buffer = await file.arrayBuffer();
  // Excel's own CSV export on Windows is not UTF-8: fall back to Latin-1.
  let text = new TextDecoder('utf-8').decode(buffer);
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buffer);
  return parseText(text.replace(/^﻿/, ''));
}

const WORDS: Record<Field, string[]> = {
  firstName: ['first name', 'firstname', 'given name', 'nombre', 'nom de pila', 'prénom', 'prenom', 'nom propi', 'primeiro nome', 'nome próprio', 'nome proprio', 'forename'],
  lastName: ['last name', 'lastname', 'surname', 'family name', 'apellido', 'apellidos', 'cognom', 'cognoms', 'nom de famille', 'apelido', 'apelidos', 'sobrenome', 'último nome', 'ultimo nome'],
  fullName: ['full name', 'name', 'nombre completo', 'nom complet', 'nom i cognoms', 'nome completo', 'nom', 'nome', 'contacto', 'contact', 'miembro', 'membre', 'socio'],
  email: ['email', 'e-mail', 'mail', 'correo', 'correo electrónico', 'correo electronico', 'courriel', 'adresse e-mail', 'adresse mail', 'correu', 'correu electrònic', 'correo-e', 'endereço de email'],
  phone: ['phone', 'telephone', 'mobile', 'cell', 'teléfono', 'telefono', 'móvil', 'movil', 'celular', 'téléphone', 'portable', 'tel', 'tél', 'telèfon', 'mòbil', 'telemóvel', 'telemovel', 'número', 'numero'],
  whatsapp: ['whatsapp', 'wa', 'whats app'],
  telegram: ['telegram', 'tg'],
  language: ['language', 'idioma', 'langue', 'llengua', 'lingua', 'língua', 'lang'],
  groups: ['group', 'groups', 'grupo', 'grupos', 'groupe', 'groupes', 'grup', 'grups', 'ministry', 'ministerio', 'equipo', 'equipe', 'équipe', 'tags', 'etiquetas', 'categoría', 'categoria'],
};

function fold(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[_.:*]/g, ' ').replace(/\s+/g, ' ').trim();
}

const FOLDED = Object.fromEntries(Object.entries(WORDS).map(([f, words]) => [f, words.map(fold)])) as Record<Field, string[]>;

export function guessField(header: string, sample: string[]): Field | 'skip' {
  const h = fold(header);
  for (const field of FIELDS) if (FOLDED[field].includes(h)) return field;
  for (const field of ['whatsapp', 'telegram', 'email', 'phone', 'lastName', 'firstName', 'groups', 'language'] as Field[]) {
    if (FOLDED[field].some((w) => w.length > 3 && h.includes(w))) return field;
  }
  // Untitled columns: guess from what is in them.
  const filled = sample.filter(Boolean);
  if (filled.length > 0 && filled.every((v) => /@/.test(v))) return 'email';
  if (filled.length > 0 && filled.every((v) => /^\+?[\d\s().-]{9,}$/.test(v))) return 'phone';
  return 'skip';
}

/** One guess per column, never the same field twice. */
export function guessMapping(table: Table): Mapping {
  const used = new Set<Field>();
  return table.headers.map((header, i) => {
    const guess = guessField(header, table.rows.slice(0, 20).map((r) => r[i]));
    if (guess === 'skip' || (used.has(guess) && guess !== 'groups')) return 'skip';
    used.add(guess);
    return guess;
  });
}

/** The rows as the server takes them; a full name is split at its first space. */
export function rowsFor(table: Table, mapping: Mapping): Record<string, string>[] {
  return table.rows.map((row) => {
    const out: Record<string, string> = {};
    mapping.forEach((field, i) => {
      const value = row[i]?.trim();
      if (field === 'skip' || !value) return;
      if (field === 'fullName') {
        const [first, ...rest] = value.split(/\s+/);
        out.firstName ??= first;
        if (rest.length) out.lastName ??= rest.join(' ');
        return;
      }
      if (field === 'groups' && out.groups) out.groups = `${out.groups}, ${value}`;
      else out[field] = value;
    });
    return out;
  });
}
