import { getBranchEventCounts } from "./event-queries";

export type TippingPointObservation = {
  branchId: string;
  tick: number;
  eventCount: number;
  baselineAverage: number;
  spikeRatio: number;
  description: string;
};

function computeSpike(branchId: string): TippingPointObservation | null {
  const counts = getBranchEventCounts(branchId);
  if (counts.length < 3) {
    return null;
  }

  const current = counts[counts.length - 1];
  if (!current) {
    return null;
  }

  const baselineWindow = counts.slice(Math.max(0, counts.length - 4), counts.length - 1);
  const baselineTotal = baselineWindow.reduce((sum, sample) => sum + sample.count, 0);
  const baselineAverage = baselineWindow.length > 0 ? baselineTotal / baselineWindow.length : 0;
  const spikeRatio = baselineAverage === 0 ? current.count : current.count / baselineAverage;

  if (current.count < 3 || spikeRatio < 2) {
    return null;
  }

  return {
    branchId,
    tick: current.tick,
    eventCount: current.count,
    baselineAverage,
    spikeRatio,
    description: `Event density spiked at tick ${current.tick} from ${baselineAverage.toFixed(
      2,
    )} to ${current.count}`,
  };
}

export const TippingPointDetector = {
  analyze(branchId: string): TippingPointObservation | null {
    return computeSpike(branchId);
  },

  check(branchId: string): boolean {
    return computeSpike(branchId) !== null;
  },
};
