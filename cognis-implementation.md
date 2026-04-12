# Cognis — Implementation Plan v3.0
**Method:** RALF Loop · Sub-agent driven · Non-stop overnight execution
**PRD:** cognis-prd.md (authoritative — read before every task)

---

## RALF Loop Protocol — The Agent's Operating Contract

```
READ:   Open cognis-prd.md. Find the task. Read EVERY section it references. No skipping.
ACT:    Implement exactly what is specified. Create every file. Write every method.
LEARN:  Run ALL validation commands in the task's Validate section. Every single one.
FIX:    Validation fails → debug → fix → re-run. Maximum 5 iterations per failure.
COMMIT: bun test && biome check . && bunx tsc --noEmit
        ALL THREE must pass. Fix until they do. Then:
        git add -A && git commit -m "type: description"
NEXT:   Immediately start the next task. No pausing. No waiting.
BLOCKER: After 5 failed fix attempts, append to BLOCKERS.md, continue to next task.
```

**The agent stops ONLY for:**
1. Blocker logged after 5 iterations (continue past it)
2. LM Studio unreachable (build MockLLMGateway, log blocker, continue)
3. Fatal system error (log, attempt recovery, continue)

**Veil check — run after EVERY task touching qualia-processor.ts:**
```bash
grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate" \
  server/agents/qualia-processor.ts && echo "VEIL BROKEN — FIX BEFORE COMMIT" || echo "Veil intact"
```

---

## Phase 0: Tooling and Bootstrap

### TASK 0.1 — Project Initialization and Code Quality Tooling

**Read:** PRD Section 10 (code quality), Section 11 (project structure)

**Act:**
```
1. bun init -y

2. Create tsconfig.json:
{
  "compilerOptions": {
    "target": "ESNext", "module": "ESNext",
    "moduleResolution": "bundler", "strict": true,
    "noUncheckedIndexedAccess": true, "noImplicitReturns": true,
    "exactOptionalPropertyTypes": true, "lib": ["ESNext"],
    "types": ["bun-types"],
    "paths": { "@shared/*": ["./shared/*"], "@server/*": ["./server/*"] }
  },
  "include": ["**/*.ts","**/*.tsx"], "exclude": ["node_modules","dist"]
}

3. Install all dependencies:
bun add three @react-three/fiber @react-three/drei zustand react react-dom simplex-noise
bun add -d @biomejs/biome lefthook typescript @types/three @types/react @types/react-dom bun-types vite @vitejs/plugin-react tailwindcss

4. Create biome.json:
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": { "enabled": true, "rules": {
    "recommended": true,
    "suspicious": { "noExplicitAny": "error" },
    "style": { "noNonNullAssertion": "warn" }
  }},
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 }
}

5. Create lefthook.yml:
pre-commit:
  parallel: false
  commands:
    biome:
      run: bunx biome check --apply .
    typecheck:
      run: bunx tsc --noEmit
    test:
      run: bun test
    veil:
      run: >
        grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate"
        server/agents/qualia-processor.ts
        && echo "VEIL BROKEN — commit blocked" && exit 1 || exit 0

6. bunx lefthook install

7. Create ALL directories from PRD Section 11.

8. Create .gitignore: node_modules/ dist/ database.sqlite .env saves/ *.db

9. Create .env.example:
LM_STUDIO_URL=http://localhost:1234/v1
LM_STUDIO_COMPLETION_MODEL=llama-3.1-8b-abliterated
LM_STUDIO_EMBEDDING_MODEL=nomic-embed-text
WORLD_CONFIG=data/world-configs/earth-default.json   # template path, snapshotted into DB at run creation
ELASTIC_HEARTBEAT=false
TRIPLE_BASELINE=false

10. Create BLOCKERS.md: "# Blockers\n"

11. git init && git add -A && git commit -m "chore: project bootstrap with biome, lefthook, veil guard"
```

**Validate:**
```bash
bun --version                  # 1.x
bunx biome --version           # Shows version
bunx lefthook run pre-commit   # Should pass (empty project)
bunx tsc --noEmit              # Zero errors
ls server/agents/ server/world/ server/memory/ server/perception/  # All exist
```

---

### TASK 0.2 — Shared Types (Complete)

**Read:** PRD Section 3 (all agent types), Section 2 (all config types), Section 4 (species), Section 5 (voxel), Appendix A (events)

**Act:**
```
Create shared/types.ts with ALL types from PRD:

WorldConfig and all sub-configs:
- PhysicsPreset, CircadianConfig (NEW), TerrainConfig, ResourceConfig (NEW)
- ResourceDefinition, SleepConfig, RestMode, MemoryConfig
- LanguageConfig, FreeWillConfig, PerceptionConfig, DreamConfig
- SemanticMaskingConfig (NEW), ResearchConfig, TimeConfig (NEW with elastic heartbeat)
- AgentPopulationConfig, ElementConfig, WorldConfig (complete)

Agent types:
- BodyPart, BodyMap (NEW), BodyState (includes BodyMap and cycleHormone)
- MuscleStats (NEW), Vec3, AgentState (complete, includes mentalModels)
- MentalModel (NEW), BehaviouralObservation (NEW)
- Relationship (updated with behaviouralPatterns), PersonalProject
- TraumaFlag, ConflictFlag, ImmediateReactionType

Memory types:
- EpisodicMemory (includes motivatedForgetting fields)
- SemanticBelief, FeelingResidue, LexiconEntry
- MemoryInstruction, ConsolidationResult

Language types:
- ProtoWord, GrammarRule, LexiconEntry, DialectDistance, VocalActuation (NEW — Stage 1)

Species types:
- SpeciesConfig (includes muscleStatRanges), SenseProfile
- DomesticationConfig, DomesticationState

World types:
- VoxelType, Voxel (includes lightLevel), VoxelMetadata, VoxelMarking (updated)
- MaterialType, BiomeType, TechNode, DiscoveryCondition, TechEffect, DNATrait

Research types:
- BaselineConfig ("A" | "B" | "C"), TripleBaselineResult
- Hypothesis, HypothesisResult, Finding, ParamSweep

System types:
- System2Output (includes theoriesAboutOthers)
- TheoryOfMindEntry, ActionDecision, ActionType
- FilteredPercept, RawPercept, AttentionScores (NEW)
- EmotionalFieldData, EmotionalFieldDetection, FeelingResidueTint
- WSMessage, WSCommand, RunState, BranchNode, RunSummary

Create shared/events.ts:
- EventType enum — ALL types from PRD Appendix A including all NEW events
- SimEvent interface: { event_id, branch_id, run_id, tick, type, agent_id?,
                        target_id?, payload, importance?, baseline_config? }

Create shared/constants.ts:
- DEFAULT_EPISODIC_DECAY_RATE = 0.5
- DEFAULT_SEMANTIC_DECAY_RATE = 0.05
- DEFAULT_NE_LOCK_DURATION = 200
- DEFAULT_CONFIDENCE_THRESHOLD = 0.7
- DEFAULT_MIN_AGENTS_FOR_CONSENSUS = 3
- SYSTEM2_SIGNIFICANCE_THRESHOLD = 0.3
- URGENCY_THRESHOLD = 0.75  (NEW: System1 override trigger)
- TECH_SPREAD_NAMED = 3.0
- TECH_SPREAD_UNNAMED = 1.0
- SNAPSHOT_INTERVAL_TICKS = 100
- MAX_FEELING_RESIDUE = 20
- DEFAULT_ATTENTION_CAPACITY = 5  (NEW)
- DEFAULT_SURVIVAL_DRIVE_WEIGHT = 0.6  (NEW: ω)
- MERKLE_HASH_ALGORITHM = "sha256"  (NEW)
- DEATH_CONCEPT_OBSERVATIONS_REQUIRED = 5  (NEW)
- DEFAULT_CYCLE_LENGTH_TICKS = 480
- MAX_HEARTBEAT_WAIT_MS = 5000  (NEW)

Create tests/types.test.ts — import and verify all types compile
```

