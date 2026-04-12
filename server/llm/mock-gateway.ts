import type { LLMProvider } from "./gateway";

export class MockLLMGateway implements LLMProvider {
  public async completion(
    _prompt: string,
    _systemPrompt: string,
    _options?: Record<string, unknown>,
  ): Promise<string> {
    // Deterministic response for testing
    // Note: innerMonologue in the response is expected — System2 routes it to MerkleLogger.
    // The mock returns a valid System2Output shape for integration testing.
    return `{"innerMonologue": "...", "decision": { "type": "IDLE" }}`;
  }

  public async embed(_text: string): Promise<number[]> {
    return new Array(768).fill(0.1);
  }
}
