/**
 * Utilitário de parsing de CSV no cliente para extrair telefones de uma lista
 * de destinatários de campanha (T-035). Reusa a mesma heurística de
 * detecção de coluna e normalização de telefone do import de contatos do
 * backend (T-041): delimitador `,`/`;`, coluna phone/telefone/numero/whatsapp,
 * normalização para dígitos e validação 8–15 dígitos com DDI.
 *
 * O preview (válidos/inválidos/duplicados) é confirmado no backend via
 * /contacts/validate-phones; este util serve para feedback imediato e para
 * montar a lista `phones` enviada ao create da campanha.
 */

export interface CsvPhonesResult {
  /** Telefones normalizados e únicos (válidos). */
  phones: string[];
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  /** Amostras de linhas inválidas para o preview (linha + valor original). */
  invalidSamples: { line: number; value: string }[];
}

const PHONE_HEADERS = ['phone', 'telefone', 'numero', 'número', 'whatsapp'];

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function isValidPhone(value: string): boolean {
  return /^[1-9]\d{7,14}$/.test(value);
}

function pickDelimiter(header: string): string {
  const comma = (header.match(/,/g) ?? []).length;
  const semicolon = (header.match(/;/g) ?? []).length;
  return semicolon > comma ? ';' : ',';
}

function parseLine(line: string, delimiter: string): string[] {
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
      continue;
    }
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  values.push(current.trim());
  return values;
}

export function parseCsvPhones(csv: string): CsvPhonesResult {
  const lines = csv
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter(l => l.trim().length > 0);

  const empty: CsvPhonesResult = {
    phones: [],
    total: 0,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    invalidSamples: [],
  };
  if (lines.length === 0) return empty;

  const delimiter = pickDelimiter(lines[0]);
  const headers = parseLine(lines[0], delimiter).map(h => h.trim().toLowerCase());
  let phoneIndex = headers.findIndex(h => PHONE_HEADERS.includes(h));

  // Sem cabeçalho reconhecível: trata a primeira coluna de todas as linhas
  // como telefone (CSV de uma coluna só, sem header).
  let startLine = 1;
  if (phoneIndex === -1) {
    phoneIndex = 0;
    startLine = 0;
  }

  const seen = new Set<string>();
  const phones: string[] = [];
  const invalidSamples: { line: number; value: string }[] = [];
  let total = 0;
  let invalid = 0;
  let duplicates = 0;

  for (let i = startLine; i < lines.length; i += 1) {
    const raw = parseLine(lines[i], delimiter)[phoneIndex] ?? '';
    total += 1;
    const phone = normalizePhone(raw);
    if (!isValidPhone(phone)) {
      invalid += 1;
      if (invalidSamples.length < 20) invalidSamples.push({ line: i + 1, value: raw });
      continue;
    }
    if (seen.has(phone)) {
      duplicates += 1;
      continue;
    }
    seen.add(phone);
    phones.push(phone);
  }

  return { phones, total, valid: phones.length, invalid, duplicates, invalidSamples };
}
