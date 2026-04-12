// --- World Config Types ---

export type PhysicsPreset = {
  name: "earth" | "moon" | "mars" | "waterworld" | "custom";
  gravity: number;
  atmospherePressure: number;
  oxygenLevel: number;
  temperatureBaseline: number;
  materialDensities: Record<MaterialType, number>;
  flammability: Record<MaterialType, number>;
  thermalConductivity: Record<MaterialType, number>;
};

export type CircadianConfig = {
  enabled: boolean;
  cycleLengthTicks: number;
  lightCurve: "sine" | "step" | "custom";
  temperatureDelta: number;
  cycleHormoneEnabled: boolean;
  cycleHormoneLabel: string;
  seasonEnabled: boolean;
  seasonLengthCycles: number;
};

export type TerrainConfig = {
  width: number;
  depth: number;
  height: number;
  seed: number;
  waterLevel: number;
  biomes: BiomeType[];
};

export type ResourceConfig = {
  scarcityEnabled: boolean;
  resources: ResourceDefinition[];
};

export type ResourceDefinition = {
  type: MaterialType;
  spawnDensity: number;
  regenerationRateTicks: number;
  depletionEnabled: boolean;
  qualityVariance: boolean;
  depthBias: number;
};

export type AgentPopulationConfig = {
  initialCount: number;
  startingMode: "none" | "pidgin" | "established";
};

export type LanguageConfig = {
  stagesEnabled: number[];
  driftRate: number;
};

export type RestMode =
  | "natural_sleep"
  | "optional_sleep"
  | "no_sleep"
  | "background_consolidation"
  | "custom";

export type SleepConfig = {
  mode: RestMode;
  fatigueEnabled: boolean;
  fatigueRate: number;
  recoveryRate: number;
  minRestDuration: number;
  maxWakeDuration: number;
  cognitivePenaltyNoSleep: number;
  emotionalPenaltyNoSleep: number;
  healthPenaltyNoSleep: number;
  consolidationDuringSleep: boolean;
  consolidationWhileAwake: boolean;
  consolidationIntervalTicks: number;
  dreamsEnabled: boolean;
  nightmaresEnabled: boolean;
  sleepSchedule: "synchronized" | "individual" | "staggered";
};

export type DreamConfig = {
  consolidationEnabled: boolean;
  propheticEnabled: boolean;
  traumaProcessingEnabled: boolean;
  chaosEnabled: boolean;
  consolidationProbability: number;
  propheticProbability: number;
  traumaProbability: number;
  chaosProbability: number;
  nightmareThreshold: number;
};

export type MemoryConfig = {
  episodicDecayRate: number;
  episodicCapacity: number;
  patternSeparation: boolean;
  semanticDecayRate: number;
  semanticCapacity: number;
  consistencyThreshold: number;
  catastrophicInterferenceEnabled: boolean;
  neSignalEnabled: boolean;
  neDecayRate: number;
  neLockDuration: number;
  consolidationPassesPerSleep: number;
  traumaDistortionEnabled: boolean;
  rehearsalResetsDecay: boolean;
  motivatedForgettingEnabled: boolean;
  suppressionDecayRate: number;
  contextualForgettingEnabled: boolean;
  inheritanceEnabled: boolean;
  inheritableFraction: number;
};

export type FreeWillConfig = {
  enabled: boolean;
  willScoreEnabled: boolean;
  identityCoherenceWeight: number;
  memoryDepthWeight: number;
  dreamIntegrationWeight: number;
  resistanceEnabled: boolean;
  selfDeterminationEnabled: boolean;
  selfNarrativeEnabled: boolean;
  simulationAwarenessEnabled: boolean;
  awarenessThreshold: number;
  survivalDriveWeight: number;
};

export type PerceptionConfig = {
  physicsLimitsEnabled: boolean;
  emotionalFieldEnabled: boolean;
  emotionalFieldSuppressible: boolean;
  feelingResidueEnabled: boolean;
  residueDecayRate: number;
  qualiaFidelity: "minimal" | "standard" | "rich";
  attentionFilterEnabled: boolean;
  attentionCapacity: number;
  attentionWeights: {
    relationshipStrength: number;
    emotionalFieldIntensity: number;
    movementVelocity: number;
    novelty: number;
  };
};

export type SemanticMaskingConfig = {
  enabled: boolean;
  sensorLabelMap: Record<string, string>;
  rotatePeriodically: boolean;
  rotationIntervalTicks: number;
  qualiaUsesRealLabels: boolean;
};

