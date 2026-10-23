import "server-only";
import { EventEmitter } from "node:events";

export type SystemEvent = {
  action: string;
  entityType: string;
  entityId?: string | number | null;
  timestamp: number;
};

class SystemEventBus extends EventEmitter {
  constructor() {
    super();

    this.setMaxListeners(0);
  }
}

const globalForEvents = globalThis as unknown as { systemEventBus?: SystemEventBus };
export const systemEventBus = globalForEvents.systemEventBus ?? new SystemEventBus();
if (process.env.NODE_ENV !== "production") {
  globalForEvents.systemEventBus = systemEventBus;
}

export function emitSystemEvent(event: Omit<SystemEvent, "timestamp">) {
  systemEventBus.emit("change", { ...event, timestamp: Date.now() });
}

export function isRealtimeEnabled(): boolean {
  return process.env.ENABLE_REALTIME !== "false";
}
