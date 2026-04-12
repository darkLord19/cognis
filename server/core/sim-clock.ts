import { DEFAULT_CYCLE_LENGTH_TICKS, MAX_HEARTBEAT_WAIT_MS } from "../../shared/constants";
import type { TimeConfig } from "../../shared/types";

export type TickCallback = (tick: number) => Promise<void> | void;

export class SimClock {
  private tick = 0;
  private speedMultiplier = 1.0;
  private pendingSystem2Count = 0;
  private elasticHeartbeat = false;
  private maxHeartbeatWaitMs: number = MAX_HEARTBEAT_WAIT_MS;
  private tickDurationMs = 100;
  private isRunning = false;
  private cycleLengthTicks: number = DEFAULT_CYCLE_LENGTH_TICKS;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private onTick?: TickCallback | undefined;

  constructor(onTick?: TickCallback) {
    if (onTick) {
      this.onTick = onTick;
    }
  }

  public setCycleLength(length: number): void {
    this.cycleLengthTicks = length;
  }

  public start(config: TimeConfig): void {
    this.elasticHeartbeat = config.elasticHeartbeat;
    this.maxHeartbeatWaitMs = config.maxHeartbeatWaitMs;
    this.tickDurationMs = config.tickDurationMs;
    this.isRunning = true;
    this.runLoop();
  }

  public pause(): void {
    this.isRunning = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  public resume(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.runLoop();
    }
  }

  public setSpeed(multiplier: number): void {
    this.speedMultiplier = Math.max(0.1, multiplier);
  }

  public registerPendingMind(): void {
    this.pendingSystem2Count++;
  }

  public resolvePendingMind(): void {
    if (this.pendingSystem2Count > 0) {
      this.pendingSystem2Count--;
    }
  }

  public getTick(): number {
    return this.tick;
  }

  public getCircadianPhase(): number {
    if (this.cycleLengthTicks === 0) return 0;
    return (this.tick % this.cycleLengthTicks) / this.cycleLengthTicks;
  }

  public async advanceTick(): Promise<void> {
    if (this.elasticHeartbeat && this.pendingSystem2Count > 0) {
      const startTime = Date.now();
      while (this.pendingSystem2Count > 0 && Date.now() - startTime < this.maxHeartbeatWaitMs) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      if (this.pendingSystem2Count > 0) {
        console.warn(`Heartbeat timeout: proceeded after ${this.maxHeartbeatWaitMs}ms wait.`);
      }
    }

    this.tick++;
    if (this.onTick) {
      await this.onTick(this.tick);
    }
  }

  private async runLoop(): Promise<void> {
    if (!this.isRunning) return;

    await this.advanceTick();

    if (this.isRunning) {
      const delay = this.tickDurationMs / this.speedMultiplier;
      this.timeoutId = setTimeout(() => {
        this.runLoop();
      }, delay);
    }
  }
}
