import { logger } from '@core/logger.js';
import { advance } from './flow-engine.service.js';
import { flowEngineRepository as repo } from './flow-engine.repository.js';
import { flowsRepository } from '@modules/flows/flows.repository.js';
import { evolutionApiService } from '@integrations/evolution-api/evolution-api.service.js';
import type { FlowGraph, FlowNode, FlowEdge } from './flow-engine.types.js';
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

interface RunBotCtx {
  tenantId: string;
  instanceId: string;
  evolutionKey: string;
  conversationId: string;
  botActive: boolean;
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

      const result = advance(toGraph(flow), state, ctx.text);

      // Envia e persiste as mensagens de saída (apenas texto por enquanto).
      for (const m of result.messages) {
        if (m.type !== 'text' || !m.text) continue;
        await evolutionApiService
          .sendText(ctx.evolutionKey, { number: ctx.contactPhone, text: m.text })
          .catch(err => logger.warn({ err }, 'Falha ao enviar mensagem do fluxo'));
        await repo.createOutboundMessage(ctx.conversationId, m.text);
        await repo.touchConversation(ctx.conversationId, m.text);
      }

      // Ações: por ora tratamos assign_agent (desliga o bot p/ atendimento humano).
      for (const a of result.actions) {
        if (a.kind === 'assign_agent') {
          await repo.setBotActive(ctx.conversationId, false);
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
