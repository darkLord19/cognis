import type { LLMProvider } from "./gateway";

export class MockLLMGateway implements LLMProvider {
  public async completion(
    prompt: string,
    _systemPrompt: string,
    _options?: Record<string, unknown>,
  ): Promise<string> {
    // Deterministic response for testing
    return `{"innerMonologue": "I am thinking about ${prompt.substring(0, 10)}...", "decision": { "type": "IDLE" }}`;
  }

  public async embed(_text: string): Promise<number[]> {
    return new Array(768).fill(0.1);
  }
}
