import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import { LlamaParseReader } from "llama-cloud-services";
import fs from "fs/promises";
import path from "path";
import os from "os";

// --- Helper: Extract text using LlamaParse ---
async function extractTextWithLlamaParse(file: File): Promise<string> {
  try {
    console.log("Preparing file for LlamaParse...");

    // Convert uploaded file to a buffer and save it temporarily
    const buffer = Buffer.from(await file.arrayBuffer());
    const tempPath = path.join(os.tmpdir(), file.name);
    await fs.writeFile(tempPath, buffer);
    console.log(`Saved uploaded file to: ${tempPath}`);

    // Initialize LlamaParse Reader
    const reader = new LlamaParseReader({
      apiKey: process.env.LLAMA_CLOUD_API_KEY!,
      resultType: "text",
      language: "en",
      parsingInstruction: `Extract all financial transaction information including amounts, dates, descriptions, and merchant names. Focus on transaction tables and itemized entries.`,
      fastMode: false,
    });

    console.log("Sending request to LlamaParse...");
    const documents = await reader.loadData(tempPath); // ✅ pass path, not File

    if (!documents || documents.length === 0) {
      throw new Error("No content could be extracted from the document");
    }

    const extractedText = documents.map((doc) => doc.text).join("\n\n");

    if (!extractedText.trim()) {
      throw new Error("Document text appears empty or unreadable.");
    }

    console.log(`✅ Extracted ${extractedText.length} characters from file`);
    return extractedText;
  } catch (error) {
    console.error("LlamaParse error details:", error);
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        throw new Error("Invalid LlamaParse API key. Check LLAMA_CLOUD_API_KEY.");
      }
      throw new Error(`Failed to extract text: ${error.message}`);
    }
    throw new Error("Failed to extract text: Unknown error");
  }
}

// --- Transaction Extraction Logic ---
interface Transaction {
  type: string;
  amount: number;
  description: string;
  category: string;
  date: string | null;
  merchant: string | null;
}

function extractTransactions(text: string): Transaction[] {
  const transactions: Transaction[] = [];
  const lines = text.split("\n").filter((l) => l.trim());

  const amountPatterns = [
    /(?:Rs\.?|INR|₹)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:Rs\.?|INR|₹)/gi,
    /Total[:\s]+(?:Rs\.?|INR|₹)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /Amount[:\s]+(?:Rs\.?|INR|₹)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:^|\s)(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:Dr|Cr|Debit|Credit)/gi,
    /(?:^|\s)(\d+(?:,\d{3})*(?:\.\d{2})?)(?:\s|$)/g,
  ];

  const datePatterns = [
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g,
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi,
  ];

  const categoryKeywords: Record<string, string[]> = {
    Food: ["restaurant", "swiggy", "zomato", "pizza", "burger", "cafe", "meal", "dominos"],
    Transport: ["uber", "ola", "taxi", "metro", "bus", "fuel", "rapido", "train", "flight"],
    Shopping: ["amazon", "flipkart", "myntra", "store", "ajio", "meesho", "nykaa"],
    Entertainment: ["movie", "netflix", "prime", "spotify", "hotstar", "cinema"],
    Bills: ["electricity", "water", "gas", "internet", "mobile", "airtel", "jio"],
    Healthcare: ["hospital", "pharmacy", "doctor", "clinic", "apollo", "health"],
    Education: ["school", "college", "course", "book", "udemy", "coursera", "university"],
  };

  const merchantPattern = /(?:at|from|to|@)\s+([A-Z][a-zA-Z\s&'-]+)/i;

  for (const line of lines) {
    const lower = line.toLowerCase();
    if (lower.includes("statement") || lower.includes("balance") || lower.length < 10) continue;

    for (const pattern of amountPatterns) {
      const matches = [...line.matchAll(pattern)];
      if (!matches.length) continue;

      const match = matches[0];
      const amountStr = match[1]?.replace(/,/g, "");
      const amount = parseFloat(amountStr);
      if (!amount || amount <= 0 || amount > 1e7) continue;

      let type = "DEBIT";
      if (lower.includes("credit") || lower.includes("salary") || lower.includes("refund") || lower.includes("cr")) {
        type = "CREDIT";
      }

      let category = "Other";
      for (const [cat, kws] of Object.entries(categoryKeywords)) {
        if (kws.some((kw) => lower.includes(kw))) {
          category = cat;
          break;
        }
      }

      let merchant = null;
      const m = line.match(merchantPattern);
      if (m) merchant = m[1]?.trim() || null;

      let date = null;
      for (const d of datePatterns) {
        const dm = line.match(d);
        if (dm) {
          date = dm[1];
          break;
        }
      }

      const description = line.trim().substring(0, 100);
      transactions.push({ type, amount, description, category, date, merchant });
      break;
    }
  }

  return transactions.filter(
    (txn, i, self) =>
      i ===
      self.findIndex(
        (t) =>
          Math.abs(t.amount - txn.amount) < 0.01 &&
          t.description.substring(0, 50) === txn.description.substring(0, 50)
      )
  );
}

// --- POST Route Handler ---
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const supportedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/bmp",
    ];

    if (!supportedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload PDF or image (PNG/JPEG/WEBP/BMP)." },
        { status: 400 }
      );
    }

    console.log("Extracting text using LlamaParse...");
    const extractedText = await extractTextWithLlamaParse(file);

    const transactions = extractTransactions(extractedText);

    if (transactions.length === 0) {
      return NextResponse.json({
        transactions: [],
        message:
          "No transactions detected. Ensure the document has clear transaction details.",
        extractedText: extractedText.substring(0, 500),
      });
    }

    return NextResponse.json({
      transactions,
      message: `✅ Extracted ${transactions.length} transaction(s) successfully.`,
    });
  } catch (error: unknown) {
    console.error("Extract expenses error:", error);
    const message = error instanceof Error ? error.message : "Failed to extract expenses";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