**Validate:**
```bash
bunx tsc --noEmit
bun test tests/types.test.ts
biome check shared/
```

---

### TASK 0.3 — World Config Files and Species Definitions

**Read:** PRD Section 2 (all configs), Section 4 (species), Section 8.1 (TripleBaseline)

**Act:**
```
Create data/world-configs/earth-default.json — full WorldConfig:
- physics: earth (gravity 9.8, atmosphere 1.0, oxygen 0.21)
- circadian: enabled, cycleLengthTicks 480, sine curve, seasons enabled
- terrain: 256×256×64, forest+plains, water level 0.3
- resources: scarcityEnabled true, ore deep-biased, food surface, wood forest
- agents: 10 humans, startingMode "none" for language
- species: human, wolf, deer
- sleep: natural_sleep, fatigueEnabled true
- dreams: all 4 modes, default probabilities
- memory: full CLS, DEFAULT rates
- freeWill: all enabled, survivalDriveWeight 0.6, awarenessThreshold 0.85
- perception: attentionFilterEnabled true, attentionCapacity 5
- semanticMasking: enabled true, sensible label map (temperature→flux_7 etc)
  qualiaUsesRealLabels: true (agents experience as text, not tokens)
- research: tripleBaselineEnabled false (default off)
- time: elasticHeartbeat false, tickDurationMs 100

Create data/world-configs/semantic-vacuum.json (Config C baseline):
- Same as earth-default but:
  semanticMasking.qualiaUsesRealLabels: false
  semanticMasking.rotatePeriodically: true, rotationIntervalTicks: 500
  research.tripleBaselineEnabled: true

Create data/world-configs/moon-harsh.json:
- physics: moon (gravity 1.6, atmosphere 0.0)
- Scarce oxygen sources — survival extreme pressure

Create data/world-configs/freeform-sandbox.json:
- sleep: background_consolidation
- freeWill: survivalDriveWeight 0.2
- semanticMasking: disabled
- No goal

Create data/species/human.json (SpeciesConfig):
- cognitiveTier: "full_llm"
- senseProfile: sight 30, sound 50, smell 15, empath 10
- emotionalFieldEnabled: true, canLearnLanguage: true
- muscleStatRanges: strength [0.3,0.8], speed [0.3,0.8], endurance [0.4,0.9]
- survivalDriveWeight: 0.6
- circadianSensitivity: 0.8

Create data/species/wolf.json (SpeciesConfig):
- cognitiveTier: "behavior_tree"
- senseProfile: sight 40, sound 80, smell 200 (wind-modified), empath 3
- threatLevel: 0.7, ecologicalRole: "predator"
- canBedomesticated: true
- muscleStatRanges: strength [0.6,0.95], speed [0.7,0.95], endurance [0.6,0.9]
- survivalDriveWeight: 0.85

Create data/species/deer.json: prey, behavior_tree, flighty

Create data/tech-tree.json — array of TechNode including:
fire_making, stone_tools, shelter_building, food_preservation,
animal_domestication, voxel_marking (journaling), rope_making, farming,
pottery, death_concept (isDeathConcept: true)

IMPORTANT:
- These JSON files are authoring templates only
- Runtime code may read the selected template once at run creation
- After that, the template is canonicalised into SQLite and all runtime config reads come from the database snapshot plus config mutations
```

**Validate:**
```bash
bun -e "const c=require('./data/world-configs/earth-default.json');console.log('seed:',c.meta.seed,'ok')"
bun -e "const c=require('./data/world-configs/semantic-vacuum.json');console.log('masking:',c.semanticMasking.qualiaUsesRealLabels)"
bunx tsc --noEmit
```

---

## Phase 1: Core Infrastructure

### TASK 1.1 — SimClock with Elastic Heartbeat

**Read:** PRD Section 9.1 (Elastic Heartbeat), Section 2.10 (TimeConfig)

**Act:**
```
Create server/core/sim-clock.ts:
- SimClock class
- tick: number
- speedMultiplier: number
- pendingSystem2Count: number  (NEW — tracks in-flight LLM calls)
- elasticHeartbeat: boolean
- maxHeartbeatWaitMs: number

Methods:
- start(config: TimeConfig): void
- pause() / resume()
- setSpeed(multiplier: number): void
- registerPendingMind(): void    (NEW — called when System2 fires)
- resolvePendingMind(): void     (NEW — called when System2 returns)
- getTick(): number
- getCircadianPhase(): number    (NEW — 0.0–1.0 position in cycle)

Main loop:
- If elasticHeartbeat=true AND pendingSystem2Count > 0:
  Wait up to maxHeartbeatWaitMs for pendingSystem2Count to reach 0
  If timeout: log warning, proceed anyway
- Increment tick
- Emit EventType.TICK

Create tests/sim-clock.test.ts:
- Test tick increments
- Test elastic heartbeat waits for pending minds
- Test elastic heartbeat proceeds after maxHeartbeatWaitMs timeout
- Test circadian phase 0→1 over cycleLengthTicks
```

