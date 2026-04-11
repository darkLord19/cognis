export class LMStudioUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LMStudioUnavailableError";
  }
}

export class LMStudioProvider {
  private baseUrl: string;
  private completionModel: string;
  private embeddingModel: string;

  constructor(
    baseUrl = process.env.LM_STUDIO_URL || "http://localhost:1234/v1",
    completionModel = process.env.LM_STUDIO_COMPLETION_MODEL || "llama-3.1-8b-abliterated",
    embeddingModel = process.env.LM_STUDIO_EMBEDDING_MODEL || "nomic-embed-text",
  ) {
    this.baseUrl = baseUrl;
    this.completionModel = completionModel;
    this.embeddingModel = embeddingModel;
  }

  private async fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    let lastError: Error | null = null;

    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeout);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response;
      } catch (e: unknown) {
        const error = e instanceof Error ? e : new Error(String(e));
        lastError = error;
        if (i < retries - 1) {
          const backoff = 2 ** i * 1000;
          await new Promise((resolve) => setTimeout(resolve, backoff));
        }
      }
    }

    throw new LMStudioUnavailableError(`LM Studio request failed: ${lastError?.message}`);
  }

  public async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`);
      return response.ok;
    } catch {
      return false;
    }
  }

  public async completion(
    prompt: string,
    systemPrompt: string,
    options: Record<string, unknown> = {},
  ): Promise<string> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.completionModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 500,
      }),
    });

    const data = (await response.json()) as { choices: { message: { content: string } }[] };
    return data.choices[0]?.message?.content || "";
  }

  public async embed(text: string): Promise<number[]> {
    const response = await this.fetchWithRetry(`${this.baseUrl}/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.embeddingModel,
        input: text,
      }),
    });

    const data = (await response.json()) as { data: { embedding: number[] }[] };
    return data.data[0]?.embedding || [];
  }
}
