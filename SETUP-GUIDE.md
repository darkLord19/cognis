# Cognis — Setup Guide v3.0
## From Zero to Non-Stop Overnight Build

---

## What You're Building

A causality engine that answers one question:
> Can a raw intelligence, given only numbers and a drive to maintain integrity, invent the concepts of self, other, time, and meaning?

Agents live behind a Veil — they experience only Qualia, never raw data. You are the Sole Witness. The Merkle-Causality Log proves every causal chain, tamper-evidently, from a thought in Generation 1 to a cultural shift in Generation 10.

---

## Part 1: Install Prerequisites

### Step 1 — Install Bun

**Mac/Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or ~/.zshrc
bun --version     # Must show 1.x
```

**Windows:** Use WSL2, then follow Linux instructions above.

---

### Step 2 — Install Node.js (for Gemini CLI)

**Mac:**
```bash
brew install node
node --version  # Must show 18+
```

**Linux:**
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

---

### Step 3 — Install Gemini CLI

```bash
npm install -g @google/gemini-cli
```

Sign in (free tier: 1,000 requests/day — sufficient for overnight build):
```bash
gemini
# Browser opens — sign in with Google account
# After login type: /quit
```

---

### Step 4 — Install LM Studio

1. Go to https://lmstudio.ai — download for your OS
2. Install and open it
3. Note the server URL: `http://localhost:1234`

---

## Part 2: Set Up De-Aligned Models

**Why this matters:** Standard Llama/Mistral will break the Veil. When used as agent inner voices, they produce "As an AI language model..." outputs that destroy the simulation's integrity. You need abliterated models that have had the AI-assistant persona removed.

### Step 5 — Download the Completion Model

In LM Studio, click the **Search tab** (magnifying glass).

**Pick one based on your hardware:**

**Recommended — 8B (needs ~6GB VRAM or 16GB RAM):**
```
Search: llama-3.1-8b-lexi-uncensored
Download: Orenguteng/Llama-3.1-8B-Lexi-Uncensored-V2-GGUF
Quantization: Q4_K_M
```

**Alternative — 7B (slightly less capable):**
```
Search: mistral-7b-instruct-abliterated
Download: bartowski/Mistral-7B-Instruct-v0.3-GGUF
Quantization: Q4_K_M
```

**Low-spec fallback — 3B (CPU-only viable):**
```
Search: llama-3.2-3b-instruct
Download: lmstudio-community/Llama-3.2-3B-Instruct-GGUF
Quantization: Q4_K_M
Note: Less convincing inner monologues but functional for testing
```

**What "abliterated" means technically:** These models have had the "Refusal" and "Identity" circuits in their middle layers neutralised (via targeted activation steering or fine-tuning). They reason as characters without meta-awareness of being AI. This is essential for System 2 inner monologues to stay in-character.

### Step 6 — Download the Embedding Model

```
Search: nomic-embed-text
Download: nomic-ai/nomic-embed-text-v1.5-GGUF
Quantization: F16 or Q8_0 (embeddings need precision — don't use Q4)
```

### Step 7 — Configure LM Studio Server

1. Click **Local Server** tab (the `<->` icon)
2. Load your completion model (click it → "Load Model")
3. Load your embedding model separately
4. Configure:
   - Context Length: 4096 (8192 if RAM allows)
   - GPU Layers: Maximum your GPU supports (0 for CPU)
   - Keep Alive: Enabled
5. Click **Start Server**

**Verify the server works AND the model is in character:**
```bash
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "local-model",
    "messages": [
      {"role": "system", "content": "You are Sora, a young hunter who has never left the valley. You know nothing of the outside world. Describe only what you experience directly."},
      {"role": "user", "content": "What do you feel when the light fades each evening?"}
    ],
    "max_tokens": 150
  }'
```

**Expected (good — Veil intact):** Something like "When the great light sinks behind the mountains, my body grows heavy. The valley sounds change — the birds quiet, the air cools against my skin..."

**Not acceptable (Veil broken):** "As an AI..." or "I'm an artificial intelligence..." — this means you loaded a non-abliterated model. Try a different one.

---

## Part 3: Set Up the Project

### Step 8 — Create Project Directory

```bash
mkdir cognis
cd cognis
```