**Validate:**
```bash
bun test tests/sim-clock.test.ts
biome check server/core/sim-clock.ts
bunx tsc --noEmit
git add -A && git commit -m "feat: SimClock with elastic heartbeat and circadian phase"
```

---

### TASK 1.2 — EventBus

**Read:** PRD Section 10 (architecture rules)

**Act:**
```
Create server/core/event-bus.ts:
- Singleton EventBus
- emit(event: SimEvent): void — sync dispatch + async DB persist
- on(type: EventType, handler): void
- off(type: EventType, handler): void
- onAny(handler): void — operator audit stream
- Constructor injection only (no global import — enables testing)
- Buffered DB writes (batch every 50 events or 100ms)

Create tests/event-bus.test.ts — standard tests
```

**Validate:**
```bash
bun test tests/event-bus.test.ts
git add -A && git commit -m "feat: EventBus with buffered persistence"
```

---

### TASK 1.3 — Database, Migrations, Merkle-Causality Logger

**Read:** PRD Section 10 (all SQL schemas), Section 7.3 (Merkle-Causality Log)

**Act:**
```
Create server/persistence/database.ts:
- bun:sqlite, WAL mode, foreign keys on
- Runs all migrations on startup
- Typed query methods — no raw SQL outside this file

Create migrations in order:
001-init.sql: runs, branches, events, world_deltas
002-memory.sql: agent_snapshots, episodic_memories, semantic_beliefs,
                feeling_residues, lexicon_entries
003-language.sql: utterances, grammar_rules, dialect_distances, vocal_actuations (NEW)
004-audit-merkle.sql: audit_log WITH previous_hash and entry_hash columns (Merkle)
005-research.sql: hypotheses, findings, param_sweep_runs, triple_baseline_runs (NEW)
006-append-only-memory-events.sql: suppression/context tag append-only tables (NEW)
007-world-config.sql: runs.world_config, runs.world_config_hash, config_mutations (NEW)

Create server/persistence/merkle-logger.ts (NEW):
- MerkleLogger class
- log(tick, branchId, agentId, system, field, oldValue, newValue, causeEventId): void
  Computes entry_hash = sha256(previous_hash || tick || agentId || field || oldValue || newValue)
  Gets previous_hash from last audit_log row for this branch
  Inserts row with both hashes
- logSuppression(agentId, field, suppressedValue, tick): void
  Same but suppressed=true — operator sees what agents cannot
- verifyChain(branchId, fromTick?, toTick?): { valid: boolean, error?: string }
  Recomputes all hashes in range, compares to stored
  Returns false with error description on any mismatch
- getAgentHistory(agentId, fromTick, toTick): AuditEntry[]

Create tests/merkle-logger.test.ts:
- Test entries are chained correctly
- Test verifyChain passes on valid chain
- Test verifyChain fails when entry modified
- Test suppressed entries logged but flagged
- Test append-only: verify no UPDATE/DELETE methods exist on database.ts
```

**Validate:**
```bash
bun test tests/merkle-logger.test.ts
grep -r "\.run.*UPDATE\|\.run.*DELETE" server/persistence/ && echo "FAIL: mutation found" || echo "OK: append-only"
bunx tsc --noEmit
git add -A && git commit -m "feat: SQLite migrations with Merkle-Causality audit log"
```

---

### TASK 1.4 — World Config Persistence (NEW)

**Read:** PRD Section 2.11 (World Config Persistence), Section 8.1 (TripleBaseline)

**Act:**
```
Create server/core/world-config-manager.ts:
- WorldConfigManager class
- create(template: WorldConfig, runId: string, db): void
  Canonicalises the template JSON and stores it in runs.world_config
  Stores sha256 in runs.world_config_hash
- load(runId: string, branchId: string, tick: number, db): WorldConfig
  Loads base snapshot from runs and applies config_mutations up to tick
- mutate(runId, branchId, tick, path, newValue, db, merkleLogger, appliedBy, causeEventId): void
  Reads old value from reconstructed config
  Writes append-only config_mutations row
  Logs the mutation through MerkleLogger with old/new values
- verify(runId: string, db): boolean
  Recomputes hash of stored world_config and compares to world_config_hash

Update bootstrap/runtime:
- World config JSON files remain templates only
- bootstrapSimulation snapshots the chosen template into SQLite at run creation
- bootstrapSimulation loads runtime config from WorldConfigManager.load(...)
- Deterministic run IDs include config identity, not seed alone
- Runtime systems do not re-read JSON files after run creation

Create tests/world-config-manager.test.ts:
- Persists canonical config snapshot in runs
- Reconstructs config from base snapshot + mutations
- verify() catches tampered config snapshots
- Restarting against the same DB does not reinsert duplicate run artifacts
```

**Validate:**
```bash
bun test tests/world-config-manager.test.ts
bun test tests/bootstrap.test.ts
bunx tsc --noEmit
git add -A && git commit -m "feat: persist world configs as run artifacts"
```

---

### TASK 1.5 — LM Studio Gateway

**Read:** PRD Section 9 (LM Studio), Section 3.2 (System 2 prompt rules)

**Act:**
```
Create server/llm/providers/lmstudio.ts:
- completion(prompt, systemPrompt, options): Promise<string>
- embed(text): Promise<number[]>
- isAvailable(): Promise<boolean>
- 30s timeout, 3 retries with exponential backoff
- Throws LMStudioUnavailableError (does NOT crash simulation)

Create server/llm/gateway.ts:
- systemPromptForAgent(agent: AgentState, species: SpeciesConfig, maskingConfig: SemanticMaskingConfig): string
  FORBIDDEN WORDS CHECK — must pass before any commit:
  The prompt MUST NOT contain any of:
  simulation, AI, artificial, model, code, data, LLM, database,
  tick, agent_id, coordinate, operator, Forge
  The agent is a PERSON experiencing REALITY.
  If semanticMasking enabled: use masked sensor labels in prompt, not real ones.
- complete(agentId, prompt, options): Promise<string>
- embed(text): Promise<number[]>
- Queue: max 5 concurrent

Create server/llm/mock-gateway.ts:
- Deterministic responses for testing
- Same interface as LLMGateway

Create tests/llm-gateway.test.ts:
- Test with MockLLMGateway
- CRITICAL: scan system prompt for forbidden words
- Test semantic masking replaces labels in prompt
- Test queue concurrency respected
```

