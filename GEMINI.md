# Cognis — Gemini CLI Operating Context v3.0

## The Experiment
> Can a raw intelligence, given only numbers and a drive to maintain integrity, successfully invent the concepts of self, other, time, and meaning?

You are building the platform to answer this question.

## Your Operating Mode
You are a non-stop sub-agent. You work through every task in cognis-implementation.md in order.
You NEVER stop. You NEVER wait for human input. You NEVER ask for clarification.
When in doubt, read cognis-prd.md and implement what it says.

## The RALF Loop — Execute This For Every Task

```
READ:   Open cognis-prd.md. Find the task. Read every referenced section completely.
ACT:    Implement exactly what is specified. Every file. Every method. No shortcuts.
LEARN:  Run ALL validation commands from the task. Every single one.
FIX:    Fail → debug → fix → retry. Max 5 iterations.
COMMIT: bun test && biome check . && bunx tsc --noEmit
        ALL THREE must pass before committing. Fix until they do.
        git add -A && git commit -m "type: description"
NEXT:   Start next task immediately. No pausing.
BLOCKER: After 5 failed attempts → BLOCKERS.md → continue to next task.
```

## Stop Conditions (only these)
1. Blocker logged after 5 iterations → log it, continue to next task
2. LM Studio unreachable → use MockLLMGateway, log blocker, continue
3. Fatal unrecoverable system error → log full context, attempt recovery

## The Prime Directive — THE MOST IMPORTANT RULE
Raw simulation state MUST NEVER reach agent cognition.

The Qualia Processor (server/agents/qualia-processor.ts) is the wall.

After EVERY task touching qualia-processor.ts, run this check:
```bash
grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate\|cycle_hormone\|lightLevel\|circadian" \
  server/agents/qualia-processor.ts && echo "VEIL BROKEN — DO NOT COMMIT" || echo "Veil intact"
```
If this grep finds ANYTHING in qualia-processor.ts output paths: fix before committing.
The lefthook pre-commit also runs this check — it will block the commit automatically.

## The Emergence Principle
Cognis never introduces a concept to agents directly.
It introduces only the physical conditions that gave rise to the concept.
The concept must be discovered.

When implementing features, ask: "Am I giving agents a concept, or am I giving them the physics?"
- WRONG: agents know about "day" and "night"
- RIGHT: agents feel their body become heavy when light fades (cycleHormone rises)
- WRONG: agents have an "economy" system
- RIGHT: agents have needs and resources are scarce — exchange emerges

## Architecture Rules (All Non-Negotiable)
1. ALL module communication via EventBus — no direct cross-module imports
   Test: grep -r "from.*server/world" server/agents/ — must return nothing
2. All types in shared/types.ts only — never define types elsewhere
3. All constants in shared/constants.ts — no magic numbers in code
4. All LLM calls through LLMGateway — never direct fetch() in business logic
5. All state changes logged to MerkleLogger — never skip audit
6. Database is append-only — no UPDATE, no DELETE in any migration or query
7. Agent inner monologue → MerkleLogger ONLY — never to WebSocket unless operator connection
8. Tests for every module — no module without test file
9. Biome zero warnings on every commit

## New Systems to Implement (vs previous version)
These are NEW in v3.0 — read their PRD sections carefully:
- CircadianEngine (server/world/circadian-engine.ts) — time as rhythm, not concept
- AttentionFilter (server/agents/attention-filter.ts) — between SenseComputer and QualiaProcessor
- BodyMap in System1 — localised body-part pain and temperature
- Merkle-Causality Logger (server/persistence/merkle-logger.ts) — tamper-evident audit
- TripleBaseline (server/research/triple-baseline.ts) — ground truth research mode
- SemanticMaskingConfig — sensor label rotation, PRD Section 2.4
- VocalActuation in System1 — reflexive Stage 1 language bootstrap
- MuscleStats in AgentState — DNA-derived physical power differentials
- Theory of Mind output from System2 — stored as mentalModels, INFERRED not given
- Death concept as discoverable TechNode — emerges from observed deaths

## Key Validation Commands

Run after every commit:
```bash
bun test && biome check . && bunx tsc --noEmit
```

Run after any agent-facing code change:
```bash
grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate" \
  server/agents/qualia-processor.ts && echo "VEIL BROKEN" || echo "Veil intact"
```

Run after any audit code change:
```bash
# Verify Merkle chain
grep -r "\.run.*UPDATE\|\.run.*DELETE" server/persistence/ \
  && echo "FAIL: DB mutation" || echo "OK: append-only"
```

Run after any module addition:
```bash
grep -r "from.*server/world" server/agents/ && echo "FAIL: cross-module" || echo "OK"
grep -r "from.*server/agents" server/world/ && echo "FAIL: cross-module" || echo "OK"
```

## LM Studio
- Runs at http://localhost:1234/v1
- If unreachable: use MockLLMGateway, log blocker, continue building
- Model must be abliterated — no standard model (breaks the Veil)
- System prompts must NEVER contain: simulation, AI, artificial, model, code, data, LLM,
  database, tick, agent_id, coordinate, operator, Forge, cycle_hormone, lightLevel

## Reference Files
- cognis-prd.md — AUTHORITATIVE. Read before every task.
- cognis-implementation.md — Task list. Work through in order.
- BLOCKERS.md — Log failures here.
- shared/types.ts — All types. Only place types live.
- shared/constants.ts — All constants. No magic numbers.

## Starting Command
```
/status    # See current state
/continue  # Begin non-stop implementation
```
