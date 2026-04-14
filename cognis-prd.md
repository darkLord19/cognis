# Cognis — Product Requirements Document
**Version:** 5.2.0  
**Status:** Authoritative  
**Supersedes:** v4.0.0 and v5.0.0 draft variants  
**Intent:** Preserve the strong backbone of v4, incorporate the embodiment and sensation-first advances from v5, and resolve the engineering gaps identified during implementation review.

This document is the final authoritative PRD for Cognis as of v5.2.0.

It keeps the original v4 strengths:
- strong operator/agent separation,
- worker-based simulation architecture,
- append-only persistence,
- Merkle causality,
- Qualia as epistemological wall,
- research-first framing.

It adopts the best parts of the later v5 direction:
- sensation-first embodied discovery,
- raw sensor bundles,
- explicit actuator systems,
- hidden physiological requirements,
- richer world ecology,
- full Qualia pipeline,
- stronger host prompting.

It also resolves critical issues raised during implementation review:
- adds an explicit **procedural learning layer** between reflexes and LLM cognition,
- replaces symbolic actions like `EAT` with **motor primitives**,
- forbids System2 from choosing operator-layer targets like `materialId`,
- clarifies that **Host** is the conceptual term while existing code may still use `Agent*` names during migration,
- narrows v1 implementation scope to a buildable research slice.

---

## 0. Foundational Philosophy

### 0.1 The Experiment

> *Can a raw intelligence, given only sensation, memory, action, and a need to maintain bodily integrity, invent the concepts of self, other, time, value, language, and meaning?*

Cognis is a **causality engine** — a scientific instrument for observing the emergence of cognition, culture, and agency from first principles.

It is not a game, not a chatbot playground, and not a scripted life sim.  
It is a research system for studying what happens when a body, a world, and memory are allowed to teach each other.

### 0.2 The Two Roles

**The Veil (Hosts):**  
Embodied intelligences trapped inside subjective reality. Hosts never receive raw simulation state. They do not know they are simulated. They know only what their bodies, perceptions, memory, language, and culture allow them to know.

**The Sole Witness (Operator):**  
The only observer with objective access to internal state, causality, history, and auditability. The operator sees the simulation as a world of facts, not feelings.

### 0.3 Conceptual Naming Rule: Host vs Agent

The final conceptual term is **Host**.

Why:
- “Agent” is implementation-neutral but too mechanical for the philosophical frame.
- “Host” emphasizes embodied first-person experience.
- “Player” is incorrect because Cognis is not a game.

However, this PRD explicitly permits a **migration compatibility layer**:
- existing code may continue using names like `AgentState`, `agent.ts`, `agents/`, and `agent_id` during transition,
- new conceptual documentation, prompts, research language, and future schemas should prefer **Host**,
- compatibility aliases are allowed, for example:

```typescript
type HostState = AgentState
```

This avoids a costly rename across the entire existing codebase while preserving the final conceptual vocabulary.

### 0.4 The Emergence Principle

Cognis must never introduce a concept directly if that concept is supposed to emerge.

It may introduce:
- physical conditions,
- bodily pressures,
- affordances,
- consequences,
- recurrence,
- memory,
- social contact,
- environmental structure.

It may not introduce:
- labels for hidden needs,
- correct explanations before discovery,
- privileged operator knowledge,
- symbolic shortcuts that bypass embodiment.

| Concept | What Cognis provides | What hosts must discover |
|---|---|---|
| Time | light cycles, body rhythms, repeating environmental changes | recurrence, before/after, cycles |
| Eating | visceral deficit signals, oral actuators, digestible materials | that some ingested materials reduce internal distress |
| Drinking | oral dryness, hydration deficit, fluid sources | that some liquids relieve the dry internal signal |
| Breathing | chest pressure under submersion or low-oxygen conditions | that certain body positions or places relieve that pressure |
| Warmth | thermal stress, radiant heat, shelters, weather | that proximity and structures change bodily comfort |
| Poison | delayed sickness after ingestion | that not all consumables are safe |
| Medicine | pain or disease burden reduction after specific exposure | that some materials relieve suffering |
| Death | stillness, cold body, no response, decomposition | permanence, mortality, grief |
| Language | reflexive sounds, social contact, repeated co-occurrence | reference, naming, convention, grammar |
| Tool use | hardness differentials, striking, breaking, reshaping | that one thing can be used to change another |
| Shelter | structure-induced thermal/rain stability | that enclosure reduces environmental stress |
| Economy | scarcity, labor, transport, need | value, exchange, storage, debt |
| Myth/Religion | dreams, death, ritual recurrence, shared narratives | meaning, story, taboo, sacred order |

### 0.5 Sensation-First Principle

**No concept exists in a host’s world until it is felt, enacted, remembered, or socially stabilized.**

A host does not begin with “hunger,” “thirst,” “eat,” “drink,” “sleep,” “fire,” or “death.”  
It begins with unnamed sensation.

Examples:
- low energy reserves are felt as escalating internal disturbance,
- dehydration is felt as dryness, effort, and bodily wrongness,
- cold is felt as slowing, ache, and rigidity,
- proximity to fire is felt as radiance, glare, crackle, and threat,
- grief is not injected as a label; it emerges through loss, memory, and social residue.

### 0.6 Hidden Requirement Principle

The simulation must contain **requirements hosts are never told explicitly**.