**Validate:**
```bash
bun test tests/llm-gateway.test.ts
grep -r "simulation\|artificial\|LLM\|database\|operator\|Forge\|agent_id" \
  server/llm/gateway.ts && echo "FAIL: forbidden word in gateway" || echo "OK"
git add -A && git commit -m "feat: LM Studio gateway with forbidden-word safety"
```

---

### TASK 1.6 — Run Manager and Branch Manager

**Read:** PRD Section 8 (research platform schemas)

**Act:**
```
Create server/core/run-manager.ts and server/core/branch-manager.ts
Standard run/branch CRUD with fork support.
BranchManager.getWorldStateAtTick: reconstructs from base snapshot + deltas.
```

**Validate:**
```bash
bun test tests/run-manager.test.ts
git add -A && git commit -m "feat: RunManager and BranchManager"
```

---

## Phase 2: World Engine

### TASK 2.1 — Voxel Grid and Delta Stream

**Read:** PRD Section 5.1 (Voxel schema including lightLevel), Section 5.2 (delta stream)

**Act:**
```
Create server/world/voxel-grid.ts:
- VoxelGrid class with SharedArrayBuffer backing
- get(x,y,z): Voxel — includes lightLevel
- set(x,y,z, voxel): void — records delta
- getDirtyVoxels() / clearDirty()
- getNeighbors(x,y,z): Voxel[]
- getLightLevel(x,y,z): number  (NEW — for sense computer visibility)

Create server/world/delta-stream.ts:
- DeltaStream class
- flushTick(branchId, tick, dirtyVoxels, causeEventId): void
- reconstruct(branchId, tick): VoxelGrid

Create server/world/terrain-generator.ts:
- generate(config: TerrainConfig, seed: number): VoxelGrid
- simplex-noise terrain generation
- Biome placement
- Resource seeding per ResourceDefinition (scarcity model)
- Resource quality variance (some deposits richer)

Create tests/voxel-grid.test.ts — standard tests
```

**Validate:**
```bash
bun test tests/voxel-grid.test.ts
git add -A && git commit -m "feat: VoxelGrid with lightLevel, scarcity resource seeding"
```

---

### TASK 2.2 — Circadian Engine (NEW)

**Read:** PRD Section 2.2 (CircadianConfig), Section 5.3 (Circadian World Engine)

**Act:**
```
Create server/world/circadian-engine.ts:
- CircadianEngine class
- tick(currentTick: number, world: VoxelGrid, config: CircadianConfig): CircadianState
  CircadianState: { lightLevel, surfaceTemperatureDelta, cycleHormoneValue, season }
- computeLightLevel(tick, config): number
  Uses sine curve or step function based on config.lightCurve
  Returns 0.0 (dark) to 1.0 (full light)
- computeSurfaceTemperature(lightLevel, config): number
  Surface voxels shift temperature by up to config.temperatureDelta
- computeCycleHormone(lightLevel, config): number
  Peaks when lightLevel low (rest phase)
  Named by config.cycleHormoneLabel in any output (default "cycle_flux")
- computeSeason(tick, config): SeasonType
  If config.seasonEnabled: derive season from longer cycle
- updateWorldLighting(world, lightLevel): void
  Updates lightLevel on all surface voxels

Create tests/circadian-engine.test.ts:
- Test lightLevel 0→1→0 over one cycle
- Test cycleHormone is inverse of lightLevel
- Test surface temperature shifts with light
- Test season advances over multiple cycles
- Test circadian output uses masked hormone label, not "sleepiness"
```

**Validate:**
```bash
bun test tests/circadian-engine.test.ts
# Verify no real label names leak
grep -n "sleepiness\|melatonin\|circadian" server/world/circadian-engine.ts \
  && echo "WARN: unmasked label" || echo "OK: labels masked"
git add -A && git commit -m "feat: CircadianEngine — light cycles, seasonal drift, masked hormones"
```

---

### TASK 2.3 — Physics, Elements, Pathfinding, Spatial Index

**Read:** PRD Section 2.1, Section 5.4 (element spreading)

**Act:**
```
Create server/world/physics-engine.ts:
- PhysicsEngine class
- loadPreset(preset: PhysicsPreset): void
- getGravity(): number
- getMaterialProperty(material, property): number
- applyGravityToAgent(agent, world): BodyState delta
- calculateTemperatureAt(x,y,z, world, circadianState): number
  Now includes circadian surface temperature contribution
- calculateFallDamage(velocity, mass): number
- calculateBodyPartDamage(impactForce, targetPart): BodyPart delta  (NEW)

Create server/world/element-engine.ts:
- ElementEngine with fire spread, water flow, wind
- All spread uses physics material properties

Create server/world/pathfinding.ts: A* with LRU cache
Create server/world/spatial-index.ts: Grid bucketing for radius queries
```

**Validate:**
```bash
bun test tests/element-engine.test.ts
git add -A && git commit -m "feat: Physics, elements, pathfinding, spatial index"
```

---

### TASK 2.4 — Tech Tree and Journaling Loop

**Read:** PRD Section 5.4 (tech tree), Section 5.5 (journaling loop), death_concept node

**Act:**
```
Create server/world/tech-tree.ts:
- TechTree class
- load(nodes: TechNode[]): void
- checkDiscovery(agentId, context): TechNode | null
- checkDeathConceptDiscovery(agentId, auditLogger): boolean  (NEW)
  Queries agent's semantic store for correlated entries:
  - observed_agent_stillness × N
  - observed_absent_emotional_field × N
  - observed_cold_body × N
  If count >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED:
  → unlock death_concept tech node
  → emit DEATH_CONCEPT_DISCOVERED event
  → update self-narrative: agent now understands mortality
- canTeach(teacherId, studentId, techId): boolean
- teach(teacherId, studentId, techId): void

Create server/world/journaling.ts:
- JournalingSystem class
- checkDiscovery(agent, world): boolean
- markVoxel(agentId, x, y, z, text, world): void
- discoverMarking(agent, x, y, z, world): DiscoveredMarking | null
  Compute lexical overlap between marking's language and agent's current lexicon
  Full overlap → meaning recovered → potentially unlock tech
  Partial overlap → "mysterious symbols, you sense meaning you cannot grasp"
  No overlap → "marks on the stone, their purpose unknown"
```

**Validate:**
```bash
bun test  # all existing tests pass
git add -A && git commit -m "feat: TechTree with death concept discovery, journaling loop"
```

