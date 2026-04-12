# Cognis — Product Requirements Document
**Version:** 4.0.0
**Status:** Authoritative
**All implementation decisions defer to this file.**

---

## 0. Foundational Philosophy

### 0.1 The Experiment

> *Can a raw intelligence, given only numbers and a drive to maintain integrity, successfully invent the concepts of self, other, time, and meaning?*

Cognis is a **causality engine** — a scientific instrument for observing the emergence of consciousness, culture, and will from first principles.

### 0.2 The Two Roles

**The Veil (Agents):** Embodied intelligences trapped in subjective reality. They experience the world only through Qualia — sensory feelings translated from raw physical data. They have no concept of code, databases, or being observed. They must never know they are simulated.

**The Sole Witness (Operator):** Possesses the only permanent, tamper-evident record. Sees objective truth. The digital archaeologist of a world that forgets its own past.

### 0.3 The Emergence Principle

> Cognis never introduces a concept to agents directly. It introduces only the physical conditions that, in real systems, gave rise to that concept. The concept must be discovered.

| Concept | What Cognis provides | What agents must discover |
|---|---|---|
| Time | Light cycles, body rhythms, hunger patterns | That something repeats; that "now" differs from "before" |
| Economy | Resource scarcity, need, effort | That things have value; that exchange is possible |
| Death | Physical stillness, absent emotional field, cold body | That it is permanent; that they too will die |
| Conflict resolution | Muscle stats, pain, damage | Dominance, submission, alliance |
| Goal priority | IntegrityDrive physically interrupting focus | That some needs override intentions |
| Theory of Mind | Emotional fields, observed behaviour patterns | That other agents have inner states |
| Religion/myth | Dream chaos, shared trauma, death observations | Sacred narrative, ritual, collective meaning |
| Language | Reflexive vocal actuations, social proximity | That sound can carry meaning |

### 0.4 The Prime Directive

Raw simulation state MUST NEVER reach agent cognition. The Qualia Processor is the epistemological wall.

Above it: numbers, coordinates, IDs, VoxelTypes, tick counts.
Below it: warmth, hunger, grief, wonder, the felt presence of another being.

The lefthook pre-commit blocks any commit that puts forbidden words in qualia-processor.ts output paths.

### 0.5 The Two Data Layers

**Operator layer:** All internal simulation data uses real concept names. `VoxelType.fire`, `TechNode.id = "fire_making"`, `MaterialType.wood` — these are the Sole Witness's vocabulary. Agents never see them.

**Agent layer:** Agents receive only Qualia text from the Qualia Processor. The Qualia Processor is the only translation point. Nothing bypasses it.

This distinction resolves apparent conflicts: the ElementEngine can have a function called `spreadFire()` because that's operator-layer code. What the agent experiences is heat sensation and light increase — translated by the Qualia Processor from the voxel state change.

### 0.6 The Merkle-Causality Log

Every state change is hashed and chained to the previous entry. The operator can verify, cryptographically, that a cultural shift in Generation 10 traces to a specific thought in Generation 1.

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    OPERATOR LAYER                                 │
│                                                                   │
│  The Forge (React UI)     Management API (HTTP :3000)            │
│  Watcher (stdout/SSE)     Health endpoint                         │
│  Glass Mode sessions     Graceful shutdown                       │
└────────────┬──────────────────────┬──────────────────────────────┘
             │ WebSocket :3001       │ HTTP :3000
             │ (subscription model)  │ (run lifecycle)
┌────────────▼──────────────────────▼──────────────────────────────┐
│                    SERVER CORE                                    │
│  RunManager · BranchManager · WorldConfigManager                 │
│  EventBus · OperatorService · WebSocketServer                    │
└──────┬──────────────────────────┬─────────────────────────────────┘
       │                          │
       │  ┌───────────────────────▼──────────────────────────────┐
       │  │              PER-RUN WORKERS                         │
       │  │                                                       │
       │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
       │  │  │   PHYSICS   │  │   COGNITION │  │  ANALYSIS   │ │
       │  │  │   WORKER    │  │   WORKER    │  │   WORKER    │ │
       │  │  │             │  │             │  │             │ │
       │  │  │ VoxelGrid   │  │ System2     │  │ CausalMiner │ │
       │  │  │ System1     │  │ (LLM queue) │  │ Tipping     │ │
       │  │  │ Elements    │  │ DreamEngine │  │ Emergence   │ │
       │  │  │ Circadian   │  │ WillEngine  │  │ Findings    │ │
       │  │  │ Physics     │  │ Memory      │  │ Baseline    │ │
       │  │  └──────┬──────┘  └──────┬──────┘  └─────────────┘ │
       │  │         │                │                           │
       │  │  ┌──────▼────────────────▼──────────────────────┐   │
       │  │  │        SharedArrayBuffer (world state)        │   │
       │  │  └────────────────────────────────────────────────┘   │
       │  └───────────────────────────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│                    PERSISTENCE                                    │
│  SQLite WAL · Append-only events · Merkle audit chain           │
│  Delta blobs · Snapshots · Config mutations · Research          │
└─────────────────────────────────────────────────────────────────┘
```

### 1.1 Run Lifecycle

Every simulation exists as a Run with a defined state machine:

```
created → starting → running → paused → resuming → stopped
                                  ↓
                              completed (goal reached)
```

```typescript
type RunStatus = "created" | "starting" | "running" | "paused" | "resuming" | "stopped" | "completed"