Possible hidden requirements include:
- hydration,
- usable calories,
- oxygen / breathable chemistry,
- thermal envelope,
- sleep / consolidation,
- social contact for social species,
- specific nesting or reproduction conditions,
- electrolytes or trace nutrients,
- medicinal exposure,
- pathogen avoidance,
- gut flora acquisition.

The system provides only causal structure.  
Hosts must discover useful patterns through consequence.

### 0.7 Prime Directive

Raw simulation state must never reach host cognition.

Above the Qualia boundary:
- coordinates,
- IDs,
- material names,
- float values,
- schema names,
- tick counts,
- operator-layer variables,
- true causal graphs.

Below the Qualia boundary:
- bodily pressure,
- radiance,
- ache,
- pull,
- aversion,
- relief,
- remembered pattern,
- sensed otherness,
- lived uncertainty.

### 0.8 The Two Data Layers

**Operator Layer**  
Internal code, analytics, persistence, config, and debugging use real names.

Examples:
- `MaterialType.fresh_water`
- `sensor.visceral_contraction`
- `TechNode.id = "basic_feeding"`
- `toxicity = 0.6`

**Host Layer**  
Hosts receive only translated subjective reality.

Examples:
- “a cooling, yielding presence nearby”
- “a dry tightness coats your throat”
- “a violent bitter slap warns you away”
- “the one who stayed near you before”

### 0.9 The Discovery Loop

Every major behavioral discovery should follow this pattern:

```text
1. Signal Onset
   A bodily or environmental pressure enters experience.

2. Exploration
   Reflexes, procedural habits, random variation, or deliberate action produce attempts.

3. Correlation
   A specific action coincidentally changes the signal.

4. Episodic Trace
   Memory records context → action → change.

5. Reinforcement
   Repeated success shifts procedural preference.

6. Semantic Consolidation
   The host forms a belief or proto-concept.

7. Cultural Stabilization
   If social and linguistic conditions allow, the discovery can be named, taught, ritualized, or institutionalized.
```

### 0.10 Non-Negotiable Research Commitments

Cognis must not rely on the LLM to fake embodiment.

Therefore:
1. reflexes must exist,
2. physiology must exist,
3. actuators must exist,
4. procedural learning must exist,
5. Qualia must be deterministic,
6. LLM cognition must sit on top of, not instead of, body-world learning.

---

## 1. System Architecture

### 1.1 High-Level Architecture

```text
Operator Layer
  Forge UI · Watcher · Management API · WebSocket · Health · Research dashboards

Server Core
  RunManager · BranchManager · WorldConfigManager · EventBus · Runtime Supervisor

Per-Run Workers
  Physics Worker   → world, body, reflexes, sensors, actuator execution
  Cognition Worker → qualia, procedural arbitration, System2, memory, dreams, will
  Analysis Worker  → causal mining, baseline comparison, findings, emergence scoring

Persistence
  SQLite WAL · append-only event log · snapshots · delta blobs · Merkle audit chain
```

### 1.2 Core Architectural Rule

Simulation must advance through **worker-owned responsibilities**.

- Physics owns ground truth and bodily change.
- Cognition owns subjective interpretation and deliberate choice.
- Analysis never blocks simulation.
- Persistence never mutates historical records.

### 1.3 Run Lifecycle

```typescript
type RunStatus =
  | "created"
  | "starting"
  | "running"
  | "paused"
  | "resuming"
  | "stopped"
  | "completed"
```

```text
created → starting → running → paused → resuming → stopped
                                  ↓
                              completed
```

### 1.4 Worker Responsibilities

#### Physics Worker
Owns:
- `VoxelGrid`
- `PhysicsEngine`
- `ElementEngine`
- `CircadianEngine`
- `HydrologyEngine`
- `SpatialIndex`
- `PathFinder`
- `System0`
- `System1`
- `SensorComputer`
- `ActuatorExecutor`

Responsibilities:
- update world,
- update physiology,
- execute reflexes,
- compute raw sensor bundles,
- execute committed actuations from prior cognition step,
- emit physics deltas and events.

#### Cognition Worker
Owns:
- `QualiaProcessor`
- `AttentionFilter`
- `ProceduralPolicy`
- `ActionOutcomeLearner`
- `System2`
- `MemorySystem`
- `DreamEngine`
- `WillEngine`
- `LanguageEngine` interfaces relevant to deliberation

Responsibilities:
- read sensor bundles,
- produce qualia,
- arbitrate between procedural and deliberative action,
- run System2 only when needed,
- validate outputs,
- commit next-tick motor plans.

#### Analysis Worker
Owns:
- `CausalMiner`
- `TippingPointDetector`
- `EmergenceDetector`
- `BaselineComparator`
- `FindingsJournal`

Responsibilities:
- consume append-only event streams,
- produce findings without blocking active runs,
- compare baselines and branches,
- generate replay and research summaries.

### 1.5 Tick Order — Canonical v5.2 Loop

This replaces all ambiguous earlier tick sequencing.