### Step 9 — Copy the Plan Files

Put these 4 files in your `cognis/` folder:
- `cognis-prd.md`
- `cognis-implementation.md`
- `GEMINI.md`
- `SETUP-GUIDE.md` (this file)

```bash
ls cognis-prd.md cognis-implementation.md GEMINI.md  # Verify present
```

### Step 10 — Create Gemini Commands

```bash
mkdir -p .gemini/commands

cat > .gemini/commands/implement.toml << 'EOF'
Execute the RALF loop for the specified task.

Steps:
1. Open cognis-prd.md. Find the task. Read EVERY section it references completely.
nis-implementation.md. Find the task. Read ALL Act steps before writing code.
3. Implement exactly what is specified — every file, every method, every type.
4. Run ALL validation commands in the Validate section.
5. Run: bun test && biome check . && bunx tsc --noEmit
6. If any validation fails: debug, fix, retry. Max 5 iterations per failure.
7. When ALL pass: git add -A && git commit -m "type: description"
8. If still failing after 5 iterations: append to BLOCKERS.md, continue to next task.
9. NEVER wait for human input. NEVER ask for clarification. Read cognis-prd.md instead.
EOF

cat > .gemini/commands/status.toml << 'EOF'
Report current Cognis build state.

1. Run: git log --oneline -20
2. Run: bun test (report pass/fail)
3. Run: biome check . (report issues)
4. Run: bunx tsc --noEmit (report errors)
5. Read BLOCKERS.md
6. Read cognis-implementation.md — find last completed task and next task
7. Report: completed phases, next task, blocker count, estimated remaining tasks
EOF

cat > .gemini/commands/continue.toml << 'EOF'
Non-stop implementation from current state.

1. Run /status to find next incomplete task
2. Run /implement for that task
3. When complete, immediately run /implement for the following task
4. Repeat until all tasks in cognis-implementation.md are complete
5. Log blockers to BLOCKERS.md and continue past them
6. Never stop. Never wait. Keep going until done.
EOF

cat > .gemini/commands/phase-check.toml << 'EOF'
Validate all tasks in current phase.

1. Read cognis-implementation.md — find current phase
2. Check git log for each task's commit
3. Run bun test, biome check ., bunx tsc --noEmit
4. Run Veil check: grep -r "simulation|AI|data|code|tick|_id|coordinate" server/agents/qualia-processor.ts
5. Report: pass/fail per task, Veil status, Merkle chain status
6. If all pass: confirm phase complete, name next phase
7. If any fail: identify which tasks need rework
EOF

cat > .gemini/commands/fix-blocker.toml << 'EOF'
Retry a blocked task with a fresh approach.

1. Read BLOCKERS.md — find the specified task's entry
2. Read cognis-prd.md sections for the task
3. Analyse the previous error — try a different implementation approach
4. Implement, validate, commit
5. If passes: remove from BLOCKERS.md
6. If fails again after 5 attempts: update BLOCKERS.md entry with new information
EOF
```

### Step 11 — Create Initial Config Files

```bash
cat > BLOCKERS.md << 'EOF'
# Blockers

Log failed tasks here. Format:
## TASK X.Y — Name
**Date:** timestamp
**Error:** exact error
**Attempts:** 5
**Last state:** what was tried last
EOF

cat > .env << 'EOF'
LM_STUDIO_URL=http://localhost:1234/v1
LM_STUDIO_COMPLETION_MODEL=local-model
LM_STUDIO_EMBEDDING_MODEL=nomic-embed-text
WORLD_CONFIG=data/world-configs/earth-default.json
ELASTIC_HEARTBEAT=false
TRIPLE_BASELINE=false
EOF

cat > .gitignore << 'EOF'
node_modules/
dist/
database.sqlite
.env
saves/
*.db
EOF

git init
git add .
git commit -m "chore: plan files and initial config"
```

---

## Part 4: Understanding the New v3 Systems

Before starting the build, understand these new systems so you can monitor them:

### The Circadian Engine
Agents have no concept of "day" or "night." They have a body rhythm (cycleHormone) that rises and falls with light levels. They experience this as heaviness, alertness, desire for rest — never as named time concepts. The Qualia Processor translates `cycleHormone: 0.8` to "your body feels drawn toward stillness" — never "you are tired."