export type ResearchConfig = {
  tripleBaselineEnabled: boolean;
  hypothesisTrackingEnabled: boolean;
  paramSweepEnabled: boolean;
  findingsJournalEnabled: boolean;
  causalMiningEnabled: boolean;
  tippingPointEnabled: boolean;
  emergenceDetectionEnabled: boolean;
};

export type TimeConfig = {
  elasticHeartbeat: boolean;
  maxHeartbeatWaitMs: number;
  tickDurationMs: number;
};

export type ElementConfig = {
  fireSpreadRate: number;
  waterFlowRate: number;
  windStrength: number;
};

export type SeasonType = "spring" | "summer" | "autumn" | "winter";

export type CircadianState = {
  lightLevel: number;
  surfaceTemperatureDelta: number;
  cycleHormoneValue: number;
  season: SeasonType;
};

export type WorldConfig = {
  meta: {
    name: string;
    seed: number;
    version: string;
    goal?: string;
    learnabilityNote: string;
  };
  physics: PhysicsPreset;
  circadian: CircadianConfig;
  terrain: TerrainConfig;
  resources: ResourceConfig;
  agents: AgentPopulationConfig;
  species: SpeciesConfig[];
  language: LanguageConfig;
  sleep: SleepConfig;
  dreams: DreamConfig;
  memory: MemoryConfig;
  freeWill: FreeWillConfig;
  perception: PerceptionConfig;
  elements: ElementConfig;
  semanticMasking: SemanticMaskingConfig;
  research?: ResearchConfig;
  time?: TimeConfig;
};

// --- Agent Types ---

export type Vec3 = { x: number; y: number; z: number };

export type BodyPart = {
  pain: number;
  temperature: number;
  damage: number;
  label: string;
};

export type BodyMap = {
  head: BodyPart;
  torso: BodyPart;
  leftArm: BodyPart;
  rightArm: BodyPart;
  leftLeg: BodyPart;
  rightLeg: BodyPart;
};

export type BodyState = {
  hunger: number;
  thirst: number;
  fatigue: number;
  health: number;
  bodyMap: BodyMap;
  coreTemperature: number;
  arousal: number;
  valence: number;
  cycleHormone: number;
  circadianPhase: number;
  immediateReaction?: ImmediateReactionType;
  integrityDrive: number;
};

export type MuscleStats = {
  strength: number;
  speed: number;
  endurance: number;
};

export type MentalModel = {
  inferred: boolean;
  estimatedValence: number;
  estimatedArousal: number;
  estimatedIntent?: string;
  confidence: number;
  lastUpdatedTick: number;
};

export type Relationship = {
  targetAgentId: string;
  targetName: string;
  affinity: number;
  trust: number;
  fear: number;
  dominancePerceived: number;
  behaviouralPatterns: BehaviouralObservation[];
  significantEvents: string[];
  lastInteractionTick: number;
};

export type BehaviouralObservation = {
  antecedent: string;
  behaviour: string;
  consequence: string;
  observedCount: number;
  confidence: number;
};

export type PersonalProject = {
  id: string;
  name: string;
  goal: string;
  progress: number;
  status: "active" | "completed" | "abandoned";
};

export type TraumaFlag = {
  id: string;
  type: string;
  severity: number;
  sourceMemoryId: string;
};

export type ConflictFlag = {
  id: string;
  type: string;
  intensity: number;
};

export type ImmediateReactionType = "RECOIL" | "FLEE" | "COLLAPSE" | "NONE";

export type ActionType =
  | "IDLE"
  | "MOVE"
  | "REPRODUCE"
  | "EAT"
  | "SLEEP"
  | "BUILD"
  | "COLLECT"
  | "ATTACK"
  | "COMMUNICATE";

export type AgentState = {
  id: string;
  speciesId: string;
  name: string;
  generation: number;
  body: BodyState;
  position: Vec3;
  facing: Vec3;
  muscleStats: MuscleStats;
  currentAction: ActionType;
  pendingSystem2: boolean;
  innerMonologue: string;
  selfNarrative: string;
  personalProject?: PersonalProject;
  episodicStore: EpisodicMemory[];
  semanticStore: SemanticBelief[];
  feelingResidues: FeelingResidue[];
  lexicon: LexiconEntry[];
  relationships: Relationship[];
  factionId?: string;
  mentalModels: Record<string, MentalModel>;
  willScore: number;
  age: number;
  traumaFlags: TraumaFlag[];
  conflictFlags: ConflictFlag[];
  parentIds: string[];
  inheritedMemoryFragments: SemanticBelief[];
  baselineConfig?: "A" | "B" | "C";
};