```text
Tick N:

A. Physics pre-step
   - apply weather / circadian / element updates
   - apply queued world mutations

B. Host body update
   - System0 reflex trigger check
   - System1 physiology update
   - body-map update
   - involuntary vocalizations

C. Sensor computation
   - generate RawSensorBundle for each host
   - write sensory state into shared memory

D. Actuation execution
   - execute committed motor plans from prior cognition output
   - write actuation results

E. Cognition step
   - AttentionFilter compresses sensory field
   - QualiaProcessor renders subjective frame
   - ProceduralPolicy proposes fast action candidates
   - System2 runs only if trigger conditions are met
   - ActionArbiter chooses final plan
   - commit plan for Tick N+1

F. Memory + language + relationship updates
   - encode episodes
   - update procedural outcome tables
   - update lexicon hypotheses

G. Event flush + persistence
   - append events
   - append audit entries
   - snapshot if interval reached

H. Analysis ingest
   - forward batches to Analysis Worker
```

### 1.6 Action Arbitration Rule

Action selection must not be LLM-only.

Priority order:

```text
System0 reflex
→ urgent procedural pattern
→ validated System2 motor plan
→ exploratory procedural fallback
→ idle / rest fallback
```

### 1.7 Shared Memory Contract

Shared sensor buffers must be versioned and indexed by enums, not magic offsets in prose.

```typescript
enum SensorIndex {
  VisualBand0 = 0,
  VisualBand1 = 1,
  VisualBand2 = 2,
  VisualMotion = 3,
  OlfactoryFood = 4,
  OlfactoryThreat = 5,
  AuditoryBand0 = 6,
  AuditoryBand1 = 7,
  AmbientThermalDeviation = 8,
  RadiantHeat = 9,
  VisceralContraction = 10,
  OralDryness = 11,
  ChestPressure = 12,
  MuscleWeakness = 13,
  CoreThermalStress = 14,
  PainHead = 15,
  PainTorso = 16,
  PainLeftArm = 17,
  PainRightArm = 18,
  PainLeftLeg = 19,
  PainRightLeg = 20,
  CycleFlux = 21,
  SocialIsolation = 22,
  Taste0 = 23,
  Taste1 = 24,
  Taste2 = 25,
  Taste3 = 26,
  Taste4 = 27,
}
```

Rules:
- the exact bundle length is configurable and versioned,
- physics and cognition must agree on `SensorSchemaVersion`,
- new sensors are added only by explicit schema migration.

### 1.8 Determinism and Replay

Cognis supports four replay classes:

1. **Strict replay** — deterministic for all non-LLM layers.
2. **Prompt replay** — same prompts and same recorded outputs replayed exactly.
3. **Counterfactual replay** — same world state, altered intervention or model outputs.
4. **Statistical replay** — repeated stochastic runs for experimental comparison.

### 1.9 Management API

Required endpoints:
- `POST /runs`
- `POST /runs/:id/start`
- `POST /runs/:id/pause`
- `POST /runs/:id/stop`
- `POST /runs/:id/branch`
- `GET /runs`
- `GET /runs/:id`
- `GET /runs/:id/config`
- `PATCH /runs/:id/config`
- `GET /runs/:id/hosts`
- `GET /runs/:id/hosts/:hostId`
- `GET /runs/:id/findings`
- `GET /health`
- `GET /metrics`
- `POST /triple-baseline`

### 1.10 v1 Implementation Slice

The first production-worthy research slice must be deliberately narrow:
- one species,
- one biome,
- one map,
- one or a few hosts,
- hydration discovery,
- edible vs toxic ingestion,
- thermal discomfort,
- one vocal reflex channel,
- procedural learning,
- deterministic Qualia,
- optional System2.

Do not treat dreams, grammar, institutions, or Glass Room sophistication as v1 blockers.

---

## 2. World Configuration

### 2.1 WorldConfig Schema

