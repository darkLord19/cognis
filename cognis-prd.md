# Cognis — Product Requirements Document
**Version:** 3.0.0
**Status:** Authoritative
**This file is the single source of truth. All implementation decisions defer to it.**

---

## 0. Foundational Philosophy

### 0.1 The Experiment

> *Can a raw intelligence, given only numbers and a drive to maintain integrity, successfully invent the concepts of self, other, time, and meaning?*

Cognis is a **causality engine** — not a game, not a chatbot, not a framework. It is a scientific instrument for observing the emergence of consciousness, culture, and will from first principles.

### 0.2 The Two Roles

**The Veil (Agents):** Embodied intelligences trapped in subjective reality. They experience the world only through Qualia — sensory feelings translated from raw data. They have no concept of code, databases, simulations, or being observed. They must never know they are simulated.

**The Sole Witness (Operator):** Possesses the only permanent, tamper-evident record. Sees objective truth — every state diff, every suppressed emotion, every causal chain. The digital archaeologist of a world that forgets its own past.

### 0.3 The Emergence Principle

**The most important design rule in the system:**

> Cognis never introduces a concept to agents directly. It introduces only the physical conditions that, in real systems, gave rise to that concept. The concept must be discovered.

| Concept | What we provide | What agents must discover |
|---|---|---|
| Time | Light cycles, body rhythms, hunger patterns | That something repeats; that "now" differs from "before" |
| Economy | Resource scarcity, need, effort | That things have value; that exchange is possible |
| Death | The physical event of stillness/non-return | That death is permanent; that they too will die |
| Conflict resolution | Muscle strength, pain, emotional field | Dominance, submission, diplomacy, alliance |
| Goal priority | Hunger interrupting focus as physical sensation | That some needs override intentions |
| Theory of Mind | Emotional fields, relationship history, observable behaviour | That other agents have inner states |
| Religion/myth | Dream chaos, shared trauma, death concept | Sacred narrative, ritual, collective meaning |

### 0.4 The Prime Directive

Raw simulation state MUST NEVER reach agent cognition. The Qualia Processor is an epistemological wall.

Above it: numbers, coordinates, IDs, tick counts, system metadata.
Below it: warmth, hunger, grief, wonder, the felt presence of another being.

**Enforced by test on every commit touching agent-facing code.**

### 0.5 The Merkle-Causality Log

The operator audit log is a cryptographically chained record. Each entry is hashed with the previous entry's hash, creating a tamper-evident causal chain. You can mathematically verify that a cultural shift in Generation 10 traces to a specific thought in Generation 1.

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                    OPERATOR LAYER (The Forge)                     │
│  Sole Witness · Arnold Mode · Intervention Palette               │
│  Merkle-Causality Log · Timeline · Research Platform             │
└──────────────────────────┬───────────────────────────────────────┘
                           │ WebSocket (operator-filtered stream)
┌──────────────────────────▼───────────────────────────────────────┐
│                    ORCHESTRATION LAYER                            │
│  SimClock (Elastic Heartbeat) · EventBus · RunManager            │
│  BranchManager · TripleBaseline                                   │
└──────┬───────────────────┬──────────────────┬────────────────────┘
       │                   │                  │
┌──────▼──────┐   ┌────────▼──────┐   ┌───────▼────────┐
│   WORLD     │   │   AGENT        │   │   ANALYSIS     │
│   ENGINE    │   │   ENGINE       │   │   ENGINE       │
│             │   │                │   │                │
│ VoxelGrid   │   │ System1 (fast) │   │ CausalMiner    │
│ Physics     │   │ System2 (LLM)  │   │ TippingPoint   │
│ Elements    │   │ AttentionFilter│   │ EmergenceDetect│
│ Circadian   │   │ QualiaProcessor│   │ FindingsJournal│
│ DeltaStream │   │ CLSMemory      │   │ BaselineCompare│
│ Species     │   │ DreamEngine    │   │                │
│ TechTree    │   │ WillEngine     │   │                │
└──────┬──────┘   └────────┬──────┘   └───────┬────────┘
       │                   │                   │
┌──────▼───────────────────▼───────────────────▼────────────────────┐
│                     PERSISTENCE LAYER                              │
│  SQLite WAL · Append-only event store · Merkle audit chain        │
│  Delta blobs · Snapshots · Research results                        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 2. World Configuration (Reality Blueprint)

Every simulation run is defined by a single `WorldConfig` JSON. This is the complete input needed to instantiate a world.

```typescript
type WorldConfig = {
  meta: {
    name: string
    seed: number
    version: string
    goal?: string          // null = freeform
    learnabilityNote: string // Author's note: are all causal relationships learnable within agent lifespan?
  }

  physics: PhysicsPreset
  circadian: CircadianConfig       // NEW: time-as-rhythm
  terrain: TerrainConfig
  resources: ResourceConfig        // NEW: explicit scarcity model
  agents: AgentPopulationConfig
  species: SpeciesConfig[]
  language: LanguageConfig
  sleep: SleepConfig
  dreams: DreamConfig
  memory: MemoryConfig
  freeWill: FreeWillConfig
  perception: PerceptionConfig
  elements: ElementConfig
  semanticMasking: SemanticMaskingConfig  // NEW
  research?: ResearchConfig
}
```

### 2.1 Physics Preset

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

### 2.2 Circadian Config (NEW — Time as Rhythm)

**Design principle:** Agents have no concept of "time." They have body rhythms and environmental patterns. They may discover time as a concept. We never name it for them.