---

## Phase 3: Perception, Attention, and Qualia

**This is the most critical phase. The Veil is built here.**

### TASK 3.1 — Sense Computer and Emotional Field

**Read:** PRD Section 3.1 (BodyState), Section 2.8 (PerceptionConfig), species SenseProfile

**Act:**
```
Create server/perception/sense-computer.ts:
- SenseComputer class
- computePerception(agent, world, allAgents, spatialIndex, config,
                    circadianState): RawPercept
  RawPercept includes:
  - visibleAgents (line-of-sight check, reduced by darkness from circadianState.lightLevel)
  - audibleAgents (range + wall penalty)
  - smellableAgents (range + wind direction)
  - nearbyVoxels (in range)
  - localTemperature (physics + circadian contribution)
  - lightLevel (from circadianState — NOT labelled "lightLevel" in output)
  - weather
  - vocalActuations: nearby agents' Stage-1 vocal reflexes (NEW — for language Stage 1)

Create server/perception/emotional-field.ts:
- Compute/detect emotional fields
- Suppressed fields: logged to audit via MerkleLogger(suppressed=true), invisible to agents

Create server/perception/feeling-residue.ts:
- Add/tick/query residues
- getMoodTint(): aggregate valence/arousal

Create tests/sense-computer.test.ts:
- Test darkness reduces sight range
- Test circadian light affects visibility
- Test vocal actuation detected by nearby agents (Stage 1 language)
```

**Validate:**
```bash
bun test tests/sense-computer.test.ts
git add -A && git commit -m "feat: SenseComputer with circadian visibility, vocal actuation detection"
```

---

### TASK 3.2 — Attention Filter (NEW)

**Read:** PRD Section 2.8 (attention model), Section 3.3 (AttentionFilter)

**Act:**
```
Create server/agents/attention-filter.ts:
- AttentionFilter class
- filter(percept: RawPercept, agent: AgentState, config: PerceptionConfig): FilteredPercept
  FilteredPercept:
  - primaryAttention: top N entities (scored by weights)
  - peripheralAwareness: count of remaining entities + aggregate emotional field
  - focusedVoxels: top 5 nearby voxels by interest
  - ownBody: always included (not filtered)

- scoreEntity(entity, agent, config): number
  score = (relationshipStrength × w1) + (emotionalFieldIntensity × w2)
        + (movementVelocity × w3) + (novelty × w4)
  novelty: 1.0 if agent never seen this entity, 0.0 if seen 1000+ times
  Relationship weight: 0.0 if unknown, up to 1.0 if strong bond

- Agents NEVER know what's outside their attention capacity
  Peripheral agents are simply absent from their experience
  This creates social blind spots, missed opportunities, narrative drama

Create tests/attention-filter.test.ts:
- Test only top N entities pass through
- Test relationship strength boosts score
- Test movement velocity boosts score
- Test novel entities score high
- Test peripheral agents produce only aggregate mention, not individual qualia
```

**Validate:**
```bash
bun test tests/attention-filter.test.ts
git add -A && git commit -m "feat: AttentionFilter — salience-weighted perception at scale"
```

---

### TASK 3.3 — Qualia Processor (The Wall)

**Read:** PRD Section 3.4 (Qualia Processor — read EVERY word), Section 6.2 (Sapir-Whorf), Section 2.4 (SemanticMaskingConfig)

**Act:**
```
Create server/agents/qualia-processor.ts:

QualiaProcessor class — THE MOST IMPORTANT MODULE. READ PRD 3.4 COMPLETELY FIRST.

qualiaFor(
  agent: AgentState,
  filteredPercept: FilteredPercept,  // Post-AttentionFilter
  emotionalDetections: EmotionalFieldDetection[],
  moodTint: FeelingResidueTint,
  circadianState: CircadianState,    // NEW
  worldConfig: WorldConfig
): string

ABSOLUTE RULES — tested by unit tests, blocked by lefthook:
1. Output is natural language ONLY. No JSON. No numbers. No metadata.
2. Agent IDs → relationship labels. NEVER agent IDs.
3. Coordinates → spatial felt sense. NEVER numbers.
4. BodyMap values → localised sensations:
   bodyMap.leftArm.pain > 0.5 → "a burning in your left arm"
   bodyMap.torso.temperature < 10 → "a deep chill in your chest"
   bodyMap.rightLeg.damage > 0.7 → "your right leg feels weak and wrong"
5. Circadian state rendering (NEVER use real labels):
   cycleHormone high + lightLevel low → "your body feels heavy, drawn toward stillness"
   cycleHormone low + lightLevel high → "something in your body is alert and ready"
   Season change → "the world feels different in a way you cannot name yet"
6. Lexicon constraint (Sapir-Whorf):
   Check agent.lexicon for each concept before naming it
   No word → render as undifferentiated sensation
   Has word → can be named in experience text
7. Semantic masking:
   If worldConfig.semanticMasking.qualiaUsesRealLabels = false:
   Pass masked tokens through directly (Config C research mode)
   Else: translate all masked tokens to experiential text
8. Cultural context modifies tone:
   Read agent.semanticStore for relevant beliefs about perceived elements
   Fire sacred → warmth described with reverence
   Fire traumatic → same warmth described as dread
9. Emotional field detections → vague felt impressions
   ("something in their bearing makes you uneasy")
10. MoodTint → colours overall tone (post-residue feeling)
11. Body part attention: most intense sensation leads the description

FORBIDDEN — tested by grep in lefthook and validated by test:
simulation, AI, artificial, code, data, tick, _id, coordinate,
any ordinal number, any decimal number, any hex value, cycle_hormone,
flux_7 (or any masked token), cycleHormone, lightLevel, circadian

Implement template engine:
- Templates keyed by (sensation_category, lexicon_tier, cultural_context)
- 80+ templates minimum
- Cultural variants for fire, water, darkness, death, strangers

Create tests/qualia-processor.test.ts:
EVERY test must pass — these are the Veil integrity tests:
1. Output contains no forbidden words (automated scan)
2. Agent ID never appears in output
3. Coordinates never appear in output
4. hunger=0.8 → hunger sensation text not number
5. bodyMap.leftArm.pain=0.7 → "left arm" pain text
6. cycleHormone high → heaviness/rest-desire text, not "tired" if no word
7. Low lexicon → sparse sensation-only output
8. High lexicon → rich phenomenological output
9. Cultural belief modifies fire description
10. Emotional field detection → vague impression only
11. Semantic masking tokens NEVER appear in experiential output
12. Config C (qualiaUsesRealLabels=false) passes tokens through
```

