import {
  draftOwnerReply,
  draftTradeReview,
  type DraftReviewInput,
  type DraftReviewResult,
} from '../shared/reviewAi.js';

export async function generateReviewDraft(
  input: DraftReviewInput,
  openAiKey?: string,
): Promise<DraftReviewResult> {
  const local = draftTradeReview(input);
  if (!openAiKey || !openAiKey.trim()) {
    return local;
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const prompt = [
      `Draft a realistic Google Maps review from a homeowner for ${input.businessName} (${input.trade}).`,
      `Technician: ${input.techName}. Service: ${input.serviceType}.`,
      `Star rating: ${input.rating ?? 5}/5. Tone: ${input.tone}.`,
      input.rawTranscript ? `Voice transcript: "${input.rawTranscript}"` : '',
      input.quickHighlights?.length
        ? `Highlights selected: ${input.quickHighlights.join(', ')}`
        : '',
      input.extraNote ? `Extra homeowner note: "${input.extraNote}"` : '',
      'Rules: Keep natural human homeowner phrasing (no cheesy AI buzzwords), remove filler words, explicitly mention the technician by name and professionalism, max 3-4 sentences. Return ONLY the review text.',
    ]
      .filter(Boolean)
      .join('\n');

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openAiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.6,
        max_tokens: 220,
        messages: [
          {
            role: 'system',
            content:
              'You are an assistant helping busy homeowners turn short voice notes into authentic Google reviews for local tradespeople.',
          },
          { role: 'user', content: prompt },
        ],
      }),
    });
    clearTimeout(timer);

    if (!res.ok) return local;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const aiText = data.choices?.[0]?.message?.content?.trim();
    if (!aiText) return local;

    return {
      ...local,
      draftText: aiText,
      usedAiProvider: 'openai',
    };
  } catch {
    return local;
  }
}

export async function generateOwnerReplyText(
  input: {
    businessName: string;
    customerName: string;
    techName: string;
    serviceType: string;
    rating: number;
    reviewText: string;
  },
  openAiKey?: string,
): Promise<string> {
  const local = draftOwnerReply(input);
  if (!openAiKey || !openAiKey.trim()) return local;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${openAiKey.trim()}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.5,
        max_tokens: 150,
        messages: [
          {
            role: 'system',
            content:
              'Write a warm, concise business owner Google review reply (2-3 sentences) thanking the customer by first name and crediting the technician.',
          },
          {
            role: 'user',
            content: `Business: ${input.businessName}. Customer: ${input.customerName}. Tech: ${input.techName}. Service: ${input.serviceType}. Rating: ${input.rating}/5. Review: "${input.reviewText}"`,
          },
        ],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return local;
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content?.trim() || local;
  } catch {
    return local;
  }
}