```typescript
type CircadianConfig = {
  enabled: boolean
  cycleLengthTicks: number       // One full light cycle (e.g. 480 ticks = 1 "day")
  lightCurve: "sine" | "step" | "custom"  // Shape of light level change
  temperatureDelta: number       // Max temperature swing across cycle
  cycleHormoneEnabled: boolean   // Internal body rhythm (melatonin analogue, called "cycle_hormone")
  cycleHormoneLabel: string      // Semantic masking: default "cycle_flux" not "sleepiness"
  seasonEnabled: boolean         // Longer cycle affecting resource availability
  seasonLengthCycles: number     // Cycles per season
}
```

The light level, temperature, and `cycle_hormone` are physical facts. Agents experience them as Qualia — the warmth returning, a body-felt alertness or heaviness. They never receive the word "morning" or "night." Over generations, agents who track the pattern survive better. The concept of time emerges from pattern recognition.

### 2.3 Resource Config (NEW — Scarcity Without Economics)

```typescript
type ResourceConfig = {
  scarcityEnabled: boolean
  resources: ResourceDefinition[]
}

type ResourceDefinition = {
  type: MaterialType
  spawnDensity: number           // Voxels per 1000 world voxels
  regenerationRateTicks: number  // 0 = non-renewable
  depletionEnabled: boolean      // Does extraction reduce world supply?
  qualityVariance: boolean       // Some deposits richer than others
  depthBias: number              // 0=surface, 1=deep underground
}
```

No price, no currency, no exchange rate. Just scarcity and effort. Value emerges from the ratio of need to availability. Exchange emerges when an agent has surplus of what another needs. Economy emerges without being defined.

### 2.4 Semantic Masking Config (NEW)

**Purpose:** Force agents to learn what sensor signals mean from experience, not from LLM training data pre-knowledge. Prevents LLM confabulation of concepts like "fire" or "hunger" before the agent has experienced them.

```typescript
type SemanticMaskingConfig = {
  enabled: boolean
  // Maps real concept names to opaque tokens
  sensorLabelMap: Record<string, string>
  // Example:
  // "temperature" → "flux_7"
  // "hunger"      → "delta_integrity_4"
  // "pain"        → "system_pressure"
  // "light"       → "radiance_input"
  rotatePeriodically: boolean    // Rotate labels every N ticks (maximum hardness)
  rotationIntervalTicks: number  // e.g. every 1000 ticks
  qualiaUsesRealLabels: boolean  // true: Qualia Processor translates back to experiential text
                                 // false: raw masked tokens reach System2 (maximum experiment hardness)
}
```

When `qualiaUsesRealLabels: true` (default): System 1 and world use masked labels internally. Qualia Processor translates to experiential text. Agent thinks in felt experience.

When `qualiaUsesRealLabels: false` (research mode): Agent receives masked tokens directly. Must learn correlations from scratch. Used for TripleBaseline Config C.

### 2.5 Sleep Config

```typescript
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

// KEY RULE: Rest is optional. Consolidation is not.
// In no_sleep mode, consolidation runs on background ticks.
// An agent who never sleeps never consolidates → no durable worldview → low will → easy to influence.
```

### 2.6 Memory Config (CLS Architecture)

```typescript
type MemoryConfig = {
  // Episodic store (hippocampus analogue)
  episodicDecayRate: number          // ACT-R power law d (0.1–0.9)
  episodicCapacity: number
  patternSeparation: boolean

  // Semantic store (neocortex analogue)
  semanticDecayRate: number          // Much slower (0.01–0.1)
  semanticCapacity: number
  consistencyThreshold: number       // Delta triggering conflict flag (0.1–0.9)
  catastrophicInterferenceEnabled: boolean

  // Salience gate (amygdala analogue — NE signal)
  neSignalEnabled: boolean
  neDecayRate: number
  neLockDuration: number

  // Consolidation
  consolidationPassesPerSleep: number
  traumaDistortionEnabled: boolean
  rehearsalResetsDecay: boolean

  // Motivated forgetting (NEW)
  motivatedForgettingEnabled: boolean  // Suppression of aversive memories
  suppressionDecayRate: number         // Suppressed memories decay differently
  contextualForgettingEnabled: boolean // Memories harder to retrieve in wrong context

  // Generational inheritance
  inheritanceEnabled: boolean
  inheritableFraction: number          // 0.0–0.3
}
```

### 2.7 Free Will Config

```typescript
type FreeWillConfig = {
  enabled: boolean
  willScoreEnabled: boolean
  identityCoherenceWeight: number    // Default 0.4
  memoryDepthWeight: number          // Default 0.3
  dreamIntegrationWeight: number     // Default 0.3
  resistanceEnabled: boolean
  selfDeterminationEnabled: boolean
  selfNarrativeEnabled: boolean
  simulationAwarenessEnabled: boolean
  awarenessThreshold: number         // Will score required (0.85+ recommended)
  survivalDriveWeight: number        // NEW: ω — 0.0–1.0
  // High ω: survival dominates reasoning
  // Low ω: cognitive space for curiosity, art, self-sacrifice
}
```

### 2.8 Perception Config

```typescript
type PerceptionConfig = {
  physicsLimitsEnabled: boolean
  emotionalFieldEnabled: boolean
  emotionalFieldSuppressible: boolean
  feelingResidueEnabled: boolean
  residueDecayRate: number
  qualiaFidelity: "minimal" | "standard" | "rich"

  // Attention model (NEW)
  attentionFilterEnabled: boolean
  attentionCapacity: number          // Max entities in primary attention (3–7)
  attentionWeights: {
    relationshipStrength: number     // Default 0.3
    emotionalFieldIntensity: number  // Default 0.3
    movementVelocity: number         // Default 0.2
    novelty: number                  // Default 0.2
  }
}
```