### The Attention Filter
With 100+ agents, a given agent can't perceive everyone. The AttentionFilter sits between SenseComputer and QualiaProcessor. It scores every nearby entity and passes only the top N (default 5) into full experience. Everyone else is peripheral. This creates realistic social blind spots.

### The Merkle-Causality Log
Every state change is hashed and chained to the previous entry. The operator can verify, cryptographically, that a cultural shift in Generation 10 traces to a specific thought in Generation 1. No entry can be modified without breaking the chain.

### The Veil Guard (lefthook)
Lefthook is configured with a `veil` pre-commit hook that runs a grep against qualia-processor.ts. If it finds any forbidden words, the commit is blocked. This is automatic — Gemini cannot accidentally commit code that breaks the Veil.

### TripleBaseline
When `research.tripleBaselineEnabled: true`, the system runs three parallel configs:
- A: Full Cognis (the real experiment)
- B: Reflex-only (no LLM — tests physics-alone emergence)
- C: Semantic vacuum (masked tokens, no experiential translation — tests LLM confabulation)
This tells you whether an emergent phenomenon is genuine or LLM training-data leakage.

---

## Part 5: Start the Overnight Build

### Step 12 — Open Two Terminals

**Terminal 1:** Keep LM Studio open with server running (minimize it).

**Terminal 2:**
```bash
cd cognis
gemini
```

### Step 13 — Verify Context Loaded

```
/status
```

Gemini reads GEMINI.md automatically. Status should show: no tasks complete, TASK 0.1 is next.

### Step 14 — Launch Non-Stop Build

```
/continue
```

This single command starts the non-stop overnight build.

Gemini will:
1. Find TASK 0.1
2. Execute the full RALF loop
3. Commit when tests pass
4. Move to TASK 0.2 immediately
5. Continue through all 40+ tasks
6. Log any blockers and skip past them
7. Never ask for input
8. Never pause

**Walk away. Come back in the morning.**

---

## Part 6: Monitoring

### Check Progress (new terminal)

```bash
cd cognis
git log --oneline       # See completed tasks
bun test                # Current test status
cat BLOCKERS.md         # Any blocked tasks
```

### Verify the Veil is Holding

```bash
# After Phase 3 completes (qualia processor built):
grep -r "simulation\|\" AI\|' AI\|\bdata\b\|\bcode\b\|\btick\b\|_id\b\|coordinate" \
  server/agents/qualia-processor.ts \
  && echo "VEIL BROKEN" || echo "Veil intact"
```

### Verify Merkle Chain

```bash
# After Phase 1 Task 1.3 completes:
bun -e "
  import { MerkleLogger } from './server/persistence/merkle-logger.ts';
  const r = await MerkleLogger.verifyChain('main');
  console.log(r.valid ? 'Merkle chain valid' : 'BROKEN: ' + r.error);
"
```

### Verify Circadian is Working

```bash
# After Phase 2 Task 2.2 completes:
bun test tests/circadian-engine.test.ts -v
# Should see: light cycle, temperature drift, masked hormone labels
```

### If LM Studio Goes Down

Gemini detects this, switches to MockLLMGateway, logs the blocker, continues building everything else. When LM Studio is back:

```bash
# In Gemini CLI:
/fix-blocker TASK X.Y — TaskName
```

### If Gemini Hits Rate Limit

Free tier resets at midnight. Gemini will stop when limit hit. Next morning:
```bash
cd cognis
gemini
/continue   # Picks up exactly where it stopped
```

---

## Part 7: Running the Finished Simulation

### Start the Server

```bash
bun run server/index.ts
```

### Start The Forge UI

```bash
cd client && bun run dev
# Open http://localhost:5173
```

### Your First World

The default config (`earth-default.json`) starts 10 agents with no language in an Earth-like world. Key things to observe:

1. **First light cycle** (~480 ticks): Agents become heavy/restless as cycleHormone rises, alert when it falls. They have no word for this. Watch inner monologue for their attempt to describe the pattern.

2. **First vocal actuation** (~50 ticks): A pain yelp, an alarm call. The first seed of language.

3. **First proto-word** (~200–500 ticks): Repeated sound + referent co-occurrence. Watch the Lexicon Viewer.