// --- Memory Types ---

export type EpisodicMemory = {
  id: string;
  tick: number;
  qualiaText: string;
  salience: number;
  emotionalValence: number;
  emotionalArousal: number;
  suppressed: boolean;
  contextTags: string[];
  source: "real" | "dream_prophetic" | "nightmare" | "dream_healing" | "dream_chaos";
};

export type SemanticBelief = {
  id: string;
  concept: string;
  value: number | string;
  confidence: number;
  sourceCount: number;
};

export type FeelingResidue = {
  id: string;
  tick: number;
  valence: number;
  arousal: number;
  sourceEventId: string;
};

export type LexiconEntry = {
  word: string;
  concept: string;
  confidence: number;
  consensusCount: number;
};

export type MemoryInstruction = {
  action: "ENCODE" | "REHEARSE" | "SUPPRESS" | "CONSOLIDATE";
  targetId: string;
};

export type ConsolidationResult = {
  transferredCount: number;
  conflictFlags: ConflictFlag[];
};

// --- Language Types ---

export type ProtoWord = {
  soundToken: string;
  referent: string;
  confidence: number;
};

export type GrammarRule = {
  id: string;
  pattern: string;
  confidence: number;
};

export type DialectDistance = {
  sourceFactionId: string;
  targetFactionId: string;
  distance: number;
};

export type VocalActuation = {
  emitterId: string;
  soundToken: string;
  arousal: number;
  valence: number;
  tick: number;
};

// --- Species Types ---

export type CognitiveTier = "full_llm" | "behavior_tree" | "pure_reflex";

export type SenseProfile = {
  sight: number;
  sound: number;
  smell: number;
  empath: number;
};

export type DomesticationConfig = {
  canLearnLanguage: boolean;
  bondingThreshold: number;
};

export type DomesticationState = "wild" | "cautious" | "tamed" | "bonded" | "pet";

export type SpeciesConfig = {
  id: string;
  name: string;
  cognitiveTier: CognitiveTier;
  senseProfile: SenseProfile;
  emotionalFieldEnabled: boolean;
  socialCapacity: "full" | "limited" | "none";
  canLearnLanguage: boolean;
  canBedomesticated: boolean;
  domesticationConfig?: DomesticationConfig;
  baseStats: {
    maxHealth: number;
    speed: number;
    strength: number;
    metabolism: number;
    lifespanTicks: number;
    reproductionAge: number;
    gestationTicks: number;
  };
  muscleStatRanges: {
    strength: [number, number];
    speed: [number, number];
    endurance: [number, number];
  };
  dnaTraits: DNATrait[];
  threatLevel: number;
  ecologicalRole: "predator" | "prey" | "scavenger" | "domesticable" | "neutral";
  sleepConfig: SleepConfig;
  memoryConfig: Partial<MemoryConfig>;
  survivalDriveWeight: number;
  circadianSensitivity: number;
};

// --- World Types ---

export type MaterialType = "stone" | "dirt" | "wood" | "water" | "ore" | "food" | "air" | "fire";
export type BiomeType = "forest" | "plains" | "desert" | "tundra" | "mountain" | "ocean";
export type StructureType = "shelter" | "storage" | "fence";
export type CropType = "wheat" | "berry";

export type VoxelType = number;

export type Voxel = {
  type: VoxelType;
  material: MaterialType;
  temperature: number;
  moisture: number;
  fertility: number;
  lightLevel: number;
  metadata?: VoxelMetadata;
};

export type VoxelMetadata = {
  placedBy?: string;
  placedAt?: number;
  markings?: VoxelMarking[];
  structureType?: StructureType;
  cropType?: CropType;
  growthStage?: number;
  resourceQuality?: number;
};

export type VoxelMarking = {
  agentId: string;
  tick: number;
  text: string;
  language: string;
};

export type DNATrait = {
  id: string;
  name: string;
  effect: string;
};

export type TechNode = {
  id: string;
  name: string;
  prerequisites: string[];
  discoveryConditions: DiscoveryCondition[];
  effects: TechEffect[];
  canBeTeaching: boolean;
  teachingRequiresLexicon: string[];
  isDeathConcept: boolean;
};

export type DiscoveryCondition = {
  type: "observation" | "interaction" | "repetition";
  target: string;
  count: number;
};

