# Testing Cognis

## Prerequisites

- [Bun](https://bun.sh/) runtime (v1.3+)
- Install dependencies: `bun install`

## Quick Start

```bash
# Run all three validation checks (must all pass before committing)
bun test && bunx biome check . && bunx tsc --noEmit
```

## Running Tests

```bash
# Run all tests
bun test

# Run a specific test file
bun test tests/system1.test.ts

# Run tests matching a pattern
bun test --grep "qualia"

# Run tests with verbose output
bun test --verbose
```

## Linting

```bash
# Check for lint errors
bunx biome check .

# Auto-fix lint errors
bunx biome check --write .
```

## Type Checking

```bash
# Check TypeScript types (no output on success)
bunx tsc --noEmit
```

## Architectural Validation

These checks enforce the project's non-negotiable architecture rules. They also run automatically via lefthook pre-commit hooks.

### Veil Integrity Check

Raw simulation state must **never** reach agent cognition. This checks that `qualia-processor.ts` doesn't leak forbidden terms into agent-facing output:

```bash
grep -r "simulation\|\" AI\|' AI\|agent_id\|coordinate\|Forge\|operator" \
  server/agents/qualia-processor.ts \
  | grep -v "^.*\/\/" | grep -v "import " | grep -v "type " \
  && echo "VEIL BROKEN" || echo "Veil intact"
```

### Append-Only Database Check

No `UPDATE` or `DELETE` statements are allowed in persistence or memory modules:

```bash
grep -rn "'UPDATE\|\"UPDATE\|'DELETE\|\"DELETE" \
  server/persistence/ server/memory/ --include="*.ts" \
  | grep -v "node_modules" | grep -v "\.test\." | grep -v "^.*\/\/" \
  && echo "FAIL: DB mutation found" || echo "OK: append-only"
```

### Module Isolation Check

Agents and world modules must not directly import from each other — all communication goes through EventBus:

```bash
grep -r "from.*server/world" server/agents/ && echo "FAIL" || echo "OK"
grep -r "from.*server/agents" server/world/ && echo "FAIL" || echo "OK"
```

### Merkle Chain Verification

Verify the integrity of the audit log chain (requires a running simulation with data):

```bash
# Via WebSocket: send { "type": "VERIFY_CHAIN", "branchId": "main" }
# Returns: { "valid": true } or { "valid": false, "error": "..." }
```

## Running the Simulation

```bash
# Start the simulation server (default config)
bun run index.ts

# Start with a custom world config
WORLD_CONFIG=./data/world-configs/earth-default.json bun run index.ts
```

The simulation starts a WebSocket server on port 3001. Connect to receive real-time events.

## Test Coverage by Module

| Module | Test File | Tests |
|---|---|---|
| System1 (homeostasis) | `system1.test.ts` | 3 |
| System1 (reflexes) | `system1-reactions.test.ts` | 7 |
| System2 (reasoning) | `system2.test.ts` | — |
| QualiaProcessor | `qualia-processor.test.ts` | 7 |
| AttentionFilter | `attention-filter.test.ts` | — |
| EmotionalField | `emotional-field.test.ts` | 4 |
| FeelingResidue | `feeling-residue.test.ts` | 5 |
| SenseComputer | `sense-computer.test.ts` | — |
| EpisodicStore | `episodic-store.test.ts` | 3 |
| SalienceGate | `episodic-store.test.ts` | 1 |
| DecayEngine | `decay-engine.test.ts` | 3 |
| Consolidation | `memory-consolidation.test.ts` | — |
| MerkleLogger | `merkle-logger.test.ts` | — |
| EventBus | `event-bus.test.ts` | — |
| SimClock | `sim-clock.test.ts` | — |
| CircadianEngine | `circadian-engine.test.ts` | — |
| ElementEngine | `element-engine.test.ts` | — |
| VoxelGrid | `voxel-grid.test.ts` | — |
| TechTree | `tech-tree.test.ts` | — |
| LanguageEmergence | `language-emergence.test.ts` | 6 |
| DialectTracker | `dialect.test.ts` | 4 |
| GrammarEngine | `grammar.test.ts` | 2 |
| BehaviorTree | `behavior-tree.test.ts` | 4 |
| DomesticationManager | `domestication.test.ts` | 2 |
| BaselineComparator | `baseline-comparator.test.ts` | 6 |
| Reproduction | `reproduction.test.ts` | — |
| WillEngine | `will-engine.test.ts` | — |
| DreamEngine | `dream-engine.test.ts` | — |
| LLMGateway | `llm-gateway.test.ts` | — |
| Integration | `integration.test.ts` | — |
| Full Integration | `integration-full.test.ts` | — |