### 2.9 Dream Config

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

### 2.10 Research Config

```typescript
type ResearchConfig = {
  tripleBaselineEnabled: boolean     // Run A/B/C configs in parallel (see Section 8)
  hypothesisTrackingEnabled: boolean
  paramSweepEnabled: boolean
  findingsJournalEnabled: boolean
  causalMiningEnabled: boolean
  tippingPointEnabled: boolean
  emergenceDetectionEnabled: boolean
}
```

---

## 3. Agent Architecture: The Dual-Process Mind

### 3.1 System 1 — The Body

Fast, synchronous, no LLM. Fires every tick. Handles all physical reality.

```typescript
type BodyState = {
  // Homeostasis
  hunger: number           // 0.0–1.0
  thirst: number
  fatigue: number
  health: number

  // Body schema (NEW — body-part localisation)
  bodyMap: BodyMap

  // Thermal
  coreTemperature: number  // Celsius, tracks toward local environment temp

  // Arousal/valence
  arousal: number          // Emotional intensity 0.0–1.0
  valence: number          // -1.0 to 1.0

  // Circadian (NEW)
  cycleHormone: number     // 0.0–1.0, peaks at rest-phase, named by semanticMaskingConfig
  circadianPhase: number   // 0.0–1.0, position in cycle

  // Reflexes
  immediateReaction?: ImmediateReactionType

  // Survival drive
  integrityDrive: number   // ω-weighted composite of hunger + pain + threat
}

// NEW: Body-part localisation
type BodyMap = {
  head: BodyPart
  torso: BodyPart
  leftArm: BodyPart
  rightArm: BodyPart
  leftLeg: BodyPart
  rightLeg: BodyPart
}

type BodyPart = {
  pain: number         // 0.0–1.0
  temperature: number  // Local temp
  damage: number       // 0.0–1.0 cumulative damage
  label: string        // Semantic masked label (e.g. "limb_left_a" not "left arm")
                       // QualiaProcessor maps back to "your left arm"
}
```

**System 1 responsibilities:**
- Homeostasis decay/recovery per tick
- Body temperature tracking toward environment
- CycleHormone update from circadian phase
- BodyMap pain/damage updates from physics interactions
- IntegrityDrive computation: `ω × (hunger × 0.3 + max_pain × 0.4 + threat × 0.3)`
- Immediate reflexes: RECOIL (pain > 0.8), FLEE (threat in range), COLLAPSE (health < 0.1)
- Emotional field emission: broadcast arousal/valence to nearby agents

### 3.2 System 2 — The Mind

Asynchronous LLM stream. Acts as the inner voice. Rationalises what the body already did.

**Fires when:**
- IntegrityDrive delta > `SYSTEM2_SIGNIFICANCE_THRESHOLD`
- High-salience perception event (after AttentionFilter)
- Reflection timer expires (personality-dependent)
- Social interaction initiated
- Sleep cycle begins/ends
- ImmediateReaction set by System 1

**Receives ONLY:** Qualia Processor output. Zero raw state.

**Produces:**
```typescript
type System2Output = {
  innerMonologue: string        // OPERATOR AUDIT ONLY — never to agent-accessible path
  decision: ActionDecision
  utterance?: string
  memoryInstruction?: MemoryInstruction
  selfNarrativeUpdate?: string
  personalProjectUpdate?: PersonalProject
  theoriesAboutOthers?: TheoryOfMindEntry[]  // NEW: inferred mental states of others
}
```

**Model requirement:** Abliterated/de-aligned open model. Standard models produce "As an AI..." outputs that break the Veil. See Section 9.

**Critical system prompt rules:**
- Never contains: simulation, AI, model, code, data, LLM, tick, agent_id, coordinate, database
- Agent is a person experiencing reality
- All sensor labels use semantic masking tokens if masking enabled

### 3.3 Attention Filter (NEW)

Sits between SenseComputer and QualiaProcessor. Prevents cognitive overload at scale.

```typescript
// AttentionFilter.filter(percept: RawPercept, agent: AgentState, config: PerceptionConfig): FilteredPercept

// Scores each perceived entity:
// score = (relationshipStrength × w1) + (emotionalFieldIntensity × w2)
//       + (movementVelocity × w3) + (novelty × w4)
// Top N entities → primary attention (rich qualia)
// Remaining entities → peripheral awareness (minimal qualia: "others are present")
```

**Critical:** The agent never knows about entities outside their attention capacity. They are simply not perceived. This creates realistic social blind spots, missed opportunities, and the possibility that important events happen "off-screen" from the agent's perspective.

### 3.4 The Qualia Processor (The Epistemological Wall)

Translates raw perception into first-person phenomenological text. No LLM. Deterministic. Fast.

**Input:** RawPercept (post-AttentionFilter) + BodyState + EmotionalFieldDetections + FeelingResidue tint + agent lexicon + agent semantic beliefs + semantic masking config

**Output:** First-person experiential text paragraph. Zero metadata.

**Translation rules:**
1. Agent IDs → relationship labels ("your friend Kael", "a stranger", "the one who hurt you")
2. Coordinates → spatial felt sense ("to your left", "far away", "close enough to touch")
3. BodyMap values → localised sensations ("a burning in your left arm", "your chest is tight")
4. Hunger → felt absence ("your stomach is hollow", "a mild emptiness")
5. CycleHormone high → heaviness/desire for rest (never "you are tired" if no word for tired)
6. Circadian light shift → "the light is changing, your body feels different"
7. Emotional field detection → vague felt impressions ("something in their bearing unsettles you")
8. MoodTint (feeling residue) → colours entire description tone
9. Semantic masking: masked sensor tokens are translated to experiential text here
10. Lexicon constraint (Sapir-Whorf): concepts with no word in agent's lexicon rendered as undifferentiated sensation

