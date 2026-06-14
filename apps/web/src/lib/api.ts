import type { ParsedReceipt } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function parseReceipt(file: File): Promise<ParsedReceipt> {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch("/api/receipts/parse", { method: "POST", body: form });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(json.message ?? "Failed to parse receipt", res.status);
  return json as ParsedReceipt;
}