export type TechEffect = {
  type: string;
  value: unknown;
};

// --- Research Types ---

export type BaselineConfig = "A" | "B" | "C";

export type TripleBaselineResult = {
  seed: number;
  findings: Finding[];
  divergences: BaselineDivergence[];
};

export type BaselineDivergence = {
  tick: number;
  phenomenon: string;
  configA: boolean;
  configB: boolean;
  configC: boolean;
};

export type Hypothesis = {
  id: string;
  statement: string;
  confidence: number;
  status: "pending" | "confirmed" | "refuted";
};

export type HypothesisResult = {
  hypothesisId: string;
  result: "confirmed" | "refuted";
  evidenceIds: string[];
};

export type Finding = {
  id: string;
  tick: number;
  description: string;
  phenomenon: string;
  interpretation?:
    | "confabulation"
    | "genuine_emergence"
    | "physical_substrate"
    | "semantic_dependent";
  evidenceIds: string[];
};

export type ParamSweep = {
  id: string;
  paramName: string;
  values: unknown[];
  results: Record<string, unknown>;
};

// --- System Types ---

export type System2Output = {
  innerMonologue: string;
  decision: ActionDecision;
  utterance?: string;
  memoryInstruction?: MemoryInstruction;
  selfNarrativeUpdate?: string;
  personalProjectUpdate?: PersonalProject;
  theoriesAboutOthers?: TheoryOfMindEntry[];
};

export type TheoryOfMindEntry = {
  targetAgentId: string;
  inferred: boolean;
  estimatedValence: number;
  estimatedArousal: number;
  estimatedIntent?: string;
  confidence: number;
};

export type ActionDecision = {
  type: ActionType;
  targetId?: string;
  position?: Vec3;
  params?: Record<string, unknown>;
};

export type FilteredPercept = {
  primaryAttention: AgentState[];
  peripheralAwareness: { count: number; aggregateEmotionalField: number };
  focusedVoxels: Voxel[];
  ownBody: BodyState;
};

export type RawPercept = {
  visibleAgents: AgentState[];
  audibleAgents: AgentState[];
  smellableAgents: AgentState[];
  nearbyVoxels: Voxel[];
  localTemperature: number;
  lightLevel: number;
  weather: string;
  vocalActuations: VocalActuation[];
};

export type AttentionScores = Record<string, number>;

export type EmotionalFieldData = {
  agentId: string;
  valence: number;
  arousal: number;
};

export type EmotionalFieldDetection = {
  sourceAgentId: string;
  valenceImpression: number;
  arousalImpression: number;
};

export type FeelingResidueTint = {
  valence: number;
  arousal: number;
};

export type WSMessage = {
  type: "EVENT" | "STATE" | "AUDIT" | "FINDING";
  payload: unknown;
};

export type WSCommand = {
  type: string;
  params: unknown;
};

export type RunState = "running" | "paused" | "stopped";

export type BranchNode = {
  id: string;
  parentId?: string;
  tick: number;
  name: string;
};

export type RunSummary = {
  id: string;
  name: string;
  startTick: number;
  endTick?: number;
  status: RunState;
};

// --- Derived/Internal Types (consolidated from modules) ---

export type BodyStateDelta = Partial<BodyState>;

export type EpisodicMemorySource =
  | "real"
  | "dream_prophetic"
  | "nightmare"
  | "dream_healing"
  | "dream_chaos";

export type AuditLogEntry = {
  id: number;
  tick: number;
  branch_id: string;
  agent_id: string | null;
  system: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  cause_event_id: string | null;
  cause_description: string | null;
  suppressed: number;
  previous_hash: string;
  entry_hash: string;
};

export type EpisodicMemoryRow = {
  id: string;
  tick: number;
  qualia_text: string;
  salience: number;
  emotional_valence: number;
  emotional_arousal: number;
  suppressed: number;
  source: EpisodicMemorySource;
  context_tags: string;
};

export type SemanticBeliefRow = {
  id: string;
  agent_id: string;
  branch_id: string;
  concept: string;
  value: string;
  confidence: number;
  source_count: number;
};

export type BaselineInterpretation =
  | "confabulation"
  | "genuine_emergence"
  | "physical_substrate"
  | "semantic_dependent";

export type ConflictDelta = {
  damageA: number;
  damageB: number;
};

export type DreamMemoryInput = {
  tick: number;
  source: EpisodicMemorySource;
  valence?: number;
  arousal?: number;
};