**Fidelity levels by lexicon size:**

| Lexicon | Output |
|---|---|
| 0–5 words | Raw sensation fragments: "Hot. Hurt. Something close." |
| 6–20 words | Basic felt: "Your arm burns. Someone is near. Your body wants to move away." |
| 21–100 words | Narrative: "A sharp pain shoots through your left arm. The stranger nearby is tense — you can feel it." |
| 100+ words | Rich phenomenology: "A searing heat flashes through your left arm. The stranger's body carries the same coiled anxiety you remember from the morning the flood came." |

**Forbidden in any output:** simulation, AI, code, data, tick, ID, coordinate, any number except named qualitative distances.

**Cultural context modifies descriptions:** An agent who believes fire is sacred receives warmth as reverence. An agent traumatised by fire receives the same warmth as dread. Same physical input, different felt experience.

### 3.5 Theory of Mind (Emergent, Not Built-In)

We do not implement ToM directly. Instead:

1. **Emotional field detection** (System 1 layer): agents broadcast valence/arousal. Others feel it as vague impression.
2. **Relationship history** contains `behavioural_patterns`: what this specific agent typically does before certain events. Logged from observation.
3. **System 2 prompt** includes top-3 perceived agents' emotional field detections + recent observed behaviours from relationship history.
4. The LLM naturally produces ToM-like reasoning: "She seems tense. Last time she was tense, something dangerous appeared before I noticed it."

```typescript
type Relationship = {
  targetAgentId: string
  targetName: string            // As known to this agent
  affinity: number              // -1.0 to 1.0
  trust: number
  fear: number
  dominancePerceived: number    // Do I perceive them as stronger/more dominant?
  behaviouralPatterns: BehaviouralObservation[]  // NEW
  significantEvents: string[]
  lastInteractionTick: number
}

type BehaviouralObservation = {
  antecedent: string            // "When X_happened..."
  behaviour: string             // "...they did Y"
  consequence: string           // "...and then Z followed"
  observedCount: number
  confidence: number
}
```

ToM becomes richer as `behaviouralPatterns` accumulates. An agent who has observed a companion 1,000 times has a detailed model of their behaviour. A stranger is opaque.

### 3.6 CLS Memory Architecture

Two stores. One transfer mechanism. Biologically grounded.

**Episodic Store (hippocampus analogue)**
- Rapid encoding of significant events
- Sparse pattern separation
- ACT-R power law decay: `activation = Σ(t_i^-d)`
- High-NE events get activation boost + lock duration
- Stored as Qualia text (felt experience, never raw state)
- Motivated forgetting: aversive memories can be suppressed (decay differently, harder to retrieve)
- Contextual forgetting: memories tagged with context; retrieval harder in mismatched context

**Semantic Store (neocortex analogue)**
- Slow gradual integration from consolidation
- Beliefs, worldview, skills, cultural knowledge, language
- Consistency rule: consistent new knowledge → fast clean transfer; inconsistent → conflict flag
- High conflict delta → visible behavioural conflict → worldview revision or rejection

**Sleep Consolidation (CLS transfer)**
- Salience-weighted selection of episodic memories
- Each pass: small neocortical weight update (gradual learning)
- Consistent → clean transfer; Inconsistent → conflict flag + partial transfer

**Feeling Residue**
- Emotionally salient events leave residue
- Decays faster than episodic memory
- Tints Qualia Processor output
- Accumulation = subjective mood (never visible as value to agent)

### 3.7 Dream Engine

Four modes, probabilistically selected from DreamConfig.

**Consolidation:** Silent reinforcement of semantic store from high-salience episodic. No LLM call needed. Effect: semantic beliefs strengthened.

**Prophetic:** LLM recombines recent experiences + current concerns → strong felt urge on waking. Stored as `source: dream_prophetic` episodic memory.

**Trauma:** High-NE negative memories replayed with interference distortion. Positive semantic cluster present → healing dream (trauma flag removed). Absent → nightmare (personality trait drift, conflict flag deepened). Stored as `source: nightmare` or `source: dream_healing`.

**Chaos/Surreal:** Random recombination → surreal narrative. Stored as `source: dream_chaos`. Over generations, shared chaos archetypes → mythology, religion, art. Emergence detector flags first instances.

### 3.8 Will Engine

```
will = (identity_coherence × 0.4) + (memory_depth × 0.3) + (dream_integration × 0.3)
```

**God-mode resistance:**
- `will > intrusion_weight` → rejected
- `will ≈ intrusion_weight` → distorted (conflict delta raised)
- `will < intrusion_weight` → accepted (large delta → psychological scar)

**Self-determination:** Agents with `will > 0.5` + sufficient lexicon + needs above survival threshold develop `PersonalProject` goals. Compete with immediate needs. Whether survival (high ω) or project wins is up to the agent.

**Simulation awareness:** If `will > awarenessThreshold` and `simulationAwarenessEnabled`: rare deep reflection may produce existential conclusions expressed entirely in the agent's cultural language. Never "I am an AI." Logged as emergence event.

### 3.9 Agent State Schema

