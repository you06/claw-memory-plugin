import OpenAI from "openai";

/**
 * OpenAI embedding generation.
 * Uses the `openai` npm package to generate vector embeddings for text.
 */
export class Embeddings {
  private client: OpenAI;

  constructor(
    apiKey: string,
    private model: string,
    baseURL?: string,
  ) {
    this.client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  }

  /** Generate an embedding vector for a single text. */
  async embed(text: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: this.model,
      input: text,
    });
    return response.data[0].embedding;
  }

  /** Generate embedding vectors for multiple texts in a single API call. */
  async embedBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    const response = await this.client.embeddings.create({
      model: this.model,
      input: texts,
    });

    // API returns results with index — sort by index to match input order
    const sorted = response.data.slice().sort((a, b) => a.index - b.index);
    return sorted.map((item) => item.embedding);
  }
}

/**
 * Serialize an embedding vector to a string for SQL insertion.
 * TiDB expects vector literals like '[0.1,0.2,0.3]'.
 */
export function vectorToString(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
