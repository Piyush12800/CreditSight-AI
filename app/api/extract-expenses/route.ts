import { NextResponse } from "next/server";
import { createClient } from "../../../lib/auth";
import axios from "axios";

// Helper to extract text using OCR.space API with file upload (better for large files)
async function extractTextWithOCR(buffer: Buffer, fileType: string): Promise<string> {
  try {
    console.log('Preparing file for OCR.space API...');
    
    // Create form data with actual file (not base64)
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    
    // Determine file extension
    const ext = fileType.split('/')[1] || 'png';
    const filename = `document.${ext}`;
    
    formData.append('file', buffer, {
      filename: filename,
      contentType: fileType,
    });
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    formData.append('detectOrientation', 'true');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2');
    formData.append('filetype', ext.toUpperCase());
    
    console.log('Sending request to OCR.space API...');
    
    // Using axios with form-data
    const response = await axios.post(
      'https://api.ocr.space/parse/image',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'apikey': process.env.OCR_SPACE_API_KEY || 'K89776038288957',
        },
        timeout: 90000, // 90 second timeout for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    
    console.log('OCR.space response received');
    
    const result = response.data;
    
    if (result.IsErroredOnProcessing) {
      const errorMsg = Array.isArray(result.ErrorMessage) 
        ? result.ErrorMessage.join(', ') 
        : result.ErrorMessage || 'OCR processing failed';
      throw new Error(errorMsg);
    }
    
    if (!result.ParsedResults || result.ParsedResults.length === 0) {
      throw new Error('No results returned from OCR');
    }
    
    const extractedText = result.ParsedResults[0]?.ParsedText || '';
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('No text could be extracted from the document. The image may be too blurry or have no readable text.');
    }
    
    console.log(`Successfully extracted ${extractedText.length} characters`);
    return extractedText;
    
  } catch (error) {
    console.error("OCR error details:", error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNABORTED') {
        throw new Error('OCR request timed out. The file may be too large. Please try with a smaller or clearer image.');
      }
      if (error.response) {
        throw new Error(`OCR API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      }
      if (error.request) {
        throw new Error('Could not reach OCR.space API. Please check your internet connection.');
      }
    }
    
    throw new Error(`Failed to extract text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Smart transaction extractor using pattern matching
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
  const lines = text.split("\n").filter((line) => line.trim());

  // Patterns for amount detection
  const amountPatterns = [
    /(?:Rs\.?|INR|₹)\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:Rs\.?|INR|₹)/gi,
    /Total[:\s]+(?:Rs\.?|INR|₹)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /Amount[:\s]+(?:Rs\.?|INR|₹)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/gi,
    /(?:^|\s)(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:Dr|Cr|Debit|Credit)/gi,
    /(?:^|\s)(\d+(?:,\d{3})*(?:\.\d{2})?)(?:\s|$)/g, // Plain numbers
  ];

  // Date patterns - multiple formats
  const datePatterns = [
    /(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/g,
    /(\d{4}[-/]\d{1,2}[-/]\d{1,2})/g,
    /(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})/gi,
  ];

  // Category keywords
  const categoryKeywords: Record<string, string[]> = {
    Food: [
      "restaurant",
      "food",
      "swiggy",
      "zomato",
      "pizza",
      "burger",
      "cafe",
      "lunch",
      "dinner",
      "breakfast",
      "meal",
      "dominos",
      "mcdonald",
      "kfc",
      "subway",
      "starbucks",
      "dunkin",
    ],
    Transport: [
      "uber",
      "ola",
      "taxi",
      "metro",
      "bus",
      "petrol",
      "fuel",
      "parking",
      "transport",
      "rapido",
      "auto",
      "train",
      "flight",
      "airline",
    ],
    Shopping: [
      "amazon",
      "flipkart",
      "myntra",
      "shopping",
      "mall",
      "store",
      "purchase",
      "ajio",
      "meesho",
      "nykaa",
      "supermarket",
      "grocery",
    ],
    Entertainment: [
      "movie",
      "netflix",
      "prime",
      "spotify",
      "hotstar",
      "cinema",
      "theatre",
      "pvr",
      "inox",
      "disney",
      "youtube",
      "game",
    ],
    Bills: [
      "electricity",
      "water",
      "gas",
      "internet",
      "broadband",
      "mobile",
      "bill",
      "utility",
      "recharge",
      "airtel",
      "jio",
      "vi",
      "bsnl",
    ],
    Healthcare: [
      "hospital",
      "pharmacy",
      "medicine",
      "doctor",
      "clinic",
      "medical",
      "apollo",
      "medplus",
      "health",
      "pharma",
    ],
    Education: [
      "school",
      "college",
      "course",
      "book",
      "education",
      "tuition",
      "udemy",
      "coursera",
      "university",
      "fees",
    ],
  };

  // Merchant patterns
  const merchantPattern = /(?:at|from|to|@)\s+([A-Z][a-zA-Z\s&'-]+)/i;

  // Process each line
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lowerLine = line.toLowerCase();

    // Skip header/footer lines
    if (
      lowerLine.includes("statement") ||
      lowerLine.includes("opening balance") ||
      lowerLine.includes("closing balance") ||
      lowerLine.includes("account number") ||
      lowerLine.includes("page") ||
      lowerLine.length < 10
    ) {
      continue;
    }

    // Try to find amounts
    let foundTransaction = false;
    for (const pattern of amountPatterns) {
      const matches = [...line.matchAll(pattern)];
      for (const match of matches) {
        const amountStr = match[1].replace(/,/g, "");
        const amount = parseFloat(amountStr);

        // Validate amount (reasonable range)
        if (amount && amount > 0 && amount < 10000000) {
          // Determine transaction type
          let type = "DEBIT";
          if (
            lowerLine.includes("credit") ||
            lowerLine.includes("salary") ||
            lowerLine.includes("received") ||
            lowerLine.includes("refund") ||
            lowerLine.includes("deposit") ||
            lowerLine.includes("income") ||
            lowerLine.includes(" cr ") ||
            lowerLine.includes("cr.")
          ) {
            type = "CREDIT";
          }

          // Find category
          let category = "Other";
          for (const [cat, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some((kw) => lowerLine.includes(kw))) {
              category = cat;
              break;
            }
          }

          // Extract merchant
          let merchant = null;
          const merchantMatch = line.match(merchantPattern);
          if (merchantMatch) {
            merchant = merchantMatch[1].trim();
          } else {
            // Try to extract merchant from common patterns
            const words = line.split(/\s+/);
            for (let j = 0; j < words.length; j++) {
              if (
                words[j].length > 3 &&
                /^[A-Z]/.test(words[j]) &&
                !words[j].includes("Rs") &&
                !words[j].includes("INR") &&
                !words[j].match(/^\d/)
              ) {
                merchant = words[j];
                break;
              }
            }
          }

          // Extract date
          let date = null;
          for (const datePattern of datePatterns) {
            const dateMatch = line.match(datePattern);
            if (dateMatch) {
              date = dateMatch[1];
              break;
            }
          }

          // Create description
          let description = line.trim();
          if (description.length > 100) {
            description = description.substring(0, 97) + "...";
          }

          transactions.push({
            type,
            amount,
            description,
            category,
            date,
            merchant,
          });

          foundTransaction = true;
          break; // Only take first amount per line to avoid duplicates
        }
      }
      if (foundTransaction) break;
    }
  }

  // Remove duplicates and clean up
  const uniqueTransactions = transactions.filter((txn, index, self) => {
    return (
      index ===
      self.findIndex(
        (t) =>
          Math.abs(t.amount - txn.amount) < 0.01 &&
          t.description.substring(0, 50) === txn.description.substring(0, 50)
      )
    );
  });

  return uniqueTransactions;
}

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

    const fileType = file.type;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Validate file type
    const supportedTypes = [
      "application/pdf",
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/bmp",
    ];

    if (!supportedTypes.includes(fileType)) {
      return NextResponse.json(
        {
          error: "Unsupported file type. Please upload PDF or image (PNG, JPEG, WebP, BMP).",
        },
        { status: 400 }
      );
    }

    // Extract text using OCR.space API
    console.log("Extracting text from file using OCR.space API...");
    const extractedText = await extractTextWithOCR(buffer, fileType);
    console.log("Extracted text:", extractedText);

    // Extract transactions from text
    const transactions = extractTransactions(extractedText);

    if (transactions.length === 0) {
      return NextResponse.json({
        transactions: [],
        message:
          "No transactions detected in the document. Please ensure the document contains clear transaction information with amounts.",
        extractedText: extractedText.substring(0, 500), // Return first 500 chars for debugging
      });
    }

    return NextResponse.json({
      transactions,
      message: `Successfully extracted ${transactions.length} transaction(s)`,
    });
  } catch (error: unknown) {
    console.error("Extract expenses error:", error);
    let errorMessage = "Failed to extract expenses";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}