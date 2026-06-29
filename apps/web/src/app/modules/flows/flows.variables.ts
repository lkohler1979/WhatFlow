import type { FlowNode } from './flows.models';

/**
 * Suporte a variáveis dinâmicas no Flow Builder (T-025).
 *
 * Espelha a semântica de interpolação do backend
 * (`apps/api/src/modules/flow-engine/flow-engine.service.ts` → `interpolate`):
 * substitui `{{ chave }}` (com trim) pelo valor; ausente → string vazia.
 */

/** Variável conhecida do fluxo + valor de exemplo usado no preview. */
export interface VarInfo {
  name: string;
  /** Valor de exemplo exibido no preview (não persiste). */
  sample: string;
}

/** Regex idêntica à do FlowEngine: `{{ chave }}` com chaves `[\w.]`. */
const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/** Variáveis de sistema sempre disponíveis, com amostras para preview. */
const SYSTEM_VARS: VarInfo[] = [
  { name: 'numero', sample: '5527999990000' },
  { name: 'ultima_mensagem', sample: 'oi' },
  { name: 'opcao_selecionada', sample: '1' },
];

/**
 * Deriva a lista de variáveis conhecidas a partir do grafo atual:
 * sistema + `data.name` de todo nó `VARIABLE`.
 * A amostra de uma variável de usuário é o `data.value` (se houver) ou um placeholder.
 */
export function deriveVariables(nodes: FlowNode[]): VarInfo[] {
  const seen = new Set<string>(SYSTEM_VARS.map(v => v.name));
  const out: VarInfo[] = [...SYSTEM_VARS];
  for (const n of nodes) {
    if (n.type !== 'VARIABLE') continue;
    const name = typeof n.data?.['name'] === 'string' ? (n.data['name'] as string).trim() : '';
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const value = n.data?.['value'];
    const sample = typeof value === 'string' && value.trim() ? value : '<valor de exemplo>';
    out.push({ name, sample });
  }
  return out;
}

/** Substitui `{{var}}` pelos valores informados; ausente → string vazia. */
export function interpolate(text: string, vars: Record<string, string>): string {
  return text.replace(VAR_RE, (_m, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

/** Interpola usando as amostras das variáveis conhecidas. */
export function interpolateSamples(text: string, variables: VarInfo[]): string {
  const map: Record<string, string> = {};
  for (const v of variables) map[v.name] = v.sample;
  return interpolate(text, map);
}

/**
 * Retorna os nomes de variáveis usados no texto que NÃO constam na lista
 * de variáveis conhecidas (preserva ordem, sem duplicar).
 */
export function unknownVariables(text: string, variables: VarInfo[]): string[] {
  const known = new Set(variables.map(v => v.name));
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const m of text.matchAll(VAR_RE)) {
    const key = m[1];
    if (!known.has(key) && !seen.has(key)) {
      seen.add(key);
      bad.push(key);
    }
  }
  return bad;
}