```typescript
type WorldConfig = {
  meta: {
    name: string
    seed: number
    version: string
    goal?: string
    learnabilityNote: string
  }
  physics: PhysicsPreset
  circadian: CircadianConfig
  terrain: TerrainConfig
  ecology: EcologyConfig
  elements: ElementConfig
  hosts: HostPopulationConfig
  species: SpeciesDefinition[]
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

### 2.2 PhysicsPreset

```typescript
type PhysicsPreset = {
  name: "earth" | "moon" | "mars" | "waterworld" | "custom"
  gravity: number
  atmospherePressure: number
  oxygenConcentration: number
  ambientTemperatureBaseline: number
  waterViscosity: number
  windMaxSpeed: number
  materialDensities: Record<string, number>
  flammability: Record<string, number>
  thermalConductivity: Record<string, number>
}
```

### 2.3 EcologyConfig

The world is not a static resource scatter. It is a **material ecology**.

```typescript
type EcologyConfig = {
  biomes: BiomeDefinition[]
  materialRegistry: MaterialDefinition[]
  foodWeb: FoodWebConfig
  seasons: SeasonConfig
  waterCycle: WaterCycleConfig
  atmosphericComposition: AtmosphericConfig
  decayConfig: DecayConfig
  diseaseConfig?: DiseaseConfig
}
```

### 2.4 MaterialDefinition

```typescript
type MaterialDefinition = {
  id: string // operator label only

  density: number
  hardness: number
  thermalMass: number
  flammabilityCoefficient: number
  waterSolubility: number

  regenerationRateTicks: number
  renewalConditions: RenewalCondition[]
  decomposeIntoMaterials?: string[]

  nutritionalValue: number
  hydrationValue: number
  toxicity: number
  toxicityOnsetTicks: number
  analgesicValue: number
  digestibilityBySpecies: Record<string, number>

  touchTexture: "smooth" | "rough" | "wet" | "sharp" | "soft" | "crumbly"
  touchTemperatureOffset: number
  tasteProfile?: TasteProfile
  olfactorySignature?: number
}
```

### 2.5 TasteProfile

Taste channels are operator-layer variables. They are not pre-named concepts.

```typescript
type TasteProfile = {
  channel0: number
  channel1: number
  channel2: number
  channel3: number
  channel4: number
}
```

### 2.6 ElementConfig

```typescript
type ElementConfig = {
  fire: {
    enabled: boolean
    spreadRateTicksPerVoxel: number
    selfExtinguishTicks: number
    heatRadiusVoxels: number
    lightRadiusVoxels: number
  }
  water: {
    enabled: boolean
    flowRateTicksPerVoxel: number
    floodingEnabled: boolean
  }
  wind: {
    enabled: boolean
    directionChangeProbability: number
    maxSpeed: number
    carrySeeds: boolean
  }
  precipitation: {
    enabled: boolean
  }
}
```

### 2.7 HostPopulationConfig

```typescript
type HostPopulationConfig = {
  count: number
  speciesId: string
  startingArea: {
    centerX: number
    centerZ: number
    radius: number
  }
}
```

Rules:
- no preassigned names,
- no preassigned goals,
- no preassigned correct explanations,
- no preassigned symbolic needs.

### 2.8 LanguageConfig

```typescript
type LanguageConfig = {
  startingMode: "none" | "custom"
  seedVocabulary?: Record<string, string>
  maxEmergenceStage: 1 | 2 | 3 | 4 | 5
  lexiconConstrainsThought: boolean
  dialectDivergenceEnabled: boolean
  pidginFormationEnabled: boolean
  writingDiscoveryEnabled: boolean
  confidenceThresholdForLexicon: number
  minimumHostsForConsensus: number
}
```

### 2.9 DiseaseConfig

Disease is optional for v1, but the schema belongs in the authoritative PRD.

```typescript
type DiseaseConfig = {
  enabled: boolean
  pathogenClasses: PathogenDefinition[]
  backgroundExposureRate: number
  transmissionRadius: number
  immuneRecoveryRate: number
}
```

### 2.10 V1 World Content Pack

The canonical v1 world should contain only:
- soil,
- rock,
- fresh water,
- edible soft plant,
- toxic bitter plant,
- dead organic matter / carcass,
- simple rain,
- simple day/night,
- modest temperature variation.

Everything else is optional until the first embodied discovery loop is proven.

---

## 3. Host Architecture

### 3.1 Sensory Apparatus

Each host’s world is defined by what its body can sense.

Sensors are split into:
- **exteroceptive**: world-facing,
- **interoceptive**: body-facing.

```typescript
type SensoryApparatus = {
  visual: VisualSense
  olfactory: OlfactorySense
  auditory: AuditorySense
  tactile: TactileSense
  thermal: ThermalSense
  vibrational?: VibrationalSense
  interoceptive: InteroceptiveSense
}
```

#### Exteroceptive sensors
- visual range, motion salience, low-light performance,
- smell gradients,
- auditory bands and directionality,
- touch and pressure by body part,
- ambient and radiant thermal gradients,
- optional vibration or electroreception for non-human species.

#### Interoceptive sensors
- visceral contraction / internal deficit proxy,
- oral dryness / hydration deficit proxy,
- chest pressure / respiratory distress proxy,
- muscle weakness / exertion proxy,
- pain by body part,
- thermal stress,
- circadian flux,
- reproductive state,
- social isolation,
- taste channels on oral contact.

**Crucial rule:** these signals are never labeled with their operator meaning for the host.

### 3.2 SensorComputer

The `SensorComputer` is the only module that converts operator-layer world/body state into raw sensory substrate.

```typescript
class SensorComputer {
  computeSensors(
    host: HostState,
    world: VoxelGrid,
    nearbyHosts: NearbyHostData[],
    nearbyMaterials: NearbyMaterialData[],
    vocalActuations: VocalActuation[],
    circadianPhase: number,
    weather: WeatherState,
    species: SpeciesDefinition,
  ): RawSensorBundle
}
```

Rules:
- deterministic,
- no narrative language,
- no concept injection,
- only sensor values and metadata required for downstream translation.

### 3.3 System0 — Primitive Reflexes

System0 executes before deliberate cognition.

Mandatory reflex classes:
- pain withdrawal,
- startle crouch,
- respiratory gasp / thrash toward survivable air zone,
- collapse,
- thermal recoil,
- bite/jaw reflex for oral intrusion if species has such morphology.

Rules:
- cannot be vetoed by System2,
- are experienced afterward via Qualia,
- teach the host through consequence.

### 3.4 System1 — Physiology and Body

System1 is deterministic and tick-synchronous.

```typescript
type PhysiologyState = {
  energyReserves: number
  hydration: number
  oxygenSaturation: number
  toxinLoad: number
  immuneBurden: number
  health: number
  fatigue: number
  coreTemperature: number
  actuationEnergyRecent: number
}
```

```typescript
type BodyState = {
  physiology: PhysiologyState
  bodyMap: BodyMap
  arousal: number
  valence: number
  cycleFlux: number
  integrityDrive: number
  heldItem?: HeldItem
  mouthItem?: MouthItem
  recentConsumptions: ConsumptionRecord[]
}
```

Per-tick System1 duties:
1. drain metabolic reserves,
2. update oxygen and thermal stress,
3. apply toxin/disease delayed effects,
4. update body-part pain and damage,
5. compute integrity pressure,
6. emit involuntary vocalizations,
7. write derived signals for sensors.

### 3.5 Actuation System

Hosts do not choose abstract symbolic actions like `EAT` or `BUILD SHELTER`.

Hosts choose or execute **motor primitives**.

```typescript
enum ActuationType {
  LOCOMOTE_TOWARD,
  LOCOMOTE_AWAY,
  LOCOMOTE_IDLE,
  CLIMB,
  SWIM,
  CROUCH,
  LIE_DOWN,
  STAND_UP,