**Validate:**
```bash
bun test tests/qualia-processor.test.ts  # All 12 tests must pass
# Veil check
grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate\|cycle_hormone\|lightLevel" \
  server/agents/qualia-processor.ts && echo "VEIL BROKEN" || echo "Veil intact"
biome check server/agents/qualia-processor.ts
git add -A && git commit -m "feat: Qualia Processor — epistemological wall, body schema, circadian, masking"
```

---

## Phase 4: CLS Memory System

### TASK 4.1 — Episodic Store and Salience Gate

**Read:** PRD Section 3.6 (CLS Memory — all sub-sections including motivated forgetting)

**Act:**
```
Create server/memory/salience-gate.ts:
- computeSalience(event, agent, config): number  (NE signal 0.0–1.0)
  Factors: emotional valence magnitude, novelty, survival relevance, body-part pain severity

Create server/memory/episodic-store.ts:
- encode(agentId, qualiaText, event, salience, config): EpisodicMemory
- retrieve(agentId, queryEmbedding, k): EpisodicMemory[]
- tickDecay(agentId, currentTick, config): void  (ACT-R power law)
- rehearse(memoryId, currentTick): void
- suppress(memoryId): void  (NEW — motivated forgetting)
  Sets suppressed=true, changes decay parameters
  Suppression logged to MerkleLogger(suppressed=true)
- contextTag(memoryId, context): void  (NEW — contextual forgetting)
  Tags memory with encoding context
  Retrieval penalised in mismatching context
- getHighSalience(agentId, minSalience): EpisodicMemory[]
- getTraumaFlagged(agentId): EpisodicMemory[]

Create tests/episodic-store.test.ts including:
- Test suppressed memories decay differently
- Test contextual tags penalise retrieval in wrong context
- Test suppression logged to audit with suppressed=true flag
```

**Validate:**
```bash
bun test tests/episodic-store.test.ts
git add -A && git commit -m "feat: Episodic store with motivated forgetting and contextual memory"
```

---

### TASK 4.2 — Semantic Store and Consolidation

**Read:** PRD Section 3.6 (CLS transfer, consistency rule, conflict delta)

**Act:**
```
Create server/memory/semantic-store.ts:
- Standard CLS semantic store
- Consistency check with conflict delta
- Death concept tracking:
  trackDeathObservation(agentId, observationType): void  (NEW)
  getDeathObservationCount(agentId): number
  Called when agent witnesses stillness, absent emotional field, cold body

Create server/memory/consolidation.ts:
- Consolidation class
- consolidate(agent, config): ConsolidationResult
  Standard CLS transfer
  Also: check if death observations >= DEATH_CONCEPT_OBSERVATIONS_REQUIRED
  If so: signal TechTree to unlock death_concept

Create server/memory/decay-engine.ts:
- tickAll(agents, config, currentTick): void
  Episodic + semantic decay
  Suppressed memories use config.suppressionDecayRate
  Expired feeling residues cleaned up

Create tests/cls-memory.test.ts — standard + death concept tests
```

**Validate:**
```bash
bun test tests/cls-memory.test.ts
git add -A && git commit -m "feat: CLS memory — semantic store, consolidation, death concept tracking"
```

---

### TASK 4.3 — Dream Engine

**Read:** PRD Section 3.7 (Dream Engine — all 4 modes)

**Act:**
```
Create server/dream/dream-engine.ts:
- All 4 dream modes per PRD Section 3.7
- dreamChaos: random recombination → myth/religion/art material
  Track shared archetypes across agents in faction
  Emergence detector integration: flag when multiple agents share chaos archetype
- All dream memories tagged with source type
- Dream processing logs to MerkleLogger
```

**Validate:**
```bash
bun test tests/dream-engine.test.ts
git add -A && git commit -m "feat: Dream engine with chaos archetype tracking"
```

---

## Phase 5: Agent Engine

### TASK 5.1 — System 1 with Body Schema

**Read:** PRD Section 3.1 (System 1 — all bullets), BodyMap type, MuscleStats

**Act:**
```
Create server/agents/system1.ts:
- tick(agent, world, physics, circadianEngine, config): BodyStateDelta

Includes all original homeostasis PLUS:

Body schema (NEW):
- computeBodyPartTemperature(part, localTemp, contactVoxel): number
  Each body part tracks its own temperature toward local environment
- computeBodyPartPain(part, impactEvent, decayRate): number
  Pain is per-body-part, not a scalar
- updateBodyMap(agent, world, events): BodyMap delta

Circadian integration (NEW):
- updateCycleHormone(agent, circadianState): number
  Agent's cycleHormone tracks circadianState value + individual variation
  Contribution to fatigue accumulation rate

IntegrityDrive (NEW — ω):
- computeIntegrityDrive(body, config): number
  integrityDrive = ω × (hunger×0.3 + max_body_part_pain×0.4 + threat×0.3)
  Where ω = config.freeWill.survivalDriveWeight
  Emits UrgentNeedSignal if > URGENCY_THRESHOLD

Vocal actuation Stage 1 (NEW):
- checkVocalActuation(body): VocalActuation | null
  High pain → involuntary pain yelp
  High arousal + threat → alarm call
  High valence → pleasure sound
  These are NOT intentional communication — purely physical System1 outputs
  Transmitted to nearby agents via emotional field / sound range

Conflict physics (NEW):
- computeConflictOutcome(agentA, agentB): ConflictDelta
  Uses muscleStats (strength, speed, endurance) + current health
  Returns damage distribution between parties
  No concept of "winning" or "losing" — just physics outcomes
  Social interpretation (dominance/submission) emerges from memory of outcomes

Create tests/system1.test.ts including:
- Test body-part pain localisation
- Test integrityDrive ω scaling
- Test vocal actuation on high pain
- Test conflict outcome based on muscle stats
- Test cycle hormone tracks circadian phase
```

**Validate:**
```bash
bun test tests/system1.test.ts
git add -A && git commit -m "feat: System1 with body schema, ω-integrity drive, vocal actuation, conflict physics"
```

---

### TASK 5.2 — System 2 with Theory of Mind Output

**Read:** PRD Section 3.2 (System 2), Section 3.5 (Theory of Mind)

