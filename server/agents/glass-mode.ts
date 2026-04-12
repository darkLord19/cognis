export interface GlassModeSession {
  runId: string;
  agentId: string;
  startTick: number;
  startedAt: number;
}

export class GlassModeManager {
  private sessions: Map<string, GlassModeSession> = new Map();

  enterGlassMode(runId: string, agentId: string, startTick: number): GlassModeSession {
    const session = {
      runId,
      agentId,
      startTick,
      startedAt: Date.now(),
    };
    this.sessions.set(`${runId}:${agentId}`, session);
    console.log(`Glass Mode started for ${agentId} in run ${runId}`);
    return session;
  }

  exitGlassMode(runId: string, agentId: string): boolean {
    this.sessions.delete(`${runId}:${agentId}`);
    console.log(`Glass Mode ended for ${agentId} in run ${runId}`);
    return true;
  }

  isAgentInGlassMode(runId: string, agentId: string): boolean {
    return this.sessions.has(`${runId}:${agentId}`);
  }

  getSession(runId: string, agentId: string): GlassModeSession | null {
    return this.sessions.get(`${runId}:${agentId}`) ?? null;
  }
}