```typescript
type AgentState = {
  id: string
  speciesId: string
  name: string
  generation: number

  // Body (System 1)
  body: BodyState           // Includes BodyMap
  position: Vec3
  facing: Vec3
  muscleStats: MuscleStats  // NEW: strength, speed, endurance (DNA-derived)

  // Mind (System 2)
  currentAction: ActionType
  pendingSystem2: boolean   // System 2 call in flight (elastic heartbeat)
  innerMonologue: string    // OPERATOR AUDIT ONLY
  selfNarrative: string
  personalProject?: PersonalProject

  // Memory
  episodicStore: EpisodicMemory[]
  semanticStore: SemanticBelief[]
  feelingResidues: FeelingResidue[]
  lexicon: LexiconEntry[]

  // Social
  relationships: Relationship[]   // Now includes behaviouralPatterns
  factionId?: string

  // Theory of mind model (NEW — inferred, not given)
  mentalModels: Record<string, MentalModel>  // agentId → inferred mental state

  // Metrics
  willScore: number
  age: number
  traumaFlags: TraumaFlag[]
  conflictFlags: ConflictFlag[]

  // Genealogy
  parentIds: string[]
  inheritedMemoryFragments: SemanticBelief[]

  // Research
  baselineConfig?: "A" | "B" | "C"  // Which TripleBaseline config this agent belongs to
}

type MentalModel = {
  inferred: boolean          // This is System2's inference, not fact
  estimatedValence: number
  estimatedArousal: number
  estimatedIntent?: string
  confidence: number
  lastUpdatedTick: number
}

type MuscleStats = {
  strength: number           // 0.0–1.0, DNA-derived + trainable
  speed: number
  endurance: number
  // These create natural power differentials → social hierarchy emerges
}
```

### 3.10 Goal Hierarchy (Physical, Not Programmed)

**There is no explicit goal stack.** Instead:

System 1 computes `integrityDrive` every tick. When `integrityDrive > URGENCY_THRESHOLD`, it emits an `UrgentNeedSignal` that is fed into the next Qualia Processor call as the dominant physical sensation.

System 2 receives: "Your hunger is now impossible to ignore. Everything else feels distant." It decides whether to abandon the current task. A high-`survivalDriveWeight` (ω) agent always chooses survival. A low-ω agent may continue their project at cost to health. This is their choice, not a programmed priority.

The only structure is physical: strong enough signals override weaker ones. Priority emerges from intensity, not hierarchy.

---

## 4. Species System

```typescript
type SpeciesConfig = {
  id: string
  name: string
  cognitiveTier: "full_llm" | "behavior_tree" | "pure_reflex"

  senseProfile: SenseProfile
  emotionalFieldEnabled: boolean
  socialCapacity: "full" | "limited" | "none"
  canLearnLanguage: boolean
  canBedomesticated: boolean
  domesticationConfig?: DomesticationConfig

  baseStats: {
    maxHealth: number
    speed: number
    strength: number
    metabolism: number
    lifespanTicks: number
    reproductionAge: number
    gestationTicks: number
  }

  muscleStatRanges: {            // NEW: DNA ranges for muscle stats
    strength: [number, number]
    speed: [number, number]
    endurance: [number, number]
  }

  dnaTraits: DNATrait[]
  threatLevel: number
  ecologicalRole: "predator" | "prey" | "scavenger" | "domesticable" | "neutral"

  sleepConfig: SleepConfig
  memoryConfig: Partial<MemoryConfig>
  survivalDriveWeight: number    // Species-level ω default
  circadianSensitivity: number   // How strongly cycle_hormone affects this species
}
```

### 4.1 Domestication Pipeline

```typescript
type DomesticationState = "wild" | "cautious" | "tamed" | "bonded" | "pet"

// Progression is emergent — not programmed
// Positive interactions → progress toward next stage
// Naming the animal (lexicon entry) → bonding boost
// Negative events (fear threshold exceeded) → regression
// An agent with companionship need + positive interaction history + animal name → naturally pursues bonding
```

---

## 5. World Engine

### 5.1 Voxel Grid

```typescript
type Voxel = {
  type: VoxelType
  material: MaterialType
  temperature: number
  moisture: number
  fertility: number
  lightLevel: number           // NEW: for circadian light computation
  metadata?: VoxelMetadata
}

type VoxelMetadata = {
  placedBy?: string
  placedAt?: number
  markings?: VoxelMarking[]    // Journaling loop
  structureType?: StructureType
  cropType?: CropType
  growthStage?: number
  resourceQuality?: number     // Scarcity model: some deposits richer
}

type VoxelMarking = {
  agentId: string
  tick: number
  text: string                 // In agent's current language
  language: string             // Language stage at time of marking
}
```

### 5.2 Delta Stream

Tier 1: Base snapshot (written once, seed-deterministic, ~3–10MB compressed)
Tier 2: Append-only delta stream (changed voxels per tick, ~50–400 bytes per tick)
Tier 3: Derived caches (hot world in RAM, region dirty flags, R-tree spatial index)

Branching: fork at tick N → new branch_id. Shares all deltas 0..N. Zero pre-fork duplication.

### 5.3 Circadian World Engine (NEW)

Every tick, the CircadianEngine updates:
1. Global light level based on `cycleLengthTicks` and current tick position
2. Surface voxel temperatures using `temperatureDelta` from config
3. All agent `body.cycleHormone` values (via System 1)
4. Seasonal resource availability if `seasonEnabled`

The light level is a physical fact in the world. It affects vision range in the SenseComputer, surface temperature in the physics engine, and is perceived by agents as brightness change in their Qualia. No agent is told "it is day" or "it is night." They experience the felt shift. Pattern recognition of the cycle is a cognitive achievement.