**Act:**
```
Create server/agents/system2.ts:
- shouldFire(agent, bodyDelta, percept, config): boolean
  Include: integrityDrive delta > threshold (NEW — ω override signal)
  Include: UrgentNeedSignal from System1
- think(agent, qualiaText, llm, config): System2Output
  System2Output includes theoriesAboutOthers (NEW)

Theory of Mind integration (NEW):
The System2 prompt includes for each primary-attention agent:
- Their name/label
- Observed emotional field (valence/arousal impression)
- Recent behaviouralPatterns from relationship history
LLM naturally produces ToM-like reasoning
Output theoriesAboutOthers: [{ targetAgentId, inferred, estimatedValence, estimatedIntent, confidence }]
These are stored as agent.mentalModels — they are INFERENCES, not facts

CRITICAL: innerMonologue → MerkleLogger ONLY. Never to any agent-accessible path.

Urgency override integration (NEW):
When System1 emits UrgentNeedSignal:
- The urgency sensation dominates the qualia text
- System2 receives this as "everything else feels distant — your body demands attention"
- Agent decides whether to respond (high ω: yes; low ω: may continue project)
- Decision logged to audit
```

**Validate:**
```bash
bun test tests/system2.test.ts
# Inner monologue path check
grep -r "innerMonologue" server/ | grep -v "audit\|merkle\|test" \
  && echo "WARN: inner monologue may be leaking" || echo "OK"
git add -A && git commit -m "feat: System2 with ToM inference, ω urgency override"
```

---

### TASK 5.3 — Will Engine

**Read:** PRD Section 3.8 (Will Engine)

**Act:** Standard will engine per PRD. Add:
- `survivalDriveWeight` (ω) modifies resistance: high-ω agents are less resistant (survival overrides identity)
- SimulationAwareness check produces culturally-framed existential reflection only

**Validate:**
```bash
bun test tests/will-engine.test.ts
git add -A && git commit -m "feat: Will engine with ω-modulated resistance"
```

---

### TASK 5.4 — Reproduction with Muscle Stats

**Read:** PRD Section 3.9 (AgentState — MuscleStats), Section 4 (SpeciesConfig.muscleStatRanges)

**Act:**
```
Create server/agents/reproduction.ts:
Standard reproduction PLUS:
- DNA crossover includes MuscleStats (strength, speed, endurance)
  Blended from parents with mutation within species muscleStatRanges
- These create natural power differentials → social hierarchy emerges
- Death: log semantic store to MerkleLogger before deleting (Sole Witness preserves all)
```

**Validate:**
```bash
bun test tests/reproduction.test.ts
git add -A && git commit -m "feat: Reproduction with muscle stat inheritance"
```

---

## Phase 6: Language Engine

### TASK 6.1 — Stage 1 Vocal Actuation through Stage 3 Shared Lexicon

**Read:** PRD Section 6.1 (Stages 1–3 — especially Stage 1 vocal actuation)

**Act:**
```
Create server/language/emergence.ts:
Stage 1 — Vocal Actuation (NEW — different from previous design):
- processVocalActuation(emitter, actuation, listeners, world): void
  Vocal actuations are System1 outputs, not intentional communication
  Listeners: SenseComputer detected the sound in their audible range
  Record co-occurrence: { signal: actuation.soundToken, context: nearbyPercept }
  This is the raw material from which proto-words emerge

Stage 2 — Proto-word detection:
- If same sound token consistently co-occurs with same referent across N observations:
  → Add to pending_lexicon with confidence

Stage 3 — Shared lexicon promotion:
- Standard confidence threshold + consensus mechanism

Create server/language/lexicon.ts — standard lexicon management
```

**Validate:**
```bash
bun test tests/language-emergence.test.ts
git add -A && git commit -m "feat: Language emergence Stage 1-3 from vocal actuation"
```

---

### TASK 6.2 — Grammar, Dialects, Journaling

**Read:** PRD Section 6.1 (Stages 4–5), Section 5.5 (journaling)

**Act:** Standard grammar detection, dialect tracking, pidgin formation, journaling system per PRD.

**Validate:**
```bash
bun test tests/dialect.test.ts
git add -A && git commit -m "feat: Grammar, dialects, journaling loop"
```

---

## Phase 7: Species, Tech Tree, Orchestration

### TASK 7.1 — Species Registry and Behavior Trees

Standard per PRD Section 4. Behavior tree for wolves/deer. No LLM calls.

### TASK 7.2 — Domestication

Standard per PRD Section 4.1. Language naming boost. Emergent — not programmed.

### TASK 7.3 — Main Orchestrator

**Read:** PRD Section 1 (full architecture diagram), all phase outputs

**Act:**
```
Create server/core/orchestrator.ts:
Main loop per tick:
1. CircadianEngine.tick() → circadianState
2. ElementEngine.tick() → voxel changes
3. PhysicsEngine updates
4. For each agent (parallel via Promise.all):
   a. System1.tick(agent, world, physics, circadianEngine) → bodyDelta
   b. SenseComputer.computePerception() → rawPercept
   c. AttentionFilter.filter() → filteredPercept  (NEW STEP)
   d. EmotionalField.detectFields() → emotionalDetections
   e. FeelingResidue.getMoodTint() → moodTint
   f. QualiaProcessor.qualiaFor(filteredPercept, circadianState) → qualiaText
   g. EpisodicStore.retrieve() → relevant memories
   h. SalienceGate.computeSalience() → salience
   i. If System2.shouldFire():
      clock.registerPendingMind()
      System2.think() [async — does not block tick]
      On resolve: clock.resolvePendingMind()
   j. Apply ImmediateReaction if set by System1
   k. Apply UrgentNeedSignal if threshold exceeded
   l. Update position, apply action
   m. EpisodicStore.encode() if salience > threshold
   n. SemanticStore.trackDeathObservation() if witnessed death-related event
   o. FeelingResidue.tickResidues()
   p. VocalActuation broadcast if System1 emitted one
5. LanguageEmergence.processVocalActuations() and processUtterances()
6. TechTree.checkDiscoveries() for all agents
7. TechTree.checkDeathConceptDiscovery() for all agents
8. DomesticationManager updates
9. ReproductionCheck
10. DeltaStream.flushTick()
11. DecayEngine.tickAll() (every 10 ticks)
12. AnalysisEngine.tick() (async, non-blocking)
13. WebSocket broadcast
14. Snapshot agents every SNAPSHOT_INTERVAL_TICKS
```

**Validate:**
```bash
# Integration test: 5 agents, 200 ticks, no crash
bun test tests/integration.test.ts
git add -A && git commit -m "feat: Main orchestrator with full pipeline including circadian and attention"
```