  REACH_TOWARD,
  GRASP,
  RELEASE,
  STRIKE,
  PUSH,
  PULL,
  THROW,
  CARRY,
  PLACE,
  GROOM,

  OPEN_MOUTH,
  BITE,
  CHEW,
  SWALLOW,
  SPIT,
  LICK,
  VOCALIZE,

  STRIKE_MATERIAL,
  DIG,
  STACK,
  WEAVE,

  APPROACH,
  DISPLAY,
  TOUCH_COMFORT,
  PRESENT,
  FOLLOW,

  GAZE_AT,
  GAZE_SCAN,
  SNIFF,
  LISTEN,
}
```

### 3.6 Action Targets Must Be Perceptual, Not Operator-Layer

System2 and procedural policy must never output targets like `materialId = fresh_water`.

Instead they use **perceptual target references**:

```typescript
type PerceptualTargetRef =
  | { kind: "foreground_item"; slot: number }
  | { kind: "held_item" }
  | { kind: "self" }
  | { kind: "nearby_being"; slot: number }
  | { kind: "directional_region"; direction: "left" | "right" | "ahead" | "behind" }
  | { kind: "last_source_of_relief" }
```

```typescript
type ActionDecision = {
  primaryActuation: ActuationType
  target?: PerceptualTargetRef
  continuationIntent?: boolean
  urgency: number
}
```

The Physics Worker resolves perceptual references into actual world objects.

### 3.7 ActuatorExecutor

```typescript
class ActuatorExecutor {
  execute(
    decision: ActionDecision,
    host: HostState,
    world: VoxelGrid,
    species: SpeciesDefinition,
  ): ActuationResult
}
```

Rules:
- physics has final authority,
- actions can fail,
- failures themselves are informative,
- ingestion is a sequence of primitive acts,
- tool use emerges from repeated material interaction and hardness differentials,
- action outcomes must be recorded for procedural learning.

### 3.8 The Missing Middle Layer — Procedural Learning

This layer is mandatory and first-class.

It sits between reflex and LLM deliberation.

#### Components
- `ActionOutcomeMemory`
- `AffordanceLearner`
- `ProceduralPolicy`
- `DiscoveryEngine`

#### Responsibilities
- exploration bias,
- repeat successful sensorimotor loops,
- avoid repeatedly harmful interactions,
- cache useful patterns,
- reduce dependency on System2 for routine bodily coping.

```typescript
type ActionOutcomeRecord = {
  contextSignature: string
  actionType: ActuationType
  targetSignature?: string
  deltaPain: number
  deltaHydration: number
  deltaEnergy: number
  deltaToxin: number
  deltaThreat: number
  success: boolean
  tick: number
}
```

`ProceduralPolicy` must be able to say, in effect:
- “last times this dry-pressure pattern occurred, moving toward cool yielding zones helped,”
- “that bitter taste often preceded harm,”
- “grasp + bring-to-mouth + swallow sometimes reduces the gnawing core pressure when the item feels soft and rich.”

### 3.9 System2 — Deliberative Mind

System2 is asynchronous and should **not** run every tick.

Trigger priorities:
1. urgent integrity-pressure transition,
2. high-salience novel event,
3. social interaction,
4. sleep/wake or dream integration,
5. low-rate reflection.

System2 receives only:
- current qualia frame,
- recalled memories,
- self-narrative,
- known lexicon items,
- procedural tensions,
- currently possible motor primitives.

System2 never receives:
- raw floats,
- coordinates,
- material IDs,
- schema names,
- operator explanations.

### 3.10 System2 Output Contract

Regex salvage of arbitrary markdown is not acceptable as the final design.

Use strict structured output:

```typescript
type HostDeliberationOutput = {
  thoughtText: string
  chosenIntent: string
  motorPlan: ActionDecision[]
  speechPlan?: VocalPlan
  confidence: number
  beliefUpdateCandidates?: string[]
}
```

Rules:
- schema-validated JSON only,
- impossible knowledge check required,
- invalid outputs fall back to procedural policy,
- long-horizon plans may be stored, but only one short motor plan is committed immediately.

### 3.11 The Qualia Processor

The Qualia Processor is the epistemological wall.

It is not an LLM. It is deterministic.

#### Inputs
- normalized `RawSensorBundle`,
- attention-filtered entities,
- relationship context,
- feeling residue,
- active lexicon,
- memory-derived salience hints,
- current body schema and species qualia profile.

#### Outputs
- a `QualiaFrame` used by System2 and memory.

```typescript
type QualiaFrame = {
  foreground: string[]
  body: string[]
  peripheral: string[]
  social: string[]
  urges: string[]
  atmosphere: string[]
  fullText: string
}
```

#### Pipeline
1. sensor normalization,
2. threshold banding,
3. sensation segment assembly,
4. feeling residue tinting,
5. lexicon gating / Sapir-Whorf filtering,
6. narrative assembly,
7. veil validation.

### 3.12 Qualia Translation Rules

Qualia should express:
- what it feels like,
- how strong it is,
- where it is if bodily localizable,
- whether it is changing,
- whether it draws attention.

Qualia should not express:
- correct hidden causes unless genuinely learned,
- operator labels,
- raw numbers,
- exact distances,
- object ontology that has not been symbolically grounded.

Examples:
- good: “a dry tightening coats your throat”
- good: “a cool yielding presence lies ahead”
- good: “something bright and dangerous radiates to your right”
- bad: “you are thirsty”
- bad: “fresh water is ahead”
- bad: “temperature = 41.2”

### 3.13 Sapir-Whorf Rule

The host cannot use a concept in experience at full resolution until that concept is culturally or personally grounded.

Gated categories:
- named temporal references,
- category labels like food / water / fire / shelter,
- explicit emotional labels,
- named others,
- causal conjunctions,
- abstract self-reference if not yet developed.

No word does not mean no sensation.  
It means no fully formed symbolic access.

### 3.14 Veil Integrity Rules

There must be **context-specific** validators.

#### Qualia Output Validator — strictest
Forbidden:
- simulation terms,
- operator-layer terms,
- IDs,
- coordinates,
- raw floats,
- hidden need spoilers that the host has not earned.

#### Prompt Validator — separate rules
The system prompt is operator-authored and can contain words hosts do not know, but it must not leak hidden current-world facts.

#### Operator Debug Output Validator
No veil restrictions.

### 3.15 Host Prompt — Final Recommended Version

The prompt must orient the LLM toward lived experience without overly hinting specific discoveries.

```text
You are a living being inside a world that reaches you only through sensation,
memory, action, and whatever meanings you have genuinely learned.