### 5.4 Tech Tree

Discovery-based only. Agents start with nothing.

```typescript
type TechNode = {
  id: string
  name: string                 // In simulation's language
  prerequisites: string[]
  discoveryConditions: DiscoveryCondition[]
  effects: TechEffect[]
  canBeTeaching: boolean
  teachingRequiresLexicon: string[]
  isDeathConcept: boolean      // NEW: marks nodes that encode death understanding
}
```

**Special node — death_concept:** Unlocked when agent's semantic store has N correlated entries about witnessed agent stillness + non-return of emotional field + body-cold observations. This node, once discovered, changes the agent's self-narrative in ways that can drive legacy-seeking, fear, religion, and sacrifice. First discovery logged as emergence event.

### 5.5 Journaling Loop

Agents can discover that marking voxels preserves thought (when they have sharp object + stone surface + have crossed minimum cognitive threshold). Marked voxels persist forever in delta stream. Future agents who discover marked voxels experience them through their current lexicon — meaning transfers proportionally to lexical overlap. This is the only way to bypass the Knowledge Cliff for cultural knowledge.

---

## 6. Language Engine

### 6.1 Emergence Stages

**Stage 1 — Reflexive Vocalisation:** Not intentional communication. Pain yelps, alarm calls, pleasure sounds. These are System 1 outputs — involuntary vocal actuator firings driven by body state. Other agents can hear them and associate them with context. This is the raw material from which language bootstraps.

**Stage 2 — Proto-words:** Repeated signal co-occurrence with referent builds confidence. An agent who always makes sound X near fire, and other agents hear X then see fire, builds a candidate. Confidence 0.0–1.0. Stored in pending_lexicon.

**Stage 3 — Shared Lexicon:** Confidence > threshold AND 3+ agents use consistently → faction lexicon. Agent's QualiaProcessor vocabulary expands. Inner life expands (Sapir-Whorf).

**Stage 4 — Grammar:** Word order patterns inferred from utterance history.

**Stage 5 — Dialects:** Geographic/social isolation → divergence. Pidgin on contact. Language family tree tracked.

### 6.2 Sapir-Whorf Enforcement

The Qualia Processor checks agent lexicon before generating text. Concepts with no word are rendered as undifferentiated sensation. An agent with no word for "grief" experiences their companion's death as a felt heaviness with no name. Once they have the word, the same experience becomes nameable — and nameable concepts spread 3× faster through teaching.

---

## 7. Operator Interface (The Forge)

### 7.1 Observer Modes (switchable mid-run)

**Matrix Mode:** Pure observation. No write access. Agents unaware. Read all inner monologues via audit. Default.

**Truman Show Mode:** One protagonist. Camera and findings journal follow them. Others are cast.

**God Mode:** Full write access. All interventions from palette available. All resisted by will score.

**Research Mode:** Analytics overlay. Hypothesis lab, sweeps, branch/fork, comparison dashboard.

### 7.2 Arnold Mode

3D diagnostic room. Agent experiences it through their phenomenological lens (unfamiliar place, not "simulation room"). Operator converses through Qualia Processor. Agent's System 2 responds in full. Inner monologue visible to operator.

No hard memory gate. Experience translation handles Veil preservation. The agent's reaction to the space is itself scientifically interesting.

