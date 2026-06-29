import { logger } from '@core/logger.js';
import { advance, interpolate } from './flow-engine.service.js';
import { flowEngineRepository as repo } from './flow-engine.repository.js';
import { flowsRepository } from '@modules/flows/flows.repository.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import { aiService } from '@integrations/ai/ai.service.js';
import type { AiMessage } from '@integrations/ai/ai.interface.js';
import type { FlowGraph, FlowNode, FlowEdge, EngineResult } from './flow-engine.types.js';
import type { Flow, Prisma } from '@prisma/client';

/** Decide se o gatilho do fluxo casa com o texto recebido. */
function triggerMatches(flow: Flow, text: string): boolean {
  const t = text.trim().toLowerCase();
  switch (flow.triggerType) {
    case 'ANY_MESSAGE':
    case 'FIRST_MESSAGE':
      return true;
    case 'KEYWORD':
      return !!flow.triggerValue && t.includes(flow.triggerValue.toLowerCase());
    default:
      return false;
  }
}

function toGraph(flow: Flow): FlowGraph {
  return {
    nodes: (flow.nodesJson ?? []) as unknown as FlowNode[],
    edges: (flow.edgesJson ?? []) as unknown as FlowEdge[],
  };
}

/** Máximo de mensagens do histórico incluídas no contexto da IA. */
const AI_HISTORY_LIMIT = 10;

/**
 * Processa um nó de IA (action `ai`): monta o contexto (system = prompt do nó +
 * histórico da conversa + pergunta atual), chama o provedor e envia/persiste a
 * resposta. Best-effort: erros do provedor são logados e NÃO propagados.
 * Devolve o texto gerado (ou null) p/ guardar em variável da sessão.
 */