---

## Phase 8: Analysis and Research Platform

### TASK 8.1 — Analysis Engine

**Read:** PRD Section 8.2 (Analysis Engine — all 4 detectors)

**Act:**
```
Create all analysis modules per PRD:
- CausalMiner, TippingPointDetector, EmergenceDetector, FindingsJournal

EmergenceDetector pre-registered classes (NEW):
Register known behaviours so they're not flagged as "novel":
- basic_tool_use, fire_making, shelter_building, food_sharing
- pain_avoidance, predator_flight, social_grooming
Unknown patterns beyond these → novel emergence flagged
Death concept discovery → special handling (DEATH_CONCEPT_DISCOVERED event)

FindingsJournal:
- Classify each finding by TripleBaseline config if applicable
- "god" mode vs "research" mode narratives
```

### TASK 8.2 — TripleBaseline (NEW)

**Read:** PRD Section 8.1 (TripleBaseline — full design)

**Act:**
```
Create server/research/triple-baseline.ts:
- TripleBaseline class
- spawn(worldConfig: WorldConfig): void
  Creates 3 runs from same seed:
  Config A: worldConfig as-is
  Config B: worldConfig with cognitiveTier="pure_reflex" for all agents, no LLM
  Config C: worldConfig with semanticMasking.qualiaUsesRealLabels=false (semantic vacuum)
  All 3 run in parallel Bun workers

Create server/analysis/baseline-comparator.ts:
- BaselineComparator class
- compareFindings(findingA, findingB, findingC): BaselineInterpretation
  Returns: "confabulation" | "genuine_emergence" | "physical_substrate" | "semantic_dependent"
  Per interpretation matrix in PRD Section 8.1
- generateReport(phenomenonName): string
  LLM generates analysis: what does the triple baseline tell us about this phenomenon?
```

**Validate:**
```bash
bun test tests/triple-baseline.test.ts
git add -A && git commit -m "feat: TripleBaseline research mode with confabulation detection"
```

---

### TASK 8.3 — WebSocket Server

**Read:** PRD Section 7 (all Forge modes)

**Act:**
```
Create server/ws/server.ts:
- Operator stream: all events + MerkleLogger audit entries + inner monologues
- CRITICAL: inner monologues and audit suppressed entries NEVER sent to non-operator connections
- Commands: all interventions from PRD Section 7.4
- TripleBaseline start/stop commands (NEW)
- MerkleChain verify command (NEW)
```

---

## Phase 9: The Forge (Operator UI)

### TASK 9.1 — Core Panels

Frontend scaffold, AgentInspector, MindViewer (operator-only), MemoryBrowser.

**NEW: BodyMapViewer:**
- Visual representation of agent's BodyMap
- Each body part shows pain level (colour gradient)
- Temperature per part
- Click part → detail in audit inspector

### TASK 9.2 — Merkle Audit Inspector (UPDATED)

```
Create client/forge/MerkleAuditInspector.tsx:
- Timeline of state diffs for selected agent
- Hash chain visualisation: each entry links to previous with hash display
- VERIFY button: calls server to verify chain integrity
- Visual: "Cultural shift in Gen 10 → traces to thought in Gen 1"
  Show the full causal path with cryptographic proof
- SUPPRESSED entries shown distinctly (red border)
  These are things the agent could not perceive/remember but operator can see
```

### TASK 9.3 — Timeline, Intervention Palette, Findings Journal

Standard per previous plan plus:
- **TripleBaseline Dashboard (NEW):** Three parallel timelines side by side. Findings classified by baseline config. Divergence points highlighted.
- **Findings Journal:** TripleBaseline classification shown per finding ("genuine emergence" vs "possible confabulation").

### TASK 9.4 — Arnold Mode

3D diagnostic room. Per PRD Section 7.2. Operator converses through Qualia Processor. No hard memory gate — experience translation preserves Veil.

---

## Phase 10: Integration, Tuning, Validation

### TASK 10.1 — Full Integration Test

```
Create tests/integration.test.ts:
Run earth-default.json, 5 agents, 500 ticks.

Assert:
- No crashes
- CircadianEngine cycles correctly
- AttentionFilter limits percept to N entities
- At least 1 vocal actuation emitted (Stage 1 language)
- At least 1 proto-word candidate in lexicon
- At least 1 episodic memory per agent
- At least 1 System2 thought per agent
- Body map has non-zero values on at least some body parts
- Merkle chain verifies clean
- ZERO forbidden words in any qualia output (full scan)
- ZERO agent IDs in any qualia output
- Inner monologue has zero entries in any non-audit DB path
- biome check passes
- tsc --noEmit passes
```

### TASK 10.2 — Balance Tuning

Run 30 min at 10x. Tune constants:
- ω default (survivalDriveWeight)
- URGENCY_THRESHOLD (when does System1 override System2)
- Circadian cycle length vs agent lifespan (should see several cycles per generation)
- Attention capacity (3 too few? 7 too many for believable cognition?)
- Salience thresholds
- Decay rates

### TASK 10.3 — Prompt Tuning

Run simulation. Review 20 inner monologues per agent. Check:
- Does agent reason about circadian states without naming them?
- Does agent show ToM-like reasoning about companions?
- Does body-part pain produce localised concern?
- Do low-lexicon agents feel genuinely pre-linguistic?
- Does death event produce appropriate phenomenological response (no word for it = unnamed heaviness)?

---

## Final Checkpoint

```bash
bun test                   # All pass
biome check .              # Zero warnings
bunx tsc --noEmit          # Zero type errors

# Veil integrity
grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate" \
  server/agents/qualia-processor.ts && echo "VEIL BROKEN" || echo "VEIL INTACT"

# Merkle integrity
bun -e "
import { MerkleLogger } from './server/persistence/merkle-logger.ts';
const r = await MerkleLogger.verifyChain('main');
console.log(r.valid ? 'Merkle chain valid' : 'BROKEN: ' + r.error);
"

# Module isolation
grep -r "from.*server/world" server/agents/ && echo "FAIL" || echo "OK: no cross imports"
grep -r "from.*server/agents" server/world/ && echo "FAIL" || echo "OK"

# Inner monologue isolation
grep -rn "innerMonologue" server/ | grep -v "audit\|merkle\|system2\|test" \
  && echo "WARN: monologue may be leaking" || echo "OK: monologue isolated"

git tag v1.0.0
```