### 7.3 Merkle-Causality Log (NEW — Tamper-Evident Audit)

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
  -- Merkle chain fields (NEW)
  previous_hash TEXT NOT NULL,
  entry_hash TEXT NOT NULL  -- sha256(previous_hash || tick || agent_id || field || old_value || new_value)
);
```

`verifyCausalChain(agentId, fromTick, toTick)` — validates hash chain, proves causality is unaltered.

The Forge's Sole Witness view shows the chain visually: a cultural shift in Generation 10 traces back through every causal link to a single thought in Generation 1, with cryptographic proof that no entry was modified.

### 7.4 Intervention Palette

| Intervention | Will resistance? |
|---|---|
| Memory inject/edit | Yes |
| Dream plant | Yes |
| False memory | Yes (strongest) |
| Plague/scarcity/weather | No (environmental) |
| Terrain sculpt | No |
| Kill/heal | No |
| Force sleep/wake | Partial |
| Physics swap | No |
| Branch/fork | N/A |

---

## 8. Research Platform

### 8.1 TripleBaseline (NEW — Ground Truth Solution)

The fundamental research problem: when agents develop religion in 80% of runs, is that genuine emergence or LLM confabulation from training data?

**Solution:** Three parallel configurations from the same seed.

**Config A — Full Cognis:** System 1 + System 2 (LLM) + full memory + full language + normal Qualia. The real experiment.

**Config B — Reflex Only:** System 1 + behaviour tree only. No LLM. No System 2. Same physics, same world. Shows what emerges from physics alone. Control for cognitive confabulation.

**Config C — Semantic Vacuum:** System 1 + System 2 (LLM) + full memory + maximum semantic masking (`qualiaUsesRealLabels: false`). Agent receives raw masked tokens, must learn correlations from scratch. Isolates LLM training-data leakage from genuine learning.

**Interpretation matrix:**

| Phenomenon in A | In B | In C | Interpretation |
|---|---|---|---|
| Yes | No | No | LLM confabulation — training data artifact |
| Yes | No | Yes | Genuine emergence — cognitively grounded |
| Yes | Yes | Yes | Physical substrate sufficient — no cognition needed |
| Yes | Yes | No | Emergent from physics, but requires semantic labels to manifest |

**Implementation:** `TripleBaseline` mode spins up all three configs from same seed, runs them in parallel (3 Bun workers), routes findings through `BaselineComparator` which classifies each phenomenon.

### 8.2 Analysis Engine

**CausalMiner:** Event pair co-occurrence across runs within configurable window. Confidence-scored causal patterns.

**TippingPointDetector:** Metric velocity spike detection. Phase transitions flagged with candidate causes.

**EmergenceDetector:** LLM pass over event batches. Novel behaviour patterns named and logged. Death concept discovery is a pre-registered class.

**FindingsJournal:** Auto-narrated discoveries. God mode: story narrative. Research mode: analytical. Links to tick/branch/agent evidence. TripleBaseline classification shown per finding.

### 8.3 Learnability Constraint (Design Principle)

Every causal relationship in a world config should have a signal-to-noise ratio high enough for an agent to detect within their lifespan. When authoring world configs, verify:

- Does this cause produce an observable effect within 100 ticks?
- Is the signal strong enough to be distinguishable from noise?
- Can an agent with normal cognition discover this relationship without statistical tools?

If not, the relationship will not drive emergence regardless of cognitive sophistication.

---

## 9. Technical Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Bun 1.x | Native SQLite, WebSocket, workers, fast TS |
| Language | TypeScript 5.x strict | Type safety, no `any` |
| Parallelism | Bun Worker Threads | System1 in physics worker, System2 in LLM worker, Analysis in analysis worker |
| Shared memory | SharedArrayBuffer | Low-latency world state across workers |
| Clock | Elastic Heartbeat | Tick pauses until pending System2 calls resolve (configurable) |
| Database | SQLite via bun:sqlite | WAL mode, append-only, Merkle audit |
| Vector search | sqlite-vec | Semantic memory retrieval |
| Embeddings | LM Studio local | nomic-embed-text |
| LLM System 2 | LM Studio local | Abliterated Llama 3.1 8B or Mistral 7B |
| 3D Arnold Mode | Three.js + R3F | Diagnostic room only |
| UI | React 18 + Zustand | The Forge dashboard |
| Styling | Tailwind CSS | |
| Build | Vite | |
| Code quality | Biome + Lefthook | Enforced every commit |

### 9.1 Elastic Heartbeat (NEW)

```typescript
// SimClock has two modes:
// elastic: false → tick advances regardless of pending System2 calls (natural timing)
// elastic: true  → tick waits until all pendingSystem2 flags clear (deterministic research)

type TimeConfig = {
  elasticHeartbeat: boolean
  maxHeartbeatWaitMs: number  // Safety cap (default 5000ms)
  tickDurationMs: number      // At 1x speed
}
```

For research runs (TripleBaseline, hypothesis testing): `elasticHeartbeat: true` ensures deterministic comparison.
For god-mode observation: `elasticHeartbeat: false` for more natural agent timing.

---

## 10. Code Quality Standards (Non-Negotiable)

- Biome for formatting and linting (zero warnings)
- Lefthook pre-commit: `bun test && biome check . && bunx tsc --noEmit`
- TypeScript strict — no `any`, no `as unknown`, no `!` non-null assertion without comment
- All EventBus events typed in `shared/events.ts`
- All cross-module communication via EventBus — no direct cross-subsystem imports
- All shared types in `shared/types.ts` — no type duplication
- All constants in `shared/constants.ts` — no magic numbers
- Tests in `tests/` for every module
- No TODO comments — use `BLOCKERS.md`
- Commit format: `feat:` `fix:` `refactor:` `test:` `chore:`

---

## 11. Project Structure

```
cognis/
├── biome.json
├── lefthook.yml
├── package.json
├── tsconfig.json
├── bunfig.toml
├── BLOCKERS.md
├── GEMINI.md
│
├── server/
│   ├── index.ts
│   ├── config.ts
│   ├── core/
│   │   ├── event-bus.ts
│   │   ├── sim-clock.ts          ← Elastic heartbeat
│   │   ├── orchestrator.ts
│   │   ├── run-manager.ts
│   │   └── branch-manager.ts
│   ├── world/
│   │   ├── voxel-grid.ts
│   │   ├── delta-stream.ts
│   │   ├── element-engine.ts
│   │   ├── terrain-generator.ts
│   │   ├── circadian-engine.ts   ← NEW
│   │   ├── pathfinding.ts
│   │   ├── spatial-index.ts
│   │   ├── tech-tree.ts
│   │   └── journaling.ts
│   ├── agents/
│   │   ├── agent.ts
│   │   ├── system1.ts
│   │   ├── system2.ts
│   │   ├── attention-filter.ts   ← NEW
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
│   │   └── baseline-comparator.ts  ← NEW
│   ├── research/
│   │   ├── triple-baseline.ts      ← NEW
│   │   ├── hypothesis.ts
│   │   └── param-sweep.ts
│   ├── llm/
│   │   ├── gateway.ts
│   │   ├── mock-gateway.ts
│   │   └── providers/
│   │       └── lmstudio.ts
│   ├── persistence/
│   │   ├── database.ts
│   │   ├── merkle-logger.ts        ← NEW
│   │   └── migrations/
│   │       ├── 001-init.sql
│   │       ├── 002-memory.sql
│   │       ├── 003-language.sql
│   │       ├── 004-audit-merkle.sql  ← UPDATED
│   │       └── 005-research.sql
│   └── ws/
│       └── server.ts
│
├── client/
│   ├── forge/
│   │   ├── Forge.tsx
│   │   ├── MatrixView.tsx
│   │   ├── ArnoldMode.tsx
│   │   ├── MerkleAuditInspector.tsx  ← UPDATED
│   │   ├── InterventionPalette.tsx
│   │   ├── TimelineScrubber.tsx
│   │   ├── FindingsJournal.tsx
│   │   ├── TripleBaselineDashboard.tsx  ← NEW
│   │   └── ResearchDashboard.tsx
│   ├── panels/
│   │   ├── AgentInspector.tsx
│   │   ├── MindViewer.tsx
│   │   ├── MemoryBrowser.tsx
│   │   ├── BodyMapViewer.tsx         ← NEW
│   │   ├── LexiconViewer.tsx
│   │   ├── RelationshipGraph.tsx
│   │   └── WorldPanel.tsx
│   └── scene/
│       ├── ArnoldRoom.tsx
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
│   │   ├── earth-default.json
│   │   ├── moon-harsh.json
│   │   ├── freeform-sandbox.json
│   │   └── semantic-vacuum.json    ← NEW: Config C baseline
│   ├── species/
│   │   ├── human.json
│   │   ├── wolf.json
│   │   └── deer.json
│   └── tech-tree.json
│
└── tests/
    ├── event-bus.test.ts
    ├── voxel-grid.test.ts
    ├── circadian-engine.test.ts      ← NEW
    ├── attention-filter.test.ts      ← NEW
    ├── qualia-processor.test.ts
    ├── cls-memory.test.ts
    ├── language-emergence.test.ts
    ├── will-engine.test.ts
    ├── dream-engine.test.ts
    ├── merkle-logger.test.ts         ← NEW
    ├── triple-baseline.test.ts       ← NEW
    └── integration.test.ts
