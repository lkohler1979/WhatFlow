import { z } from 'zod';

const FlowNodeSchema = z.object({
  id: z.string(),
  type: z.enum([
    'TEXT',
    'IMAGE',
    'AUDIO',
    'VIDEO',
    'DOCUMENT',
    'MENU',
    'CONDITION',
    'DELAY',
    'VARIABLE',
    'WEBHOOK_CALL',
    'AI',
    'ASSIGN_AGENT',
    'END',
  ]),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.record(z.unknown()),
});

const FlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
});

export const CreateFlowSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(500).optional(),
  instanceId: z.string().uuid().optional(),
  triggerType: z.enum(['KEYWORD', 'ANY_MESSAGE', 'FIRST_MESSAGE', 'SCHEDULE']),
  triggerValue: z.string().optional(),
  nodesJson: z.array(FlowNodeSchema).default([]),
  edgesJson: z.array(FlowEdgeSchema).default([]),
});

export const UpdateFlowSchema = CreateFlowSchema.partial();

export type CreateFlowDto = z.infer<typeof CreateFlowSchema>;
export type UpdateFlowDto = z.infer<typeof UpdateFlowSchema>;
