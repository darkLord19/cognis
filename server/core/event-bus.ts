import type { EventType, SimEvent } from "../../shared/events";

export type EventHandler = (event: SimEvent) => void;

export class EventBus {
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private anyHandlers: Set<EventHandler> = new Set();
  private dbBuffer: SimEvent[] = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private maxBufferSize = 50;
  private flushIntervalMs = 100;

  constructor(private dbFlushCallback?: (events: SimEvent[]) => Promise<void> | void) {}

  public emit(event: SimEvent): void {
    // Sync dispatch
    const specificHandlers = this.handlers.get(event.type);
    if (specificHandlers) {
      for (const handler of specificHandlers) {
        try {
          handler(event);
        } catch (e) {
          console.error(`Error in event handler for ${event.type}:`, e);
        }
      }
    }

    for (const handler of this.anyHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error(`Error in onAny handler for ${event.type}:`, e);
      }
    }

    // Async DB persist
    if (this.dbFlushCallback) {
      this.dbBuffer.push(event);
      if (this.dbBuffer.length >= this.maxBufferSize) {
        this.flush();
      } else if (!this.flushTimeout) {
        this.flushTimeout = setTimeout(() => this.flush(), this.flushIntervalMs);
      }
    }
  }

  public on(type: EventType, handler: EventHandler): void {
    let set = this.handlers.get(type);
    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }
    set.add(handler);
  }

  public off(type: EventType, handler: EventHandler): void {
    const set = this.handlers.get(type);
    if (set) {
      set.delete(handler);
    }
  }

  public onAny(handler: EventHandler): void {
    this.anyHandlers.add(handler);
  }

  public offAny(handler: EventHandler): void {
    this.anyHandlers.delete(handler);
  }

  public flush(): void {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    if (this.dbBuffer.length > 0 && this.dbFlushCallback) {
      const events = [...this.dbBuffer];
      this.dbBuffer = [];
      // Fire and forget
      void this.dbFlushCallback(events);
    }
  }
}