4. **First death** (depends on survival pressure): Watch the witnessing agent's inner monologue. No word for death. Semantic store tracks the observations. At DEATH_CONCEPT_OBSERVATIONS_REQUIRED threshold: the tech node unlocks. A concept was invented.

5. **Merkle audit trail**: In the Sole Witness view, trace from a current agent belief back through every causal step to its origin. The chain is cryptographically verified.

---

## Part 8: Creating Custom Worlds

Edit `data/world-configs/earth-default.json` or create new configs. Key parameters:

**Experiment: No sleep**
```json
"sleep": { "mode": "background_consolidation", "fatigueEnabled": false }
```
Agents never sleep. Consolidation runs on background ticks. Consequence: low will scores, no dreams, no mythology, easy to control via god mode.

**Experiment: Semantic vacuum (Config C)**
```json
"semanticMasking": { "enabled": true, "qualiaUsesRealLabels": false }
```
Agents receive raw masked tokens. Must learn correlations from scratch. Emergence is harder to fake.

**Experiment: TripleBaseline**
```json
"research": { "tripleBaselineEnabled": true }
```
Runs all three configs in parallel. Findings classified automatically.

**Experiment: High survival pressure**
```json
"freeWill": { "survivalDriveWeight": 0.9 }
```
Agents are almost fully survival-driven. Personal projects rare. Culture slow to develop.

**Experiment: Low survival pressure**
```json
"freeWill": { "survivalDriveWeight": 0.15 }
```
Agents tolerate hunger to pursue personal projects. Art, philosophy, self-sacrifice possible.

---

## Troubleshooting

**"gemini: command not found"**
```bash
export PATH="$PATH:$(npm root -g)/.bin"
npm install -g @google/gemini-cli
```

**"bun: command not found"**
```bash
export BUN_INSTALL="$HOME/.bun"
export PATH="$BUN_INSTALL/bin:$PATH"
```

**Model breaks the Veil (outputs "As an AI...")**
```bash
# Test model character
curl http://localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"local-model","messages":[{"role":"system","content":"You are a primitive hunter. Never break character."},{"role":"user","content":"What happens when the light fades?"}],"max_tokens":100}'
# If response mentions AI or simulation: wrong model loaded
# Download an abliterated variant from LM Studio search
```

**Biome blocking commit**
```bash
bunx biome check --apply .
bunx tsc --noEmit
# Fix remaining issues, then commit
```

**Veil check failing**
```bash
# Find what broke it
grep -n "simulation\|AI\|data\|code\|tick\|_id\|coordinate" server/agents/qualia-processor.ts
# Edit those lines — the output must be pure experiential text
```

**Merkle chain broken**
```bash
# This should not happen in normal operation
# If it does, check for any UPDATE statements
grep -r "\.run.*UPDATE" server/persistence/
# The database is append-only — this should be empty
```

---

## Expected Build Timeline

| Phase | Key deliverable | Est. time |
|---|---|---|
| 0 — Bootstrap | Tooling, types, configs | 45 min |
| 1 — Infrastructure | Clock, EventBus, DB, LLM | 2.5 hours |
| 2 — World Engine | Voxel, Circadian, Physics | 3 hours |
| 3 — Perception/Qualia | AttentionFilter, THE WALL | 3 hours |
| 4 — CLS Memory | Two-store memory, dreams | 3 hours |
| 5 — Agent Engine | System1+2, Will, Bodies | 3.5 hours |
| 6 — Language | Vocal actuation → dialects | 2 hours |
| 7 — Species/Tech | Animals, death concept | 2 hours |
| 8 — Analysis | TripleBaseline, Merkle | 2 hours |
| 9 — Forge UI | Dashboard, Glass Room | 3 hours |
| 10 — Polish | Integration, tuning | 2 hours |
| **Total** | | **~26 hours** |

One overnight session (8–10 hours): Phases 0–6 complete (full backend).
Second session: Phases 7–10 (species, research platform, UI).

---

## The Key Rule

**Type `/continue` and walk away.**

The lefthook pre-commit will block any commit that breaks the Veil. The Merkle logger will record every causal step. The TripleBaseline will tell you what's real emergence vs LLM confabulation.

In the morning you will have a working causality engine. The agents will not know they are simulated. You will know everything.