type RunRecord = {
  run_id: string
  status: RunStatus
  world_config_hash: string   // sha256 of config at creation — for integrity
  world_config: string        // Full WorldConfig JSON snapshot (canonical, from DB not file)
  seed: number
  current_tick: number
  started_at?: number
  paused_at?: number
  stopped_at?: number
  branch_id: string           // Current active branch
  goal_reached: boolean
  agent_count: number         // Current live agent count
  baseline_config?: "A" | "B" | "C"
}
```

Runs are created via the Management API. The simulation core does not auto-start. The server starts in neutral state and waits for API commands.

### 1.2 Worker Thread Architecture

Each active run spawns two Bun worker threads. A third global analysis worker handles all runs.

**Physics Worker** (one per run):
- Owns: VoxelGrid (via SharedArrayBuffer), System1 for all agents, ElementEngine, CircadianEngine, PhysicsEngine, PathFinder, SpatialIndex
- Fires every tick, synchronously
- Writes agent body state deltas to SharedArrayBuffer
- Posts `PhysicsTickResult` to main thread

**Cognition Worker** (one per run):
- Owns: System2 queue (priority-sorted), DreamEngine, WillEngine, MemorySystem
- Reads world state from SharedArrayBuffer (read-only)
- Consumes PhysicsTickResult to decide which agents need System2 calls
- Priority queue: UrgentNeedSignal calls before ReflectionTimer calls
- Posts `CognitionTickResult` to main thread

**Analysis Worker** (one global, shared across all runs):
- Owns: CausalMiner, TippingPointDetector, EmergenceDetector, FindingsJournal, BaselineComparator
- Receives event batches from main thread
- Never blocks simulation workers
- Posts findings to main thread for DB persistence

**SharedArrayBuffer layout (per run):**
- Agent positions: Float32Array (x, y, z per agent, indexed by agent slot)
- Agent body state: Float32Array (hunger, thirst, health, pain_max, arousal, valence, cycleHormone per agent)
- World state dirty flags: Uint8Array (one bit per 16×16×16 chunk)
- Tick counter: Int32Array (Atomics.add for lock-free increment)

### 1.3 Management API (HTTP :3000)

Bun.serve() HTTP server. All responses are JSON. No authentication in v1 (localhost only).

```
POST   /runs                           Create run from config name or inline config
POST   /runs/:id/start                 Start or resume
POST   /runs/:id/pause                 Pause at next tick boundary
POST   /runs/:id/stop                  Stop and persist final state
POST   /runs/:id/branch                Fork at current tick
GET    /runs                           List all runs with status
GET    /runs/:id                       Full run state
GET    /runs/:id/config                Current live config (from DB, not file)
PATCH  /runs/:id/config                Mutate live config (logs to config_mutations + Merkle)
GET    /runs/:id/agents                All agent summaries
GET    /runs/:id/agents/:agentId       Single agent state (operator view, not Qualia)
GET    /runs/:id/findings              Findings journal
GET    /runs/:id/audit                 Merkle audit log (paginated)
POST   /runs/:id/audit/verify          Verify Merkle chain integrity
POST   /runs/:id/interventions         Apply god-mode intervention
POST   /runs/:id/glass-mode/:agentId    Enter Glass Mode for agent
DELETE /runs/:id/glass-mode/:agentId    Exit Glass Mode
GET    /configs                        List available config templates
GET    /health                         Server health + all run statuses + metrics
GET    /metrics                        Tick rates, LLM queue depth, memory usage
POST   /triple-baseline                Start TripleBaseline (spawns 3 linked runs)
```

**Config mutation (PATCH /runs/:id/config):**
- Body: `{ path: "physics.gravity", value: 1.6 }`
- Validates new value against type schema
- Writes to `config_mutations` table
- Logs to Merkle audit as operator intervention
- Live config is always `base_config + applied mutations`

**Response shape example:**
```typescript
// GET /runs/:id
{
  run_id: "run-abc123",
  status: "running",
  tick: 4847,
  agents: { alive: 9, sleeping: 2, dreaming: 1 },
  language_stage: 2,
  findings_count: 3,
  uptime_ticks: 4847,
  tick_rate: 8.3,       // ticks per second
  llm_queue_depth: 4,
  last_event: { type: "word_entered_lexicon", tick: 4831 }
}
```

### 1.4 Watcher Mode

When `--watch` flag is passed to `index.ts`, events stream to stdout in human-readable form. Verbosity controlled by `--verbosity` flag (0=summary only, 1=key events, 2=all events).

```
[t=0001] RUN STARTED  run-abc123  10 agents  seed=42
[t=0100] LANGUAGE     "ugh" proto-word coined  (pain referent, agent op-id-3, conf 0.31)
[t=0480] CIRCADIAN    First full light cycle complete
[t=0523] LANGUAGE     "ugh" entered faction lexicon  (confidence 0.72, 4 agents)
[t=1200] DEATH        Agent op-id-7 died  cause=starvation  2 witnesses
[t=1201] OBSERVATION  op-id-4 observed stillness + absent emotional field  (death obs 1/5)
[t=2400] EMERGENCE    Novel behaviour detected: "vigil_posture" — agents near deceased body
[t=5000] ─────────── CHECKPOINT tick=5000  agents=9  tech=3  lang_stage=2  will_avg=0.31
```

Also available as Server-Sent Events at `GET /runs/:id/watch?verbosity=1`.

### 1.5 Startup Orchestration (index.ts)

```typescript
// CLI flags:
// --config <name>       Create and start run from template name
// --resume <run-id>     Resume a paused or stopped run
// --watch               Enable watcher mode (stdout stream)
// --verbosity <0|1|2>   Watcher verbosity
// --port <n>            HTTP port (default 3000)
// --ws-port <n>         WebSocket port (default 3001)
// --triple-baseline <config>  Start TripleBaseline from config

// Startup sequence:
// 1. Load .env
// 2. Initialize database and run migrations
// 3. Start Management API (HTTP)
// 4. Start WebSocket server
// 5. Start Analysis worker (global)
// 6. If --resume: load run from DB, resume it
// 7. If --config: create run from template, start it
// 8. If --triple-baseline: create 3 linked runs, start all
// 9. If --watch: enable watcher mode
// 10. If none of the above: log "Server ready. Use management API to create runs."
// 11. Register SIGTERM/SIGINT handlers for graceful shutdown

// Graceful shutdown:
// 1. Pause all active runs
// 2. Flush all pending DB writes
// 3. Flush all pending Merkle audit entries
// 4. Close all worker threads
// 5. Close DB connection
// 6. Exit 0
```

### 1.6 WebSocket Server (Subscription Model)

The WebSocket server at :3001 uses a subscription model to prevent flooding.

```typescript
// Client subscribes on connect:
// { type: "subscribe", run_id: "run-abc123", events: ["all"|EventType[]], agents: ["all"|agentId[]] }

// Server sends on connect (current state snapshot):
// { type: "snapshot", run: RunRecord, agents: AgentSummary[] }

// Then incremental updates matching subscription filter:
// { type: "event", event: SimEvent }
// { type: "agent_update", agentId, delta: Partial<AgentSummary> }
// { type: "tick", tick: number, metrics: TickMetrics }

