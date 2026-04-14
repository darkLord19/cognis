import type { LLMProvider } from "./gateway";

export class MockLLMGateway implements LLMProvider {
  public async completion(
    _prompt: string,
    _systemPrompt: string,
    _options?: Record<string, unknown>,
  ): Promise<string> {
    // Deterministic response for testing
    return JSON.stringify({
      thought: "...",
      motorPlan: {
        primitives: [
          {
            type: "locomote_idle",
            target: { type: "none" },
            intensity: 0.2,
            durationTicks: 1,
          },
        ],
      },
    });
  }

  public async embed(_text: string): Promise<number[]> {
    return new Array(768).fill(0.1);
  }
}
