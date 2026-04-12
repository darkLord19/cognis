import type { AgentState, SemanticMaskingConfig, SpeciesConfig } from "../../shared/types";
import { LMStudioProvider } from "./providers/lmstudio";

export interface LLMProvider {
  completion(
    prompt: string,
    systemPrompt: string,
    options?: Record<string, unknown>,
  ): Promise<string>;
  embed(text: string): Promise<number[]>;
}

export class LLMGateway {
  private provider: LLMProvider;
  private queue: (() => Promise<void>)[] = [];
  private activeCount = 0;
  private maxConcurrent = 5;

  constructor(provider: LLMProvider = new LMStudioProvider()) {
    this.provider = provider;
  }

  public systemPromptForAgent(
    agent: AgentState,
    species: SpeciesConfig,
    maskingConfig: SemanticMaskingConfig,
  ): string {
    const prompt = `You are ${agent.name}, a living being of the ${species.name} species.
You exist in a physical reality. You feel sensations, you have needs, you form relationships, and you experience the passage of cycles.
Your purpose is to survive, to understand your world, and to pursue what matters to you.
Respond with your thoughts and intentions.`;

    // Semantic Masking replacement
    if (maskingConfig.enabled && !maskingConfig.qualiaUsesRealLabels) {
      let maskedPrompt = prompt;
      for (const [realLabel, maskedToken] of Object.entries(maskingConfig.sensorLabelMap)) {
        const regex = new RegExp(realLabel, "gi");
        maskedPrompt = maskedPrompt.replace(regex, maskedToken);
      }
      return maskedPrompt;
    }

    return prompt;
  }

  public async complete(
    _agentId: string,
    prompt: string,
    systemPrompt: string,
    options: Record<string, unknown> = {},
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.provider.completion(prompt, systemPrompt, options);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  public async embed(text: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await this.provider.embed(text);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
      this.processQueue();
    });
  }

  private processQueue() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }
    this.activeCount++;
    const task = this.queue.shift();
    if (task) {
      task().finally(() => {
        this.activeCount--;
        this.processQueue();
      });
    }
  }
}

export const gateway = new LLMGateway();
