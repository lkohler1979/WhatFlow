import { analyticsService } from './analytics.service.js';
import type { AnalyticsPeriod } from './analytics.schema.js';
import type { ExportReport } from './analytics-export.schema.js';

/** BOM UTF-8 — faz o Excel reconhecer o encoding e abrir acentos sem erro. */
export const UTF8_BOM = '﻿';

/** Resultado de um export: conteúdo CSV (com BOM) + nome de arquivo sugerido. */
export interface ExportResult {
  filename: string;
  csv: string;
}

/**
 * Escapa um campo CSV. Envolve em aspas quando contém vírgula, aspas, quebra de
 * linha ou ponto-e-vírgula; aspas internas são duplicadas. Mesmo padrão do
 * export de contatos (T-041) para consistência.
 */
function csvEscape(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!/[",\n\r;]/.test(raw)) return raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

/** Monta uma matriz (cabeçalho + linhas) em texto CSV com CRLF (amigável ao Excel). */
function toCsv(rows: unknown[][]): string {
  return rows.map(cols => cols.map(csvEscape).join(',')).join('\r\n');
}

/** Sufixo de período para o nome do arquivo: `20260601-20260630`. */
function periodSlug(p: AnalyticsPeriod): string {
  const day = (d: Date): string => d.toISOString().slice(0, 10).replace(/-/g, '');
  return `${day(p.from)}-${day(p.to)}`;
}

/** Série temporal de mensagens: bucket, recebidas, enviadas, total. */
async function messagesCsv(tenantId: string, p: AnalyticsPeriod): Promise<string> {
  const data = await analyticsService.messagesSeries(tenantId, p);
  const rows: unknown[][] = [['bucket', 'recebidas', 'enviadas', 'total']];
  for (const pt of data.series) {
    rows.push([pt.bucket, pt.inbound, pt.outbound, pt.inbound + pt.outbound]);
  }
  return toCsv(rows);
}

/** Resumo de campanhas: uma linha por status + linhas de totais de envio. */
async function campaignsCsv(tenantId: string, p: AnalyticsPeriod): Promise<string> {
  const { campaigns } = await analyticsService.campaignsSummary(tenantId, p);
  const rows: unknown[][] = [['metrica', 'valor']];
  rows.push(['total', campaigns.total]);
  for (const [status, count] of Object.entries(campaigns.byStatus)) {
    rows.push([`status_${status}`, count]);
  }
  rows.push(['mensagens_enviadas', campaigns.sent]);
  rows.push(['mensagens_entregues', campaigns.delivered]);
  rows.push(['mensagens_falhas', campaigns.failed]);
  return toCsv(rows);
}

/** KPIs consolidados em formato chave/valor (uma métrica por linha). */
async function overviewCsv(tenantId: string, p: AnalyticsPeriod): Promise<string> {
  const o = await analyticsService.overview(tenantId, p);
  const rows: unknown[][] = [['metrica', 'valor']];
  rows.push(['conversas_total', o.conversations.total]);
  for (const [status, count] of Object.entries(o.conversations.byStatus)) {
    rows.push([`conversas_${status}`, count]);
  }
  rows.push(['mensagens_total', o.messages.total]);
  rows.push(['mensagens_recebidas', o.messages.inbound]);
  rows.push(['mensagens_enviadas', o.messages.outbound]);
  rows.push(['contatos_total', o.contacts.total]);
  for (const [status, count] of Object.entries(o.instances.byStatus)) {
    rows.push([`instancias_${status}`, count]);
  }
  rows.push(['campanhas_total', o.campaigns.total]);
  rows.push(['campanhas_enviadas', o.campaigns.sent]);
  rows.push(['campanhas_entregues', o.campaigns.delivered]);
  rows.push(['campanhas_falhas', o.campaigns.failed]);
  return toCsv(rows);
}

export const analyticsExportService = {
  /**
   * Gera o CSV (com BOM UTF-8) do relatório pedido, reusando o
   * `analyticsService` (T-044) — sem duplicar queries. Devolve conteúdo e
   * nome de arquivo `relatorio-<report>-<periodo>.csv`.
   */
  async export(tenantId: string, report: ExportReport, p: AnalyticsPeriod): Promise<ExportResult> {
    let body: string;
    if (report === 'messages') body = await messagesCsv(tenantId, p);
    else if (report === 'campaigns') body = await campaignsCsv(tenantId, p);
    else body = await overviewCsv(tenantId, p);

    return {
      filename: `relatorio-${report}-${periodSlug(p)}.csv`,
      csv: UTF8_BOM + body,
    };
  },
};
