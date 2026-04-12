export interface GlassRoomSession {
  runId: string;
  agentId: string;
  startTick: number;
  startedAt: number;
}

export class GlassRoomManager {
  private sessions: Map<string, GlassRoomSession> = new Map();

  enterGlassRoom(runId: string, agentId: string, startTick: number): GlassRoomSession {
    const session = {
      runId,
      agentId,
      startTick,
      startedAt: Date.now(),
    };
    this.sessions.set(`${runId}:${agentId}`, session);
    console.log(`Glass Room started for ${agentId} in run ${runId}`);
    return session;
  }

  exitGlassRoom(runId: string, agentId: string): boolean {
    this.sessions.delete(`${runId}:${agentId}`);
    console.log(`Glass Room ended for ${agentId} in run ${runId}`);
    return true;
  }

  isAgentInGlassRoom(runId: string, agentId: string): boolean {
    return this.sessions.has(`${runId}:${agentId}`);
  }

  getSession(runId: string, agentId: string): GlassRoomSession | null {
    return this.sessions.get(`${runId}:${agentId}`) ?? null;
  }
}
