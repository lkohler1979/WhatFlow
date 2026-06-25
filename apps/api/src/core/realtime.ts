import type { Server as SocketServer } from 'socket.io';
import { logger } from './logger.js';

let io: SocketServer | null = null;

/** Registra a instância do Socket.io (chamado no setup do app). */
export function setIo(server: SocketServer): void {
  io = server;
}

/** Emite um evento para todos os sockets de um tenant (sala `tenant:<id>`). */
export function emitToTenant(tenantId: string, event: string, payload: unknown): void {
  if (!io) {
    logger.debug({ event }, 'Socket.io ainda não inicializado — emit ignorado');
    return;
  }
  io.to(`tenant:${tenantId}`).emit(event, payload);
}
