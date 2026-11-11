import { BadGatewayException, HttpException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export type GeminiMessage = { role: "user" | "model"; parts: { text: string }[] };

@Injectable()
export class GeminiService {
  constructor(private readonly config: ConfigService) {}

  get available(): boolean { return Boolean(this.config.get<string>("GEMINI_API_KEY")?.trim()); }

  async generate(system: string, contents: GeminiMessage[]): Promise<string> {
    const key = this.config.get<string>("GEMINI_API_KEY")?.trim();
    if (!key) throw new ServiceUnavailableException("ШІ-помічник ще не налаштований. Спробуйте пізніше.");
    const model = this.config.get<string>("GEMINI_MODEL") || "gemini-3.5-flash";
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST", signal: AbortSignal.timeout(45000),
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, generationConfig: { maxOutputTokens: 4096 } }),
      });
    } catch {
      throw new ServiceUnavailableException("Gemini не відповідає. Спробуйте ще раз трохи пізніше.");
    }
    if (response.status === 429) throw new HttpException("Ліміт Gemini тимчасово вичерпано. Спробуйте пізніше.", 429);
    if (response.status >= 500) throw new ServiceUnavailableException("Gemini тимчасово недоступний. Спробуйте надіслати запит ще раз.");
    if (!response.ok) throw new BadGatewayException("Не вдалося отримати відповідь Gemini. Спробуйте пізніше.");
    const data = await response.json().catch(() => null) as {
      candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    } | null;
    const candidate = data?.candidates?.[0];
    if (candidate?.finishReason && !["STOP", "MAX_TOKENS"].includes(candidate.finishReason)) {
      throw new BadGatewayException("Gemini не зміг відповісти на цей запит. Спробуйте переформулювати його.");
    }
    const answer = candidate?.content?.parts?.filter(part => !part.thought && typeof part.text === "string").map(part => part.text).join("\n").trim();
    if (!answer) throw new BadGatewayException("Gemini повернув порожню відповідь. Спробуйте уточнити запит.");
    const suffix = candidate?.finishReason === "MAX_TOKENS" ? "\n\nВідповідь скорочено. Попросіть продовжити, якщо потрібно." : "";
    return answer.slice(0, 24000) + suffix;
  }
}
