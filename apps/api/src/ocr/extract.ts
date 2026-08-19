export type OcrSuggestion = {
  amount?: number;
  expenseDate?: string;
  vatRate?: 0 | 1 | 10 | 20;
  taxMode?: "INCLUDED" | "EXCLUDED";
  description?: string;
  supplierName?: string;
  invoiceNo?: string;
  rawText?: string;
  skipped?: boolean;
  reason?: string;
};

const SYSTEM = `Sen Türk fatura/fiş okuyucusun. Yalnızca JSON döndür.
Alanlar: amount (sayı), expenseDate (YYYY-MM-DD), vatRate (0,1,10,20), taxMode (INCLUDED veya EXCLUDED), description, supplierName, invoiceNo, rawText.
Bilinmiyorsa alanı atla.`;

export async function extractFromImage(
  buffer: Buffer,
  mimeType: string,
): Promise<OcrSuggestion> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { skipped: true, reason: "OPENAI_API_KEY tanımlı değil" };
  }
  if (!mimeType.startsWith("image/")) {
    return { skipped: true, reason: "PDF OCR için görsel yükleyin" };
  }
  const b64 = buffer.toString("base64");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_OCR_MODEL || "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Bu fiş/faturayı oku." },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${b64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    return { skipped: true, reason: `OCR API hata: ${res.status} ${text.slice(0, 200)}` };
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content || "{}";
  try {
    const parsed = JSON.parse(content) as OcrSuggestion;
    if (parsed.vatRate != null && ![0, 1, 10, 20].includes(Number(parsed.vatRate))) {
      delete parsed.vatRate;
    }
    if (parsed.amount != null) parsed.amount = Number(parsed.amount);
    return parsed;
  } catch {
    return { skipped: true, reason: "OCR JSON çözümlenemedi", rawText: content };
  }
}