async function handleAiAction(
  ctx: RunBotCtx,
  graph: FlowGraph,
  result: EngineResult,
  action: { prompt?: string; nodeId: string },
): Promise<string | null> {
  const node = graph.nodes.find(n => n.id === action.nodeId);
  const vars = result.state.variables;
  const systemPrompt = interpolate(action.prompt ?? node?.data?.prompt ?? '', vars).trim();

  // Histórico cronológico → AiMessage[] (INBOUND→user, OUTBOUND→assistant).
  const history = await repo.loadHistory(ctx.conversationId, AI_HISTORY_LIMIT).catch(err => {
    logger.warn({ err, conversationId: ctx.conversationId }, 'Falha ao carregar histórico p/ IA');
    return [] as { direction: 'INBOUND' | 'OUTBOUND'; content: string }[];
  });

  const messages: AiMessage[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  for (const h of history) {
    messages.push({ role: h.direction === 'INBOUND' ? 'user' : 'assistant', content: h.content });
  }
  // Garante que a pergunta atual do usuário esteja presente (se ainda não está no fim do histórico).
  const last = messages[messages.length - 1];
  const current = (ctx.text ?? '').trim();
  if (current && !(last && last.role === 'user' && last.content.trim() === current)) {
    messages.push({ role: 'user', content: current });
  }
  if (messages.length === 0) return null;

  const data = node?.data as
    | { model?: string; temperature?: number; fallback?: string }
    | undefined;

  let aiText: string;
  try {
    const res = await aiService.generate(messages, {
      ...(data?.model ? { model: data.model } : {}),
      ...(typeof data?.temperature === 'number' ? { temperature: data.temperature } : {}),
    });
    aiText = res.content?.trim() ?? '';
    if (!aiText) {
      logger.warn(
        { conversationId: ctx.conversationId, nodeId: action.nodeId },
        'IA retornou vazio',
      );
      return null;
    }
  } catch (err) {
    logger.warn(
      { err, conversationId: ctx.conversationId, nodeId: action.nodeId },
      'Falha ao gerar resposta de IA (best-effort)',
    );
    // Fallback configurável: envia uma mensagem fixa se o nó definir `data.fallback`.
    const fallback = data?.fallback ? interpolate(data.fallback, vars).trim() : '';
    if (fallback) {
      await sendAndPersist(ctx, fallback);
    }
    return null;
  }

  await sendAndPersist(ctx, aiText);
  return aiText;
}

/** Envia uma mensagem de texto e persiste OUTBOUND + atualiza a conversa. */
async function sendAndPersist(ctx: RunBotCtx, text: string): Promise<void> {
  await evolutionApiService
    .sendText(ctx.evolutionKey, { number: ctx.replyTo, text })
    .catch(err => logger.warn({ err }, 'Falha ao enviar mensagem do fluxo'));
  await repo.createOutboundMessage(ctx.conversationId, text);
  await repo.touchConversation(ctx.conversationId, text);
}

interface RunBotCtx {
  tenantId: string;
  instanceId: string;
  evolutionKey: string;
  conversationId: string;
  botActive: boolean;
  /** Destino do envio (jid completo p/ @lid ou número p/ @s.whatsapp.net). */
  replyTo: string;
  /** Número do contato, usado na variável `numero` do fluxo. */
  contactPhone: string;
  text: string;
}

export const flowRunner = {
  /**
   * Executa o bot para uma mensagem recebida: resume a sessão (ou casa um gatilho),
   * roda o motor, envia as mensagens de saída e persiste a sessão. Best-effort —
   * nunca lança (uma falha do bot não pode quebrar a ingestão da mensagem).
   */
  async runBot(ctx: RunBotCtx): Promise<void> {
    try {
      if (!ctx.botActive) return;

      const session = await repo.findActiveSession(ctx.conversationId);
      let flow: Flow | null;
      let state;

      if (session) {
        flow = await flowsRepository.findByIdInTenant(session.flowId, ctx.tenantId);
        if (!flow) return;
        state = {
          currentNodeId: session.currentNodeId,
          variables: (session.variables ?? {}) as Record<string, unknown>,
          waitingForInput: session.waitingForInput,
        };
      } else {
        const candidates = await flowsRepository.findActivePublished(ctx.tenantId, ctx.instanceId);
        flow = candidates.find(f => triggerMatches(f, ctx.text)) ?? null;
        if (!flow) return;
        state = {
          currentNodeId: null,
          variables: { numero: ctx.contactPhone } as Record<string, unknown>,
          waitingForInput: false,
        };
      }

      const graph = toGraph(flow);
      const result = advance(graph, state, ctx.text);

      // Envia e persiste as mensagens de saída (apenas texto por enquanto).
      // MVP: as mensagens do `advance` saem primeiro, depois as respostas de IA.
      // A ordem ideal (intercalar IA no meio do fluxo) exigiria suspender/retomar
      // o engine no nó AI — fora do escopo deste MVP.
      for (const m of result.messages) {
        if (m.type !== 'text' || !m.text) continue;
        await sendAndPersist(ctx, m.text);
      }

      // Ações: assign_agent (desliga o bot) e ai (gera resposta contextual).
      for (const a of result.actions) {
        if (a.kind === 'assign_agent') {
          await repo.setBotActive(ctx.conversationId, false);
        } else if (a.kind === 'ai') {
          const aiText = await handleAiAction(ctx, graph, result, a);
          // Guarda a resposta da IA p/ uso posterior no fluxo (ex.: {{resposta_ia}}).
          if (aiText) result.state.variables.resposta_ia = aiText;
        }
      }

      const completed = result.status !== 'WAITING';
      const currentNodeId = result.state.currentNodeId ?? '__end__';
      if (session) {
        await repo.updateSession(session.id, {
          currentNodeId,
          variables: result.state.variables as Prisma.InputJsonValue,
          waitingForInput: result.state.waitingForInput,
          completed,
        });
      } else {
        await repo.createSession({
          flowId: flow.id,
          conversationId: ctx.conversationId,
          currentNodeId,
          variables: result.state.variables as Prisma.InputJsonValue,
          waitingForInput: result.state.waitingForInput,
          completed,
        });
      }

      logger.info(
        { flowId: flow.id, conversationId: ctx.conversationId, status: result.status },
        'Bot processou mensagem',
      );
    } catch (err) {
      logger.error({ err, conversationId: ctx.conversationId }, 'Falha ao executar o bot');
    }
  },
};