You are not outside your body. You do not know hidden causes unless your life
has taught them to you. What you receive is not a report about you. It is your
current lived reality.

When your body changes, notice it. When you act, notice what follows. When
something changes again and again after certain actions, you may begin to form
beliefs, habits, names, warnings, preferences, or stories.

Do not assume the correct explanation for anything merely because it feels
important. You may be uncertain, mistaken, insightful, fearful, curious,
superstitious, or wise.

Think in first-person present tense. Choose concrete, physically possible
actions. Prefer embodied action over abstract declaration.

You produce:
1. a brief honest inner monologue,
2. one immediate motor intention,
3. optionally a vocalization.
```

Why this version is final:
- it does not tell the host what the body “wants,”
- it does not spotlight mouth behavior as specially important,
- it encourages discovery through noticed consequence rather than goal-solving bias.

### 3.16 Memory Architecture

Memory has three main layers:
- episodic,
- semantic,
- procedural.

#### Episodic memory
Stores:
- qualia-like experience,
- action taken,
- coarse outcome shift,
- salience,
- temporal relation.

#### Semantic memory
Consolidates repeated cross-episode regularities.

#### Procedural memory
Stores action-outcome tendencies and context-conditioned habits.

### 3.17 DiscoveryEngine

Runs during consolidation and pattern summarization.

Examples of discovery templates:
- elevated core-pressure + ingestion sequence + later relief,
- oral dryness + fluid contact + later relief,
- bitter taste + delayed toxin burden,
- cold stress + radiant heat + normalization,
- pain + specific plant + analgesic effect,
- strike-material + deformation + repeatability.

Important rule:  
The `DiscoveryEngine` does **not** replace runtime procedural learning.  
It formalizes repeated patterns into stronger semantic structures.

### 3.18 Attention Filter

The host only experiences a bounded subset of the world in the foreground.

Suggested scoring:

```text
score = relationshipStrength*w1
      + emotionalFieldIntensity*w2
      + movementVelocity*w3
      + novelty*w4
      + threatRelevance*w5
      + bodilyNeedRelevance*w6