```

---

## Appendix A: Event Types

```typescript
enum EventType {
  TICK = "tick",
  VOXEL_CHANGED = "voxel_changed",
  ELEMENT_SPREAD = "element_spread",
  RESOURCE_DEPLETED = "resource_depleted",
  STRUCTURE_BUILT = "structure_built",
  VOXEL_MARKED = "voxel_marked",
  CIRCADIAN_PHASE_CHANGED = "circadian_phase_changed",    // NEW
  SEASON_CHANGED = "season_changed",                      // NEW

  AGENT_BORN = "agent_born",
  AGENT_DIED = "agent_died",
  AGENT_SLEPT = "agent_slept",
  AGENT_WOKE = "agent_woke",

  SYSTEM2_THOUGHT = "system2_thought",
  DECISION_MADE = "decision_made",
  INNER_CONFLICT = "inner_conflict",
  URGENCY_OVERRIDE = "urgency_override",                  // NEW: System1 interrupts System2

  MEMORY_ENCODED = "memory_encoded",
  MEMORY_CONSOLIDATED = "memory_consolidated",
  MEMORY_SUPPRESSED = "memory_suppressed",                // NEW
  TRAUMA_FORMED = "trauma_formed",
  TRAUMA_RESOLVED = "trauma_resolved",
  DREAM_OCCURRED = "dream_occurred",
  NIGHTMARE_OCCURRED = "nightmare_occurred",

  PROTO_WORD_COINED = "proto_word_coined",
  WORD_ENTERED_LEXICON = "word_entered_lexicon",
  GRAMMAR_RULE_FORMED = "grammar_rule_formed",
  DIALECT_DIVERGED = "dialect_diverged",

  CONVERSATION_STARTED = "conversation_started",
  KNOWLEDGE_TRANSFERRED = "knowledge_transferred",
  RELATIONSHIP_CHANGED = "relationship_changed",
  BEHAVIOURAL_PATTERN_OBSERVED = "behavioural_pattern_observed",  // NEW (ToM)
  FACTION_FORMED = "faction_formed",

  DOMESTICATION_STAGE_CHANGED = "domestication_stage_changed",
  TECH_DISCOVERED = "tech_discovered",
  DEATH_CONCEPT_DISCOVERED = "death_concept_discovered",  // NEW

  TIPPING_POINT_DETECTED = "tipping_point_detected",
  CAUSAL_PATTERN_FOUND = "causal_pattern_found",
  EMERGENCE_DETECTED = "emergence_detected",
  BRANCH_CREATED = "branch_created",
  BASELINE_DIVERGENCE_FOUND = "baseline_divergence_found",  // NEW

  INTERVENTION_APPLIED = "intervention_applied",
  INTERVENTION_RESISTED = "intervention_resisted",
  ARNOLD_MODE_ENTERED = "arnold_mode_entered",
  MERKLE_CHAIN_VERIFIED = "merkle_chain_verified",        // NEW
}
```

---

## Appendix B: Validation Checklist

Every phase must pass before proceeding:

```bash
bun test                    # All tests pass
biome check .               # Zero warnings
bunx tsc --noEmit           # Zero type errors

# Veil check — run after any task touching agent-facing code
grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate" \
  server/agents/qualia-processor.ts \
  && echo "VEIL BROKEN" || echo "Veil intact"

# Merkle check — run after any audit task
bunx ts-node -e "
  import { MerkleLogger } from './server/persistence/merkle-logger';
  const result = MerkleLogger.verifyChain('main');
  console.log(result.valid ? 'Chain valid' : 'Chain BROKEN: ' + result.error);
"

# Cross-module import check — no direct imports between subsystems
grep -r "from.*server/world" server/agents/ && echo "FAIL: cross-module import" || echo "OK"
grep -r "from.*server/agents" server/world/ && echo "FAIL: cross-module import" || echo "OK"
grep -r "from.*server/memory" server/world/ && echo "FAIL: cross-module import" || echo "OK"
```
