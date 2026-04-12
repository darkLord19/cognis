import type { SimEvent } from "../../shared/events";

export type EventCallback = (event: SimEvent) => void;

export class EventBus {
  private listeners: Map<string, EventCallback[]> = new Map();
  private anyListeners: EventCallback[] = [];
  private buffer: SimEvent[] = [];
  private flushCallback: ((events: SimEvent[]) => void) | undefined;
  private timer: Timer | null = null;
  private readonly BUFFER_SIZE = 50;
  private readonly FLUSH_TIMEOUT_MS = 100;

  constructor(flushCallback?: (events: SimEvent[]) => void) {
    this.flushCallback = flushCallback;
  }

  emit(event: SimEvent): void {
    const type = event.type;
    const callbacks = this.listeners.get(type) || [];
    for (const cb of callbacks) {
      cb(event);
    }
    for (const cb of this.anyListeners) {
      cb(event);
    }

    if (this.flushCallback) {
      this.buffer.push(event);
      if (this.buffer.length >= this.BUFFER_SIZE) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.FLUSH_TIMEOUT_MS);
      }
    }
  }

  private flush(): void {
    if (this.buffer.length > 0 && this.flushCallback) {
      this.flushCallback([...this.buffer]);
      this.buffer = [];
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  on(type: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(type) || [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }

  off(type: string, callback: EventCallback): void {
    const callbacks = this.listeners.get(type);
    if (callbacks) {
      this.listeners.set(
        type,
        callbacks.filter((cb) => cb !== callback),
      );
    }
  }

  onAny(callback: EventCallback): void {
    this.anyListeners.push(callback);
  }
}
