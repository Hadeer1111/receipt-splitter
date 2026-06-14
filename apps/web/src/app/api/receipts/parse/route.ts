import { GoogleGenerativeAI } from "@google/generative-ai";
import { parsedReceiptSchema } from "@receipt-splitter/core";
import { NextRequest, NextResponse } from "next/server";

const RECEIPT_PROMPT = `You extract structured data from restaurant receipt photos.

Return ONLY valid JSON matching this shape:
{
  "items": [{ "name": string, "priceCents": number, "quantity": number }],
  "taxCents": number,
  "tipCents": number
}

Rules:
- priceCents and taxCents/tipCents must be integers in cents (e.g. $12.50 -> 1250)
- quantity defaults to 1 if not shown
- Include food/drink line items only in "items" — do NOT include tax, tip, subtotal, or total as items
- If tax or tip is not visible, omit taxCents/tipCents or set to 0
- Use clear item names as printed on the receipt
- If unreadable, return {"items":[],"taxCents":0,"tipCents":0}`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { message: "Receipt scanning is not configured. Set GEMINI_API_KEY in .env.local." },
      { status: 503 },
    );
  }

  const form = await request.formData();
  const file = form.get("image");
  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Image file is required" }, { status: 400 });
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ message: "Unsupported image type. Use JPEG, PNG, or WebP." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");
  const modelName = process.env.GEMINI_VISION_MODEL ?? "gemini-2.5-flash-lite";

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json", temperature: 0.1 },
    });

    const result = await model.generateContent([
      RECEIPT_PROMPT,
      { inlineData: { data: base64, mimeType: file.type } },
    ]);

    const raw = result.response.text();
    const json = JSON.parse(raw);
    const parsed = parsedReceiptSchema.safeParse(json);

    if (!parsed.success || parsed.data.items.length === 0) {
      return NextResponse.json(
        { message: "No line items found. Make sure the receipt is in frame and well lit." },
        { status: 400 },
      );
    }

    return NextResponse.json(parsed.data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read receipt";
    return NextResponse.json({ message: `Could not read receipt: ${message}` }, { status: 400 });
  }
}