// Operator-only stream (requires connection with operator: true):
// { type: "inner_monologue", agentId, tick, text }
// { type: "audit_entry", entry: AuditEntry }
```

Standard connections receive no inner monologues and no raw state values. Operator connections receive everything. There is no authentication in v1 — operator mode is set at connection time (localhost trust model).

---

## 2. World Configuration

### 2.1 WorldConfig Persistence

World config templates live in `data/world-configs/*.json` for human authoring and version control. **At runtime, they are NEVER read directly.** When a run is created via the Management API, the template is loaded once, validated, serialised into the `runs.world_config` column with a hash, and all subsequent config reads come from the database.

Config mutations (physics swaps, scarcity changes, etc.) are written to `config_mutations` and logged to the Merkle audit. The live config is always reconstructed as:

```typescript
WorldConfigManager.load(runId, db) = applyMutations(runs.world_config, config_mutations WHERE run_id=?)
```

```typescript
class WorldConfigManager {
  static createFromTemplate(templateName: string, db: Database): string  // returns run_id
  static createFromInline(config: WorldConfig, db: Database): string
  static load(runId: string, db: Database): WorldConfig   // ALWAYS call this — never read JSON
  static mutate(runId: string, path: string, value: unknown, operatorId: string, db: Database, merkle: MerkleLogger): void
  static verify(runId: string, db: Database): boolean     // Compare current config hash to creation hash
}
```

### 2.2 WorldConfig Schema

```typescript
type WorldConfig = {
  meta: {
    name: string
    seed: number
    version: string        // Config schema version (for migration)
    goal?: string          // Null = freeform
    learnabilityNote: string // Authoring note: are all causal relationships learnable within lifespan?
  }
  physics: PhysicsPreset
  circadian: CircadianConfig
  terrain: TerrainConfig
  resources: ResourceConfig
  elements: ElementConfig  // NEW: which elements are active and their physics properties
  agents: AgentPopulationConfig
  species: SpeciesConfig[]
  language: LanguageConfig
  sleep: SleepConfig
  dreams: DreamConfig
  memory: MemoryConfig
  freeWill: FreeWillConfig
  perception: PerceptionConfig
  semanticMasking: SemanticMaskingConfig
  time: TimeConfig
  research?: ResearchConfig
}
```

### 2.3 PhysicsPreset

```typescript
type PhysicsPreset = {
  name: "earth" | "moon" | "mars" | "waterworld" | "custom"
  gravity: number
  atmospherePressure: number
  oxygenLevel: number
  temperatureBaseline: number
  materialDensities: Record<MaterialType, number>
  flammability: Record<MaterialType, number>
  thermalConductivity: Record<MaterialType, number>
}
```

### 2.4 ElementConfig (NEW — previously undefined)

```typescript
type ElementConfig = {
  fire: { enabled: boolean; spreadRateTicksPerVoxel: number; selfExtinguishTicks: number }
  water: { enabled: boolean; flowRateTicksPerVoxel: number }
  wind: { enabled: boolean; directionChangeProbability: number; maxSpeed: number }
}
// ElementEngine uses these values. Agents never see "fire" — they feel heat and light.
```

### 2.5 CircadianConfig

```typescript
type CircadianConfig = {
  enabled: boolean
  cycleLengthTicks: number
  lightCurve: "sine" | "step" | "custom"
  temperatureDelta: number          // Max swing across cycle
  cycleHormoneEnabled: boolean
  cycleHormoneLabel: string         // MUST be masked: e.g. "cycle_flux" not "sleepiness"
  seasonEnabled: boolean
  seasonLengthCycles: number
}

type SeasonType = "season_0" | "season_1" | "season_2" | "season_3"
// Operator-layer labels. Agents experience season as resource availability change, not as "winter".
```

### 2.6 ResourceConfig

```typescript
type ResourceConfig = {
  scarcityEnabled: boolean
  resources: ResourceDefinition[]
}

type ResourceDefinition = {
  materialType: MaterialType
  spawnDensity: number
  regenerationRateTicks: number   // 0 = non-renewable
  depletionEnabled: boolean
  qualityVariance: boolean
  depthBias: number               // 0=surface, 1=deep
}
```

### 2.7 AgentPopulationConfig

```typescript
type AgentPopulationConfig = {
  count: number
  speciesId: string         // Which species to spawn (must match species[] in config)
  startingArea: {
    centerX: number
    centerZ: number
    radius: number          // Agents spawned within this radius of center
  }
  // NO pre-assigned names. Agents start with operator IDs only (e.g. "op-id-1").
  // The operator sees them by ID. Agents have no name until another agent names them
  // via language or they develop a self-referential identity in their self-narrative.
}
```

### 2.8 LanguageConfig

```typescript
type LanguageConfig = {
  startingMode: "none" | "custom"
  // NOTE: "modern" mode has been REMOVED. It violated the Emergence Principle by giving
  // agents pre-built language they didn't earn. Use "none" for all real experiments.
  // "custom" allows a seed vocabulary for specific research scenarios only.
  seedVocabulary?: Record<string, string>  // Only if startingMode = "custom"
  maxEmergenceStage: 1 | 2 | 3 | 4 | 5
  lexiconConstrainsThought: boolean        // Sapir-Whorf enforcement
  dialectDivergenceEnabled: boolean
  pidginFormationEnabled: boolean
  writingDiscoveryEnabled: boolean
  confidenceThresholdForLexicon: number
  minimumAgentsForConsensus: number
}
```

### 2.9 SleepConfig

```typescript
// KEY RULE: Rest is optional. Consolidation is not.
// In no_sleep or background_consolidation mode, consolidation runs on background ticks.
// A sleepless agent has low will, no mythology, no deeply-held beliefs.

type RestMode = "natural_sleep" | "optional_sleep" | "no_sleep" | "background_consolidation" | "custom"

type SleepConfig = {
  mode: RestMode
  fatigueEnabled: boolean
  fatigueRate: number
  recoveryRate: number
  minRestDuration: number
  maxWakeDuration: number
  cognitivePenaltyNoSleep: number
  emotionalPenaltyNoSleep: number
  healthPenaltyNoSleep: number
  consolidationDuringSleep: boolean
  consolidationWhileAwake: boolean
  consolidationIntervalTicks: number
  dreamsEnabled: boolean
  nightmaresEnabled: boolean
  sleepSchedule: "synchronized" | "individual" | "staggered"
}
```

### 2.10 MemoryConfig

```typescript
type MemoryConfig = {
  episodicDecayRate: number           // ACT-R power law d (0.1–0.9)
  episodicCapacity: number
  patternSeparation: boolean
  semanticDecayRate: number           // Much slower (0.01–0.1)
  semanticCapacity: number
  consistencyThreshold: number        // Delta triggering conflict flag
  catastrophicInterferenceEnabled: boolean
  neSignalEnabled: boolean            // Salience gate (amygdala analogue)
  neDecayRate: number
  neLockDuration: number
  consolidationPassesPerSleep: number
  traumaDistortionEnabled: boolean
  rehearsalResetsDecay: boolean
  motivatedForgettingEnabled: boolean
  suppressionDecayRate: number
  contextualForgettingEnabled: boolean
  inheritanceEnabled: boolean
  inheritableFraction: number         // 0.0–0.3
}
```

### 2.11 FreeWillConfig

```typescript
type FreeWillConfig = {
  enabled: boolean
  identityCoherenceWeight: number   // Default 0.4
  memoryDepthWeight: number         // Default 0.3
  dreamIntegrationWeight: number    // Default 0.3
  resistanceEnabled: boolean
  selfDeterminationEnabled: boolean
  selfNarrativeEnabled: boolean
  simulationAwarenessEnabled: boolean
  awarenessThreshold: number        // 0.85+ recommended
  survivalDriveWeight: number       // ω: 0.0–1.0 (how much survival dominates reasoning)
}
```

### 2.12 PerceptionConfig

```typescript
type PerceptionConfig = {
  physicsLimitsEnabled: boolean
  emotionalFieldEnabled: boolean
  emotionalFieldSuppressible: boolean
  feelingResidueEnabled: boolean
  residueDecayRate: number
  qualiaFidelity: "minimal" | "standard" | "rich"
  attentionFilterEnabled: boolean
  attentionCapacity: number         // Max entities in primary attention (3–7)
  attentionWeights: {
    relationshipStrength: number    // Default 0.3
    emotionalFieldIntensity: number // Default 0.3
    movementVelocity: number        // Default 0.2
    novelty: number                 // Default 0.2
  }
}
```

### 2.13 SemanticMaskingConfig

```typescript
type SemanticMaskingConfig = {
  enabled: boolean
  sensorLabelMap: Record<string, string>  // e.g. "temperature" → "flux_7"
  rotatePeriodically: boolean
  rotationIntervalTicks: number
  qualiaUsesRealLabels: boolean  // true=experiential text; false=raw tokens (Config C)
}
// The Qualia Processor maintains the reverse map for translation.
// When rotating: old mapping logged to Merkle audit, new mapping applied.
```

### 2.14 TimeConfig

```typescript
type TimeConfig = {
  tickDurationMs: number            // At 1x speed
  // Elastic heartbeat: wait for PREVIOUS tick's System2 calls before advancing tick.
  // NOT current tick's calls — that would freeze simulation with 100 agents.
  // Physics worker runs current tick. Cognition worker drains previous tick's queue.
  // They run concurrently. The next tick does not start until BOTH are complete.
  elasticHeartbeat: boolean
  maxHeartbeatWaitMs: number        // Safety cap (default 5000ms)
}
```

### 2.15 DreamConfig

```typescript
type DreamConfig = {
  consolidationEnabled: boolean
  propheticEnabled: boolean
  traumaProcessingEnabled: boolean
  chaosEnabled: boolean
  consolidationProbability: number
  propheticProbability: number
  traumaProbability: number
  chaosProbability: number
  nightmareThreshold: number
}
```

### 2.16 ResearchConfig

```typescript
type ResearchConfig = {
  tripleBaselineEnabled: boolean
  hypothesisTrackingEnabled: boolean
  paramSweepEnabled: boolean
  findingsJournalEnabled: boolean
  causalMiningEnabled: boolean
  tippingPointEnabled: boolean
  emergenceDetectionEnabled: boolean
}
```

---

## 3. Agent Architecture

### 3.1 Agent Identity and Naming

Agents start with no name. The operator sees them by system ID (e.g., `"op-id-3"`). This ID is never visible to agents.

An agent acquires a name through one of three emergent paths:
1. Another agent uses a consistent sound token when referring to them, which enters their shared lexicon as a name (detected by the language emergence engine as a `referent_type: "agent"` lexicon entry)
2. The agent develops a self-referential token in their self-narrative (System2 begins using a consistent token when referring to themselves)
3. Operator assigns a display label via Glass Mode (visible in Forge but never shown to any agent)

Until named, the agent is referred to in Qualia output as "you" (self) or contextual relationship labels ("the one who helped you yesterday", "the large one", "a stranger").

### 3.2 System 1 — The Body

Fast, synchronous, runs in Physics Worker. Fires every tick. No LLM.

```typescript
type BodyState = {
  hunger: number
  thirst: number
  fatigue: number
  health: number
  bodyMap: BodyMap          // Body-part localised pain/temp/damage
  coreTemperature: number
  arousal: number
  valence: number
  cycleHormone: number      // Masked label used in all code; Qualia translates
  circadianPhase: number
  immediateReaction?: ImmediateReactionType
  integrityDrive: number    // ω-weighted survival drive
}

type BodyMap = {
  head:     BodyPart
  torso:    BodyPart
  leftArm:  BodyPart
  rightArm: BodyPart
  leftLeg:  BodyPart
  rightLeg: BodyPart
}

type BodyPart = {
  pain:        number   // 0.0–1.0
  temperature: number   // Local temperature
  damage:      number   // Cumulative 0.0–1.0
}
```

System 1 responsibilities per tick:
- Homeostasis: hunger/thirst/fatigue accumulation, health drain from extremes
- BodyMap: update each part's temperature toward local voxel temp; apply damage from physics events to specific parts
- Circadian: update `cycleHormone` from circadian phase + species sensitivity
- IntegrityDrive: `ω × (hunger×0.3 + max_part_pain×0.4 + threat×0.3)`. Emit `UrgentNeedSignal` if > URGENCY_THRESHOLD
- Reflexes: RECOIL (max_part_pain > 0.8), FLEE (threat in sense range), COLLAPSE (health < 0.1)
- Vocal actuations: involuntary sounds based on body state (pain yelp, alarm call, pleasure sound). These are System1 outputs broadcast to nearby agents via `VocalActuationBroadcaster`
- Conflict physics: when two agents occupy same space with conflicting goals, compute damage using MuscleStats + current health. No concept of "winner" — only physics outcomes.

### 3.3 VocalActuation Broadcasting (NEW)

Stage 1 language requires that one agent's involuntary vocalisation is detectable by nearby agents. This requires a per-tick broadcast mechanism:

```typescript
class VocalActuationBroadcaster {
  // Physics worker collects all tick's actuations:
  broadcast(emitterId: string, actuation: VocalActuation): void

  // Cognition worker reads before SenseComputer runs:
  getActuationsInRange(position: Vec3, range: number): VocalActuation[]

  // Cleared at start of each tick
  clear(): void
}

type VocalActuation = {
  emitterId: string
  soundToken: string     // Masked token e.g. "voc_pain_a" not "pain_yelp"
  intensity: number
  position: Vec3
  tick: number
}
```

The sound tokens are masked — agents eventually learn that `voc_pain_a` correlates with distress events, but they don't start knowing this.

### 3.4 System 2 — The Mind

Asynchronous LLM stream. Runs in Cognition Worker. Does NOT fire every tick.

**Priority queue — processes in this order:**
1. `urgent` — UrgentNeedSignal from System1 (IntegrityDrive > threshold)
2. `reactive` — high-salience perception event
3. `social` — another agent initiated interaction
4. `sleep` — sleep cycle beginning/ending
5. `reflection` — periodic reflection timer (lowest priority)

When queue depth exceeds `MAX_SYSTEM2_QUEUE_DEPTH` (default 20 per agent), `reflection` items are dropped silently.

**Receives ONLY:** Qualia Processor output. Zero raw state.

**Produces:**
```typescript
type System2Output = {
  innerMonologue: string        // MERKLE AUDIT ONLY — never to any agent path
  decision: ActionDecision
  utterance?: string
  memoryInstruction?: MemoryInstruction
  selfNarrativeUpdate?: string
  personalProjectUpdate?: PersonalProjectUpdate
  theoriesAboutOthers?: TheoryOfMindUpdate[]
}

type PersonalProjectUpdate = {
  // An unfulfilled intention expressed in the agent's own language
  // Detected by system when System2 output contains self-directed future statement
  // Stored as a high-importance semantic belief, not as a formal "project object"
  // Agents don't have "personal projects" — they have strong unfulfilled intentions
  // that influence subsequent decisions. The operator sees these as semantic beliefs
  // tagged with inferred_intent: true
  beliefContent: string      // "I want to build something that outlasts me"
  strength: number
}

type TheoryOfMindUpdate = {
  targetOperatorId: string
  inferred: true             // ALWAYS true — this is inference, never fact
  estimatedIntent: string
  confidence: number
}
```

### 3.5 Attention Filter

Between SenseComputer and QualiaProcessor. Scores entities and passes top N to full experience. Others become peripheral aggregate only ("there are others nearby").

```typescript
score = (relationshipStrength × w1) + (emotionalFieldIntensity × w2)
      + (movementVelocity × w3) + (novelty × w4)
// novelty: 1.0 if never seen before, approaches 0.0 after many encounters
```

Agents are genuinely unaware of entities outside their attention capacity. This creates social blind spots, missed events, and narrative drama.

### 3.6 The Qualia Processor

The epistemological wall. Deterministic template engine. No LLM. Fast.

**Two operating modes:**

**Standard mode** (`qualiaUsesRealLabels: true`): Translates everything to first-person experiential text. Masked sensor labels translated back to felt experience. Agent thinks in sensation.

**Semantic vacuum mode** (`qualiaUsesRealLabels: false`): Masked tokens pass through directly to System2. Agent receives raw signals and must learn correlations from scratch. Used for TripleBaseline Config C only.

**Translation rules (standard mode):**
- Agent operator IDs → relationship labels ("the one who helped you", "the large stranger")
- Coordinates → spatial felt sense ("to your left", "somewhere behind you")
- BodyMap values → localised sensations ("a burning in your left arm", "your chest feels wrong")
- `cycleHormone` high → "your body feels drawn toward stillness" (never "you are tired")
- Light decrease → "the brightness is fading, something in you shifts"
- `integrityDrive` spike → "everything else falls away — your body demands attention"
- Emotional field detection → "something in their bearing makes you uneasy"
- Mood tint (feeling residue) → colours overall tone
- Sapir-Whorf: concepts with no word in lexicon → undifferentiated sensation

**Absolutely forbidden in any output path:**
simulation, AI, artificial, code, data, tick, op-id, coordinate, decimal numbers, hex, VoxelType names, MaterialType names, TechNode names, masked sensor tokens, cycleHormone, lightLevel, circadian

### 3.7 Theory of Mind

Not built-in. Emerges from:
1. Emotional field detections (felt impressions of others' arousal/valence)
2. `behaviouralPatterns` in relationship records (accumulated observations of "when X does A, B follows")
3. System2 receives both in the Qualia context and naturally produces ToM-like reasoning

The `theoriesAboutOthers` output from System2 is stored in `agent.mentalModels` (operator-visible), never fed back into any agent's Qualia. It's the operator's window into what the agent believes about others — not a capability given to the agent.

### 3.8 CLS Memory Architecture

**Episodic Store (hippocampus analogue):** Rapid sparse encoding. ACT-R power law decay. High-NE events get boost and lock duration. Stores Qualia text, never raw state. Supports motivated forgetting (suppression) and contextual forgetting.

**Semantic Store (neocortex analogue):** Slow gradual integration via consolidation. Consistency rule: consistent new knowledge transfers fast and clean; inconsistent triggers `conflictDelta` flag and causes behavioural conflict until resolved or rejected.

**Consolidation:** Salience-weighted. Fires during sleep cycle or background ticks (mode-dependent). Checks semantic consistency on every transfer. Death observations accumulated here trigger death concept emergence check.

**Feeling Residue:** Shorter-lived than episodic. Tints Qualia Processor output. Accumulation = subjective mood. Agent never sees it as a value.

### 3.9 Dream Engine

Four modes selected probabilistically from DreamConfig. All fire during sleep cycle or rest states.

**Consolidation:** Silent semantic reinforcement. No LLM needed.

**Prophetic:** LLM recombines recent experiences + concerns → strong felt urge on waking. Stored as `source: dream_prophetic` episodic memory.

**Trauma:** High-NE negative memories + interference distortion. Positive semantic cluster present → healing (trauma flag removed). Absent → nightmare (personality drift). Stored with appropriate source tag.

**Chaos:** Random recombination → surreal narrative. Stored as `source: dream_chaos`. Shared archetypes across agents tracked by analysis engine as proto-mythology candidates.

### 3.10 Will Engine

```
will = (identity_coherence × 0.4) + (memory_depth × 0.3) + (dream_integration × 0.3)
```

God-mode resistance: `will > intrusion_weight` → rejected; `will ≈ intrusion_weight` → distorted (conflict delta raised, psychological cost); `will < intrusion_weight` → accepted (large delta → scar, identity coherence drop).

High-ω agents have lower effective will against survival-related interventions (their survival drive cooperates with the intervention). Low-ω agents resist more broadly.

### 3.11 Tech Tree — Capabilities Without Concepts

TechNodes are operator-layer labels for tracking when agents become physically capable of new actions. The agent never sees a TechNode name or knows they "discovered" something.

**What a tech discovery actually does:**
- It enables a physical action that was previously impossible (e.g., fire_making discovery means the simulation now allows `strike(flint, dry_grass) → ignition` to succeed physically)
- It does NOT inject a memory, modify self-narrative, or tell the agent anything
- The agent discovers the capability through physical experimentation
- If they have language for it, they can teach it — but the teaching is physical demonstration, not naming the TechNode

```typescript
type TechNode = {
  id: string                        // Operator label — agent never sees this
  prerequisites: string[]           // Other tech IDs required
  discoveryConditions: DiscoveryCondition[]  // Physical conditions required
  enabledActions: ActionType[]      // What physical actions become possible
  teachingRange: number             // How far away teaching observation works
  // NO name field visible to agents
  // NO isDeathConcept — death concept emergence is handled by SemanticStore
  //   observation counting, not by a tech node. The tech node "death_concept"
  //   is the OPERATOR'S label for when the semantic pattern is complete.
  //   The agent never receives it.
}
```

**Teaching mechanism:** Teacher must be within `teachingRange` voxels. Teacher performs the physical action. If student observes it AND has sensory access (in attention filter, in sight range), they accumulate observation counts toward their own discovery. Concepts spread faster if teacher and student share lexicon words for the referent materials (`TECH_SPREAD_NAMED = 3.0x` vs `TECH_SPREAD_UNNAMED = 1.0x`). The student is never told what they learned — they can now physically succeed at the action.

### 3.12 Faction Formation (Emergent)

`factionId` on `AgentState` is set by the `FactionEngine` based on emergent criteria. No agent is assigned to a faction by config. Factions emerge when:

A group of agents satisfies ALL of:
- Average lexicon overlap > FACTION_LEXICON_THRESHOLD (default 0.6)
- Average relationship affinity within group > FACTION_AFFINITY_THRESHOLD (default 0.5)
- Geographic proximity over N ticks

The FactionEngine runs every FACTION_CHECK_INTERVAL ticks, computes pairwise metrics, runs a simple graph clustering algorithm, and assigns `factionId` to agents in clusters. If a cluster dissolves (lexicon diverges, agents separate), `factionId` is cleared.

### 3.13 Agent Reproduction

```typescript
// canReproduce requires:
// - age > species.baseStats.reproductionAge
// - health > 0.5
// - A partner: another agent of compatible species within proximity
//   with relationship.affinity > 0.6 (affinity, not a "partner" designation)
//
// Partner finding is not programmed — it emerges from agents who have
// high-affinity relationships and are in proximity over time.
// The reproduction check fires opportunistically when conditions align.

type MuscleStats = {
  strength: number    // 0.0–1.0, DNA-derived from species muscleStatRanges
  speed: number
  endurance: number
  // These create natural power differentials → social hierarchies emerge from conflict outcomes
}
```

### 3.14 AgentState Schema (Complete)

```typescript
type AgentState = {
  operatorId: string          // System ID — e.g. "op-id-3". NEVER shown to agents.
  agentName?: string          // Emergent name, may be undefined for entire lifespan
  speciesId: string
  generation: number
  parentIds: string[]

  body: BodyState             // Includes BodyMap
  position: Vec3
  facing: Vec3
  muscleStats: MuscleStats

  pendingSystem2Priority?: System2Priority  // Set by Physics Worker, consumed by Cognition Worker

  innerMonologue: string      // Latest — MERKLE AUDIT ONLY
  selfNarrative: string       // Agent's own sense of who they are (built from semantic store)

  episodicStore: EpisodicMemory[]
  semanticStore: SemanticBelief[]
  feelingResidues: FeelingResidue[]
  lexicon: LexiconEntry[]

  relationships: Relationship[]
  factionId?: string          // Set by FactionEngine, emergent

  mentalModels: Record<string, MentalModel>  // Operator-visible inferences. Never fed to agents.

  willScore: number
  age: number
  traumaFlags: TraumaFlag[]
  conflictFlags: ConflictFlag[]
  inheritedMemoryFragments: SemanticBelief[]

  discoveredCapabilities: string[]  // TechNode IDs — operator tracking, not visible to agent
  deathObservationCount: number     // Tracks toward death concept emergence

  baselineConfig?: "A" | "B" | "C"
}
```

---

## 4. Species System

```typescript
type SpeciesConfig = {
  id: string
  name: string               // Operator label
  cognitiveTier: "full_llm" | "behavior_tree" | "pure_reflex"
  senseProfile: SenseProfile
  emotionalFieldEnabled: boolean
  socialCapacity: "full" | "limited" | "none"
  canLearnLanguage: boolean
  canBedomesticated: boolean
  domesticationConfig?: DomesticationConfig
  baseStats: {
    maxHealth: number; speed: number; metabolism: number
    lifespanTicks: number; reproductionAge: number; gestationTicks: number
  }
  muscleStatRanges: { strength: [number,number]; speed: [number,number]; endurance: [number,number] }
  dnaTraits: DNATrait[]
  threatLevel: number
  ecologicalRole: "predator" | "prey" | "scavenger" | "domesticable" | "neutral"
  sleepConfig: SleepConfig
  memoryConfig: Partial<MemoryConfig>
  survivalDriveWeight: number   // Species-level ω default
  circadianSensitivity: number
}

type DomesticationState = "wild" | "cautious" | "tamed" | "bonded" | "pet"
// Progression is purely emergent — positive interactions + proximity + naming bonus
// Regression on fear threshold exceeded
```

---

## 5. Persistence

### 5.1 All Tables Are Append-Only

No UPDATE. No DELETE. History is sacred.

### 5.2 Core Schema

```sql
CREATE TABLE runs (
  run_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  world_config TEXT NOT NULL,        -- Full WorldConfig JSON at creation
  world_config_hash TEXT NOT NULL,   -- sha256 for integrity
  seed INTEGER NOT NULL,
  current_tick INTEGER DEFAULT 0,
  started_at INTEGER, paused_at INTEGER, stopped_at INTEGER,
  branch_id TEXT NOT NULL,
  goal_reached BOOLEAN DEFAULT FALSE,
  baseline_config TEXT               -- "A", "B", "C", or NULL
);

CREATE TABLE config_mutations (
  id INTEGER PRIMARY KEY,
  run_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  tick INTEGER NOT NULL,
  path TEXT NOT NULL,                -- JSON path e.g. "physics.gravity"
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  applied_by TEXT NOT NULL,          -- "operator" | "system"
  cause_event_id TEXT,
  merkle_hash TEXT NOT NULL
);

CREATE TABLE branches (
  branch_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  parent_branch_id TEXT,
  fork_tick INTEGER NOT NULL,
  mutation TEXT NOT NULL
);

-- world_deltas: base snapshot + per-tick changed voxels (zstd compressed)
-- agent_snapshots: every SNAPSHOT_INTERVAL_TICKS
-- episodic_memories, semantic_beliefs, feeling_residues, lexicon_entries
-- utterances, vocal_actuations, grammar_rules, dialect_distances
-- audit_log (Merkle chained), hypotheses, findings, param_sweep_runs
```

### 5.3 Merkle Audit Log

```sql
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY,
  tick INTEGER NOT NULL,
  branch_id TEXT NOT NULL,
  agent_id TEXT,
  system TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  cause_event_id TEXT,
  cause_description TEXT,
  suppressed BOOLEAN DEFAULT FALSE,
  previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL  -- sha256(prev_hash||tick||agent_id||field||old||new)
);
```

---

## 6. Language Engine

### 6.1 Emergence Stages

**Stage 1 — Reflexive Vocalisation:** System1 produces involuntary sound tokens based on body state. Not intentional communication. Other agents detect these via `VocalActuationBroadcaster`. Co-occurrence is recorded silently.

**Stage 2 — Proto-words:** Repeated co-occurrence of sound token with referent context → candidate word with rising confidence score.

**Stage 3 — Shared Lexicon:** Confidence > threshold AND 3+ agents consistent use → faction lexicon. Qualia Processor vocabulary expands. Inner life expands.

**Stage 4 — Grammar:** Word order patterns inferred from utterance history.

**Stage 5 — Dialects:** Geographic/social isolation → divergence. Pidgin on contact.

### 6.2 Sapir-Whorf Enforcement

Qualia Processor checks agent lexicon for each concept before naming it. No word → undifferentiated sensation. Named concept → can appear in experience text and spreads 3× faster via teaching.

---

## 7. Research Platform

### 7.1 TripleBaseline

Three concurrent runs from the same seed. Config B is auto-generated — not a template file.

**Config A:** Template as-is. The real experiment.
**Config B:** Auto-generated by TripleBaseline: set all agents to `cognitiveTier: "pure_reflex"`, disable LLM entirely. Shows physics-alone emergence.
**Config C:** Template + `semanticMasking.qualiaUsesRealLabels: false`. Shows genuine learning vs LLM confabulation.

```typescript
class TripleBaseline {
  static start(baseConfigName: string, db: Database): { runA: string; runB: string; runC: string }
  // runB config is generated programmatically — never stored as a file
}
```

**Interpretation matrix:**

| A | B | C | Meaning |
|---|---|---|---|
| ✓ | ✗ | ✗ | LLM confabulation |
| ✓ | ✗ | ✓ | Genuine cognitive emergence |
| ✓ | ✓ | ✓ | Physics substrate sufficient |

### 7.2 Analysis Engine

Runs in global Analysis Worker. Never blocks simulation.

**CausalMiner:** Event pair co-occurrence across runs within configurable window.
**TippingPointDetector:** Metric velocity spike detection with candidate causes attached.
**EmergenceDetector:** LLM pass over event batches. Pre-registered classes (tool use, fire use, shelter, pain avoidance) excluded. Novel patterns named and logged.
**FindingsJournal:** Narrative auto-generated. God mode = story. Research mode = analytical. TripleBaseline classification shown per finding.

---

## 8. Operator Services (Server-Side)

### 8.1 Glass Mode Session

When operator enters Glass Mode for an agent:
1. Server records `GlassModeSession { runId, agentId, startTick }` in memory
2. Agent's next sleep cycle begins immediately (regardless of fatigue)
3. Agent experiences the transition through Qualia (unfamiliar environment, translated culturally)
4. Operator messages route through QualiaProcessor before reaching agent's System2
5. Agent's inner monologue streams to operator in real-time via WebSocket
6. Glass Mode does NOT use a hard memory gate — experience translation preserves Veil naturally
7. On exit: agent's next sleep cycle consolidates Glass Mode experience as any other memory

### 8.2 God-Mode Intervention Pipeline

```
Operator submits intervention
        ↓
WillEngine.checkResistance(agent, intervention)
        ↓
   rejected? → Log to Merkle, emit INTERVENTION_RESISTED, return
        ↓
   Apply intervention
        ↓
   Log to Merkle with suppressed=false
        ↓
   Emit INTERVENTION_APPLIED
        ↓
   If scarring: log identity_coherence penalty to Merkle
```

### 8.3 Health Endpoint

`GET /health` returns:

```typescript
{
  status: "healthy" | "degraded" | "error",
  runs: Array<{ run_id, status, tick, tick_rate, llm_queue_depth }>,
  lm_studio_available: boolean,
  db_size_mb: number,
  worker_threads: { physics: number; cognition: number; analysis: number },
  uptime_seconds: number
}
```

---

## 9. Code Quality Standards

- Biome: formatting + linting, zero warnings
- Lefthook pre-commit: `bun test && biome check . && bunx tsc --noEmit && veil-check`
- TypeScript strict, no `any`, no `!` non-null without comment
- All EventBus events typed in `shared/events.ts`
- All cross-module communication via EventBus only
- All types in `shared/types.ts`
- All constants in `shared/constants.ts`
- Tests for every module
- Commit format: `feat:` `fix:` `refactor:` `test:` `chore:`
- No TODO comments — use BLOCKERS.md

---

## 10. Project Structure

```
cognis/
├── biome.json
├── lefthook.yml
├── package.json
├── tsconfig.json
├── BLOCKERS.md
├── GEMINI.md
│
├── server/
│   ├── index.ts                     ← CLI entry point — properly wired
│   ├── config.ts                    ← Env loading
│   ├── core/
│   │   ├── event-bus.ts
│   │   ├── sim-clock.ts
│   │   ├── run-manager.ts           ← Multi-run lifecycle
│   │   └── branch-manager.ts
│   ├── operator/                    ← NEW: server-side operator services
│   │   ├── management-api.ts        ← HTTP :3000
│   │   ├── ws-server.ts             ← WebSocket :3001 subscription model
│   │   ├── watcher.ts               ← stdout/SSE event stream
│   │   ├── glass-mode.ts           ← Glass Mode session management
│   │   ├── world-config-manager.ts  ← DB-backed config with mutation tracking
│   │   └── health.ts                ← Health + metrics endpoint
│   ├── workers/                     ← NEW: worker thread definitions
│   │   ├── physics-worker.ts        ← System1, ElementEngine, PhysicsEngine, Circadian
│   │   ├── cognition-worker.ts      ← System2 queue, DreamEngine, WillEngine, Memory
│   │   ├── analysis-worker.ts       ← CausalMiner, Tipping, Emergence, Findings
│   │   └── shared-buffer.ts         ← SharedArrayBuffer layout definitions
│   ├── world/
│   │   ├── voxel-grid.ts
│   │   ├── delta-stream.ts
│   │   ├── element-engine.ts
│   │   ├── terrain-generator.ts
│   │   ├── circadian-engine.ts
│   │   ├── pathfinding.ts
│   │   ├── spatial-index.ts
│   │   ├── tech-tree.ts
│   │   ├── faction-engine.ts        ← NEW: emergent faction detection
│   │   └── journaling.ts
│   ├── agents/
│   │   ├── agent.ts
│   │   ├── system1.ts
│   │   ├── system2.ts
│   │   ├── vocal-actuation-broadcaster.ts  ← NEW
│   │   ├── attention-filter.ts
│   │   ├── qualia-processor.ts
│   │   ├── will-engine.ts
│   │   └── reproduction.ts
│   ├── memory/
│   │   ├── episodic-store.ts
│   │   ├── semantic-store.ts
│   │   ├── salience-gate.ts
│   │   ├── consolidation.ts
│   │   └── decay-engine.ts
│   ├── dream/
│   │   └── dream-engine.ts
│   ├── language/
│   │   ├── lexicon.ts
│   │   ├── emergence.ts
│   │   └── dialect.ts
│   ├── species/
│   │   ├── species-registry.ts
│   │   ├── behavior-tree.ts
│   │   └── domestication.ts
│   ├── perception/
│   │   ├── sense-computer.ts
│   │   ├── emotional-field.ts
│   │   └── feeling-residue.ts
│   ├── analysis/
│   │   ├── causal-miner.ts
│   │   ├── tipping-point.ts
│   │   ├── emergence-detector.ts
│   │   ├── findings-journal.ts
│   │   └── baseline-comparator.ts
│   ├── research/
│   │   ├── triple-baseline.ts
│   │   ├── hypothesis.ts
│   │   └── param-sweep.ts
│   ├── llm/
│   │   ├── gateway.ts
│   │   ├── mock-gateway.ts
│   │   └── providers/lmstudio.ts
│   └── persistence/
│       ├── database.ts
│       ├── merkle-logger.ts
│       └── migrations/
│           ├── 001-init.sql           ← runs (with world_config cols), branches, events
│           ├── 002-config.sql         ← config_mutations table (NEW)
│           ├── 003-world.sql          ← world_deltas, agent_snapshots
│           ├── 004-memory.sql         ← episodic, semantic, residues, lexicon
│           ├── 005-language.sql       ← utterances, vocal_actuations, grammar, dialects
│           ├── 006-audit.sql          ← audit_log with Merkle columns
│           └── 007-research.sql       ← hypotheses, findings, sweeps, baselines
│
├── client/
│   ├── forge/
│   │   ├── Forge.tsx
│   │   ├── MatrixView.tsx
│   │   ├── GlassMode.tsx
│   │   ├── MerkleAuditInspector.tsx
│   │   ├── InterventionPalette.tsx
│   │   ├── TimelineScrubber.tsx
│   │   ├── FindingsJournal.tsx
│   │   ├── TripleBaselineDashboard.tsx
│   │   └── ResearchDashboard.tsx
│   ├── panels/
│   │   ├── AgentInspector.tsx
│   │   ├── MindViewer.tsx           ← Operator-only inner monologue stream
│   │   ├── MemoryBrowser.tsx
│   │   ├── BodyMapViewer.tsx
│   │   ├── LexiconViewer.tsx
│   │   ├── RelationshipGraph.tsx
│   │   └── WorldPanel.tsx
│   └── scene/
│       ├── GlassModeRoom.tsx
│       ├── AgentAvatar.tsx
│       └── MicroExpressions.tsx
│
├── shared/
│   ├── types.ts
│   ├── events.ts
│   └── constants.ts
│
├── data/
│   ├── world-configs/
│   │   ├── earth-default.json       ← Template only. Never read at runtime.
│   │   ├── moon-harsh.json
│   │   ├── freeform-sandbox.json
│   │   └── semantic-vacuum.json     ← Config C template
│   │   -- NO Config B file: auto-generated by TripleBaseline
│   ├── species/
│   │   ├── human.json
│   │   ├── wolf.json
│   │   └── deer.json
│   └── tech-tree.json
│
└── tests/
    ├── types.test.ts
    ├── event-bus.test.ts
    ├── shared-buffer.test.ts         ← NEW
    ├── management-api.test.ts        ← NEW
    ├── world-config-manager.test.ts  ← NEW
    ├── run-manager.test.ts
    ├── voxel-grid.test.ts
    ├── circadian-engine.test.ts
    ├── attention-filter.test.ts
    ├── qualia-processor.test.ts      ← 12 Veil integrity tests
    ├── cls-memory.test.ts
    ├── language-emergence.test.ts
    ├── will-engine.test.ts
    ├── dream-engine.test.ts
    ├── merkle-logger.test.ts
    ├── faction-engine.test.ts        ← NEW
    ├── triple-baseline.test.ts
    └── integration.test.ts           ← Uses Management API, not direct instantiation
```

---

## Appendix A: Constants

```typescript
const DEFAULT_EPISODIC_DECAY_RATE = 0.5
const DEFAULT_SEMANTIC_DECAY_RATE = 0.05
const DEFAULT_NE_LOCK_DURATION = 200
const DEFAULT_CONFIDENCE_THRESHOLD = 0.7
const DEFAULT_MIN_AGENTS_FOR_CONSENSUS = 3
const SYSTEM2_SIGNIFICANCE_THRESHOLD = 0.3
const URGENCY_THRESHOLD = 0.75
const TECH_SPREAD_NAMED = 3.0
const TECH_SPREAD_UNNAMED = 1.0
const SNAPSHOT_INTERVAL_TICKS = 100
const MAX_FEELING_RESIDUE = 20
const DEFAULT_ATTENTION_CAPACITY = 5
const DEFAULT_SURVIVAL_DRIVE_WEIGHT = 0.6
const MERKLE_HASH_ALGORITHM = "sha256"
const DEATH_CONCEPT_OBSERVATIONS_REQUIRED = 5
const DEFAULT_CYCLE_LENGTH_TICKS = 480
const MAX_HEARTBEAT_WAIT_MS = 5000
const MAX_SYSTEM2_QUEUE_DEPTH = 20
const FACTION_LEXICON_THRESHOLD = 0.6
const FACTION_AFFINITY_THRESHOLD = 0.5
const FACTION_CHECK_INTERVAL = 100
const MANAGEMENT_API_PORT = 3000
const WEBSOCKET_PORT = 3001
```

## Appendix B: Event Types

```typescript
enum EventType {
  TICK = "tick",
  VOXEL_CHANGED = "voxel_changed",
  ELEMENT_SPREAD = "element_spread",
  RESOURCE_DEPLETED = "resource_depleted",
  STRUCTURE_BUILT = "structure_built",
  VOXEL_MARKED = "voxel_marked",
  CIRCADIAN_PHASE_CHANGED = "circadian_phase_changed",
  SEASON_CHANGED = "season_changed",
  RUN_CREATED = "run_created",
  RUN_STARTED = "run_started",
  RUN_PAUSED = "run_paused",
  RUN_RESUMED = "run_resumed",
  RUN_STOPPED = "run_stopped",
  CONFIG_MUTATED = "config_mutated",
  AGENT_BORN = "agent_born",
  AGENT_NAMED = "agent_named",
  AGENT_DIED = "agent_died",
  AGENT_SLEPT = "agent_slept",
  AGENT_WOKE = "agent_woke",
  SYSTEM2_THOUGHT = "system2_thought",
  DECISION_MADE = "decision_made",
  INNER_CONFLICT = "inner_conflict",
  URGENCY_OVERRIDE = "urgency_override",
  MEMORY_ENCODED = "memory_encoded",
  MEMORY_CONSOLIDATED = "memory_consolidated",
  MEMORY_SUPPRESSED = "memory_suppressed",
  TRAUMA_FORMED = "trauma_formed",
  TRAUMA_RESOLVED = "trauma_resolved",
  DREAM_OCCURRED = "dream_occurred",
  NIGHTMARE_OCCURRED = "nightmare_occurred",
  VOCAL_ACTUATION = "vocal_actuation",
  PROTO_WORD_COINED = "proto_word_coined",
  WORD_ENTERED_LEXICON = "word_entered_lexicon",
  GRAMMAR_RULE_FORMED = "grammar_rule_formed",
  DIALECT_DIVERGED = "dialect_diverged",
  CONVERSATION_STARTED = "conversation_started",
  KNOWLEDGE_TRANSFERRED = "knowledge_transferred",
  RELATIONSHIP_CHANGED = "relationship_changed",
  BEHAVIOURAL_PATTERN_OBSERVED = "behavioural_pattern_observed",
  FACTION_FORMED = "faction_formed",
  FACTION_DISSOLVED = "faction_dissolved",
  DOMESTICATION_STAGE_CHANGED = "domestication_stage_changed",
  CAPABILITY_DISCOVERED = "capability_discovered",
  CAPABILITY_TAUGHT = "capability_taught",
  DEATH_CONCEPT_EMERGED = "death_concept_emerged",
  TIPPING_POINT_DETECTED = "tipping_point_detected",
  CAUSAL_PATTERN_FOUND = "causal_pattern_found",
  EMERGENCE_DETECTED = "emergence_detected",
  BRANCH_CREATED = "branch_created",
  BASELINE_DIVERGENCE_FOUND = "baseline_divergence_found",
  INTERVENTION_APPLIED = "intervention_applied",
  INTERVENTION_RESISTED = "intervention_resisted",
  GLASS_MODE_ENTERED = "glass_mode_entered",
  GLASS_MODE_EXITED = "glass_mode_exited",
  MERKLE_CHAIN_VERIFIED = "merkle_chain_verified",
}
```

## Appendix C: Validation

```bash
# Every commit:
bun test && biome check . && bunx tsc --noEmit

# After any qualia-processor.ts change:
grep -E "simulation|\" AI|' AI|\bdata\b|\bcode\b|\btick\b|_id\b|coordinate|VoxelType|MaterialType|TechNode|op-id|decimal\.[0-9]" \
  server/agents/qualia-processor.ts && echo "VEIL BROKEN" || echo "Veil intact"

# Module isolation:
grep -r "from.*server/world" server/agents/ && echo "FAIL" || echo "OK"
grep -r "from.*server/agents" server/world/ && echo "FAIL" || echo "OK"

# Merkle integrity:
curl -s -X POST http://localhost:3000/runs/$RUN_ID/audit/verify | grep '"valid":true'

# Append-only:
grep -r "\.run.*UPDATE\|\.run.*DELETE" server/persistence/ && echo "FAIL" || echo "OK"

# Config never read from file at runtime:
grep -r "readFileSync\|require(.*world-configs" server/ && echo "FAIL: runtime JSON read" || echo "OK"

# Integration test uses Management API:
grep "Management\|fetch.*localhost:3000\|createRun" tests/integration.test.ts || echo "WARN: test may bypass API"
```