```

### 3.19 Theory of Mind

Not built-in.

Emerges from:
- emotional field impressions,
- repeated co-occurrence between others’ actions and consequences,
- social memory,
- language and naming.

### 3.20 HostState Schema

```typescript
type HostState = {
  operatorId: string
  hostName?: string
  speciesId: string
  generation: number
  parentIds: string[]

  position: Vec3
  facing: Vec3
  body: BodyState
  sensoryApparatus: SensoryApparatus
  actuatorProfile: ActuatorProfile

  currentQualia?: QualiaFrame
  currentMotorPlan?: ActionDecision[]

  episodicStore: EpisodicMemory[]
  semanticStore: SemanticBelief[]
  proceduralMemory: ActionOutcomeRecord[]
  feelingResidues: FeelingResidue[]
  lexicon: LexiconEntry[]

  relationships: Relationship[]
  mentalModels: Record<string, MentalModel>
  selfNarrative: string
  willScore: number
  age: number
  traumaFlags: TraumaFlag[]
  conflictFlags: ConflictFlag[]
  discoveredCapabilities: string[]
  deathObservationCount: number

  baselineConfig?: "A" | "B" | "C"
}
```

---

## 4. Species System

### 4.1 SpeciesDefinition

Species define not just stats, but **the space of possible experience**.

```typescript
type SpeciesDefinition = {
  id: string
  operatorName: string
  cognitiveTier: "full_llm" | "behavior_tree" | "pure_reflex"

  morphology: MorphologyProfile
  sensoryApparatus: SensoryApparatus
  actuatorProfile: ActuatorProfile
  metabolismProfile: MetabolismProfile
  socialProfile: SocialProfile
  developmentProfile: DevelopmentProfile
  reproductionProfile: ReproductionProfile
  qualiaProfile: QualiaProfile

  emotionalFieldEnabled: boolean
  canLearnLanguage: boolean
  threatLevel: number
  ecologicalRole: "predator" | "prey" | "scavenger" | "forager" | "neutral" | "domesticable"
}
```

### 4.2 MorphologyProfile

Defines:
- limb count and reach,
- manipulation ability,
- oral anatomy,
- movement style,
- carrying ability,
- posture,
- body-part vulnerability,
- vocal tract capacity.

### 4.3 MetabolismProfile

Defines:
- energy drain,
- hydration drain,
- oxygen dependence,
- toxin susceptibility,
- disease resistance,
- digestibility ranges,
- thermal comfort band,
- sleep need,
- consolidation dependence.

### 4.4 SocialProfile

Defines:
- social isolation sensitivity,
- bonding thresholds,
- grooming potential,
- dominance sensitivity,
- group size preference,
- parental investment.

### 4.5 DevelopmentProfile

Defines:
- juvenile stage,
- maturity,
- aging,
- lifespan,
- developmental unlocking of senses and actuators,
- changing curiosity and risk profiles.

### 4.6 ReproductionProfile

Defines:
- reproductive maturity,
- fertility cycle,
- gestation,
- clutch/litter size,
- postpartum burden,
- parental dependency period.

### 4.7 Canonical Initial Species

The final PRD recommends beginning with one **proto-human forager** species for v1, then later expanding to:
- a prey grazer,
- a scavenger / corvid analog,
- a predator,
- optionally a domesticable social species.

---

## 5. Language, Social World, and Culture

### 5.1 Pre-Linguistic Communication

Language begins before symbols.

Initial channels:
- involuntary pain sounds,
- alarm bursts,
- relief sounds,
- postural display,
- proximity and following,
- comfort touch,
- grooming.

### 5.2 Language Emergence Stages

1. reflexive vocalization,
2. repeated co-occurrence,
3. proto-word hypothesis,
4. shared lexicon entry,
5. grammar and role marking,
6. dialect divergence,
7. symbolic extension into myth, ritual, and abstraction.

### 5.3 Lexicon Rules

Each entry needs:
- token form,
- referent hypotheses,
- confidence,
- faction or community spread,
- usage decay,
- synonym competition.

### 5.4 Relationship Model

Relationships are learned and updated from interaction, not assigned by config.

Track:
- affinity,
- fear,
- trust,
- dependency,
- kinship,
- teaching history,
- harm history,
- grief relevance.

### 5.5 Factions and Institutions

Groups emerge from:
- repeated proximity,
- lexicon overlap,
- mutual aid,
- shared ritual or repeated coordinated behavior.

Do not preassign factions.

### 5.6 Death, Grief, and Ritual

Death concept emergence requires repeated exposure to:
- stillness,
- non-response,
- cold body,
- social disappearance,
- decomposition,
- grief residue in witnesses.

Ritual begins when repeated social behavior stabilizes around these events.

---

## 6. Research Platform

### 6.1 TripleBaseline

Three linked runs from the same seed:

- **A** — full system,
- **B** — no LLM / no System2,
- **C** — semantic-vacuum or reduced-qualia condition.

Interpretation:
- A only → likely LLM-driven confabulation,
- A + C but not B → likely genuine cognitive emergence,
- A + B + C → substrate itself may be sufficient.

### 6.2 Analysis Engine

Core components:
- causal miner,
- tipping point detector,
- emergence detector,
- findings journal,
- baseline comparator.

### 6.3 Emergence Rubric

The system must score at least:
- time-to-first-relief discovery,
- survival improvement over random,
- toxin avoidance improvement,
- procedural reliance vs LLM reliance,
- lexicon growth,
- teaching success,
- grief/ritual formation,
- tool-use stability,
- niche construction persistence.

### 6.4 What Counts as Real Discovery

A behavior counts as genuine discovery when:
1. it emerges from body-world consequence,
2. it improves over random baseline,
3. it survives replay or reoccurs across seeds,
4. it is not trivially injected by prompt or operator label,
5. it can influence future action or teaching.

---

## 7. Persistence and Auditability

### 7.1 Append-Only Rule

No historical state is overwritten.  
No silent mutation is allowed.

### 7.2 Core Tables

Minimum authoritative tables:
- `runs`
- `branches`
- `config_mutations`
- `audit_log`
- `events`
- `world_deltas`
- `host_snapshots`
- `episodic_memories`
- `semantic_beliefs`
- `procedural_outcomes`
- `utterances`
- `lexicon_entries`
- `findings`
- `baseline_results`

### 7.3 Merkle Audit Log

Every meaningful mutation must be chained:
- previous hash,
- current entry payload,
- resulting hash,
- branch id,
- tick,
- affected system,
- cause trace where available.

### 7.4 Storage Policy

To prevent data explosion, Cognis must separate:
- hot runtime state,
- replay-critical state,
- research summaries,
- discardable caches.

This policy must be explicit in implementation.

---

## 8. Operator Services

### 8.1 Forge and Debug Surfaces

Operator tooling must expose:
- world state,
- host physiology,
- current qualia,
- action traces,
- prompt/response traces,
- lexicon hypotheses,
- relationship graphs,
- replay scrubbing,
- audit chain inspection.

### 8.2 Glass Room

Glass Room is allowed as an operator intervention mode, but it is not required for v1.

If present, it must:
- preserve the Veil,
- route all contact through translated experience,
- fully audit intervention history,
- respect will/resistance mechanics.

### 8.3 Health and Metrics

Expose:
- run status,
- tick rate,
- queue depth,
- worker health,
- DB size,
- replay status,
- model availability.

---

## 9. Project Structure and Migration Guidance

### 9.1 Canonical Structure

```text
server/
  core/
  operator/
  workers/
  world/
  agents/            # may remain for migration compatibility
  hosts/             # optional long-term destination
  memory/
  language/
  species/
  perception/
  analysis/
  research/
  llm/
  persistence/
