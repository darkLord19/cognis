# Cognis PRD Parity Implementation Plan

**Goal:** Achieve full PRD parity by refactoring runtime, API, and persistence layers.

**Architecture:** Move from singleton/mutable state to run-scoped runtime registry and append-only state persistence.

**Tech Stack:** Bun, TypeScript, SQLite (append-only), SSE/WS.

---

### Task 1: Runtime and Persistence Foundation

**Files:**
- Create: `server/core/run-supervisor.ts`
- Modify: `server/core/bootstrap.ts`, `server/core/orchestrator.ts`, `server/persistence/migrations/009-run-state.sql`

- [ ] **Step 1: Implement RunSupervisor** (Done in prev turn)
- [ ] **Step 2: Add run_state_events table migration**
- [ ] **Step 3: Refactor Orchestrator to accept run-scoped context**
- [ ] **Step 4: Update bootstrap to use RunSupervisor**
- [ ] **Step 5: Verify multi-run startup and independent clocks**

### Task 2: Management API Parity

**Files:**
- Modify: `server/api/management-api.ts`, `server/ws/server.ts`

- [ ] **Step 1: Rebuild route handlers around RunRegistry**
- [ ] **Step 2: Add config, agent, and audit endpoints**
- [ ] **Step 3: Implement run-scoped watcher SSE**

### Task 3: WebSocket Subscription Model

**Files:**
- Modify: `shared/types.ts`, `server/ws/server.ts`

- [ ] **Step 1: Define typed WS subscription protocol**
- [ ] **Step 2: Implement per-run WS subscriptions**

### Task 4: Operator Services (Arnold Mode & Interventions)

**Files:**
- Create: `server/api/intervention-pipeline.ts`
- Modify: `server/agents/will-engine.ts`

- [ ] **Step 1: Implement Arnold Mode session manager**
- [ ] **Step 2: Implement intervention pipeline**
