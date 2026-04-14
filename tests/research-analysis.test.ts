import { beforeEach, expect, test } from "bun:test";
import { CausalMiner } from "../server/analysis/causal-miner";
import { EmergenceDetector } from "../server/analysis/emergence-detector";
import { TippingPointDetector } from "../server/analysis/tipping-point";
import { BranchManager } from "../server/core/branch-manager";
import { RunManager } from "../server/core/run-manager";
import { db } from "../server/persistence/database";
import { FindingsJournal } from "../server/research/findings-journal";
import { EventType } from "../shared/events";

const analysisIds = [
  "analysis-causal",
  "analysis-tipping",
  "analysis-findings",
  "analysis-novelty",
];

beforeEach(() => {
  const quotedIds = analysisIds.map((id) => `'${id}'`).join(", ");
  db.db.exec(`DELETE FROM findings WHERE branch_id IN (${quotedIds})`);
  db.db.exec(`DELETE FROM events WHERE branch_id IN (${quotedIds})`);
  db.db.exec(`DELETE FROM branches WHERE id IN (${quotedIds})`);
  db.db.exec(`DELETE FROM run_config_snapshots WHERE run_id IN (${quotedIds})`);
  db.db.exec(`DELETE FROM runs WHERE id IN (${quotedIds})`);
});

function seedAnalysisRun(runId: string): void {
  RunManager.createRun(runId, `Analysis ${runId}`, 0, {});
  BranchManager.createBranch(runId, `Branch ${runId}`, 0);
}

function insertEvent(
  branchId: string,
  tick: number,
  type: EventType,
  payload: Record<string, unknown> = {},
  importance = 0,
): void {
  db.db
    .query(
      "INSERT INTO events (event_id, branch_id, run_id, tick, type, agent_id, target_id, payload, importance, baseline_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .run(
      crypto.randomUUID(),
      branchId,
      branchId,
      tick,
      type,
      null,
      null,
      JSON.stringify(payload),
      importance,
      null,
    );
}

test("CausalMiner mines likely event chains from a branch", () => {
  seedAnalysisRun("analysis-causal");
  insertEvent("analysis-causal", 1, EventType.PROTO_WORD_COINED, { word: "spark" }, 1);
  insertEvent("analysis-causal", 2, EventType.WORD_ENTERED_LEXICON, { word: "spark" }, 2);
  insertEvent("analysis-causal", 7, EventType.AGENT_SLEPT, { agentId: "agent-1" }, 1);

  const candidates = CausalMiner.mine("analysis-causal");

  expect(candidates).toHaveLength(1);
  const candidate = candidates[0];
  if (!candidate) {
    throw new Error("Expected one causal candidate");
  }
  expect(candidate.causeType).toBe(EventType.PROTO_WORD_COINED);
  expect(candidate.effectType).toBe(EventType.WORD_ENTERED_LEXICON);
  expect(candidate.tick).toBe(2);
  expect(candidate.confidence).toBeGreaterThan(0.55);
});

test("CausalMiner extracts embodied discovery metrics from event streams", () => {
  seedAnalysisRun("analysis-causal");
  insertEvent("analysis-causal", 3, EventType.ACTION_ATTEMPTED, { source: "procedural" }, 1);
  insertEvent("analysis-causal", 4, EventType.HYDRATION_IMPROVED, {}, 2);
  insertEvent("analysis-causal", 5, EventType.ACTION_SUCCEEDED, {}, 1);
  insertEvent("analysis-causal", 6, EventType.TOXIN_EXPOSURE, {}, 2);
  insertEvent("analysis-causal", 7, EventType.ACTION_ATTEMPTED, { source: "system2" }, 1);
  insertEvent("analysis-causal", 8, EventType.ACTION_ATTEMPTED, { source: "procedural" }, 1);
  insertEvent("analysis-causal", 9, EventType.VEIL_BREACH, {}, 2);

  const metrics = CausalMiner.extractEmbodiedDiscoveryMetrics("analysis-causal");

  expect(metrics.survivalTicks).toBe(9);
  expect(metrics.firstHydrationImprovementTick).toBe(4);
  expect(metrics.proceduralActionRatio).toBeGreaterThan(0.6);
  expect(metrics.system2ActionRatio).toBeLessThan(0.5);
  expect(metrics.veilBreachCount).toBe(1);
});

test("TippingPointDetector spots a density spike in a branch", () => {
  seedAnalysisRun("analysis-tipping");
  insertEvent("analysis-tipping", 1, EventType.TICK, { label: "baseline" }, 1);
  insertEvent("analysis-tipping", 2, EventType.TICK, { label: "baseline" }, 1);
  insertEvent("analysis-tipping", 5, EventType.TECH_DISCOVERED, { name: "fire" }, 2);
  insertEvent("analysis-tipping", 5, EventType.WORD_ENTERED_LEXICON, { word: "fire" }, 2);
  insertEvent("analysis-tipping", 5, EventType.GRAMMAR_RULE_FORMED, { rule: "adjacency" }, 2);
  insertEvent(
    "analysis-tipping",
    5,
    EventType.BEHAVIOURAL_PATTERN_OBSERVED,
    { pattern: "novel" },
    2,
  );

  const observation = TippingPointDetector.analyze("analysis-tipping");

  expect(observation).not.toBeNull();
  if (!observation) {
    throw new Error("Expected a tipping point observation");
  }
  const tippingPoint = observation;
  expect(tippingPoint.tick).toBe(5);
  expect(tippingPoint.eventCount).toBe(4);
  expect(TippingPointDetector.check("analysis-tipping")).toBe(true);
});

test("FindingsJournal stores interpretation and evidence ids", () => {
  seedAnalysisRun("analysis-findings");

  FindingsJournal.logFinding(
    "analysis-findings",
    12,
    "Observed clustering of communication after a tech discovery",
    "language_cluster",
    "genuine_emergence",
    ["event-1", "event-2"],
  );

  const findings = FindingsJournal.getFindings("analysis-findings");

  expect(findings).toHaveLength(1);
  const finding = findings[0];
  if (!finding) {
    throw new Error("Expected one finding");
  }
  expect(finding.interpretation).toBe("genuine_emergence");
  expect(finding.evidenceIds).toEqual(["event-1", "event-2"]);
});

test("EmergenceDetector normalizes behaviour names before novelty checks", () => {
  const detector = new EmergenceDetector();

  expect(detector.detectNovelty("fire making")).toBe(false);
  expect(detector.detectNovelty("Fire-Making")).toBe(false);

  detector.registerKnownBehaviour("collective tool use");

  expect(detector.detectNovelty("collective-tool-use")).toBe(false);
  expect(detector.detectNovelty("unseen_social_pattern")).toBe(true);
});

test("EmergenceDetector finds soft emergence patterns in event batches", () => {
  const detector = new EmergenceDetector();
  const events = Array.from({ length: 12 }, (_, index) => ({
    event_id: `evt-${index}`,
    branch_id: "analysis-emergence",
    run_id: "analysis-emergence",
    tick: index + 1,
    type: EventType.DECISION_MADE,
    agent_id: `agent-${index % 2}`,
    payload: {
      decision: {
        type: "MOVE",
        params: {
          goal: "toward_agent",
          targetId: `agent-${(index + 1) % 2}`,
        },
      },
    },
  }));

  const findings = detector.analyzeEventBatch(events);
  const names = findings.map((finding) => finding.name);

  expect(names).toContain("social_clustering");
  expect(names).toContain("repeated_proximity");
});