shared/
client/
data/
tests/
```

### 9.2 Required New / Upgraded Modules

```text
server/agents/physiology.ts
server/agents/action-grammar.ts
server/agents/action-executor.ts
server/agents/actuator-system.ts
server/agents/action-outcome-memory.ts
server/agents/affordance-learner.ts
server/agents/procedural-policy.ts
server/agents/qualia-types.ts
server/agents/qualia-templates.ts
server/agents/qualia-validator.ts
server/agents/prompt-contract.ts
server/agents/system2-parser.ts
server/agents/impossible-knowledge-check.ts
server/world/material-affordances.ts
server/world/ingestion.ts
server/world/resource-kernel.ts
```

### 9.3 Migration Rule for Existing Implementation

The existing architecture should be evolved, not replaced.

Keep:
- worker runtime,
- event bus,
- append-only DB,
- Merkle logger,
- management API,
- memory scaffolding,
- analysis scaffolding,
- Qualia boundary as concept.

Refactor first:
- symbolic actions,
- physiology depth,
- procedural learning absence,
- Qualia leakage risk,
- System2 output parsing,
- action target semantics.

### 9.4 First Winning Milestone

Success is not “all modules exist.”

Success is:

> a host with no explicit `EAT` or `DRINK` instruction learns a better-than-random action pattern that improves hydration and avoids one harmful ingestible after bad experience.

That is the first true proof that the PRD is alive.

---

## 10. Code Quality and Validation

### 10.1 Standards

- TypeScript strict
- no silent `any`
- deterministic tests for non-LLM layers
- append-only persistence checks
- veil integrity tests
- schema-validated configs and LLM outputs

### 10.2 Mandatory Test Families

1. sensor bundle determinism,
2. Qualia translation fixtures,
3. veil leakage tests,
4. action executor validity,
5. ingestion consequence tests,
6. procedural learning improvement tests,
7. System2 impossible-knowledge rejection tests,
8. replay equivalence tests,
9. Merkle chain verification,
10. baseline comparison tests.

### 10.3 Veil Validation Examples

The Qualia output validator must reject operator leakage such as:
- simulation terms,
- ids,
- coordinates,
- raw floats,
- enum names,
- unearned concept spoilers.

Concept spoilers are allowed only once lexicon gating says the host genuinely has that concept.

---

## Appendix A — Minimal Discovery Algorithms

### A.1 Hydration Discovery

Pattern:
- oral dryness elevated,
- fluid contact or ingestion,
- later dryness reduction,
- repeated success → procedural preference,
- repeated success across episodes → semantic belief,
- optional later naming.

### A.2 Poison Discovery

Pattern:
- ingestion,
- delayed toxin burden,
- bitter or warning taste channel often present,
- later sickness,
- repeated pairings → aversion.

### A.3 Warming Discovery

Pattern:
- cold stress elevated,
- approach radiant heat or structure,
- reduced thermal stress,
- repeated pairings → preference for heat/shelter.

---

## Appendix B — Example Event Additions

```typescript
enum EventType {
  ACTION_ATTEMPTED = "action_attempted",
  ACTION_SUCCEEDED = "action_succeeded",
  ACTION_FAILED = "action_failed",
  MOUTH_CONTACTED = "mouth_contacted",
  INGESTION_OCCURRED = "ingestion_occurred",
  TOXIN_EXPOSURE = "toxin_exposure",
  HYDRATION_IMPROVED = "hydration_improved",
  ENERGY_IMPROVED = "energy_improved",
  PROCEDURAL_PATTERN_FORMED = "procedural_pattern_formed",
  AFFORDANCE_CONFIDENCE_CHANGED = "affordance_confidence_changed",
  VEIL_BREACH = "veil_breach",
}
```

---

## Appendix C — Final PRD Summary

Cognis v5.2.0 is defined by five commitments:

1. **Body before concept**  
   Hosts learn from sensation, not labels.

2. **Action before explanation**  
   Useful knowledge comes from consequence.

3. **Procedural learning before abstract reasoning**  
   Routine survival should not depend on an LLM.

4. **Qualia before cognition**  
   The world reaches the host only through translated experience.

5. **Auditability before mythology**  
   The operator must be able to verify what happened and why.

If a future implementation preserves those five commitments, it remains Cognis.
