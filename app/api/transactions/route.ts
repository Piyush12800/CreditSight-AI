// app/api/transactions/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, CreditType } from "@prisma/client";
import { createClient } from "../../../lib/auth";
import { gemini } from "../../../lib/geminiClient";

const prisma = new PrismaClient();

// 📥 GET - Fetch all transactions for logged-in user
export async function GET(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all credits for this user
    const credits = await prisma.credit.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(credits);
  } catch (error) {
    console.error("GET /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

// 📤 POST - Create new transaction with AI auto-detection
export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Ensure user exists
    await prisma.user.upsert({
      where: { id: user.id },
      update: {},
      create: { id: user.id, email: user.email ?? "unknown" },
    });

    const body = await req.json();
    const { type, amount, description, category } = body;

    let finalType = type;
    let finalCategory = category || null;
    let aiDetected = false;

    // 🧠 If description exists, let AI detect type and category
    if (description && description.trim()) {
      try {
        const prompt = `
You are a financial transaction analyzer. Analyze this transaction and provide classification.

Transaction Description: "${description}"
${type ? `User suggested type: ${type}` : ""}

Analyze and respond in this EXACT format (no extra text):
TYPE: [one of: CREDIT, DEBIT, LOAN, EMI, CARD, INVESTMENT, TRANSFER]
CATEGORY: [one of: Salary, Food, Transport, Entertainment, Shopping, Bills, Rent, Healthcare, Education, Investment, Loan Payment, Other]

Rules:
- CREDIT: Income, salary, refunds, cashback, gifts received, earnings
- DEBIT: Expenses, purchases, bills, payments made
- LOAN: Money borrowed or lent
- EMI: Installment payments (car EMI, home loan EMI, etc.)
- CARD: Credit card payments
- INVESTMENT: Stocks, mutual funds, gold, property
- TRANSFER: Money transfers between accounts

Be intelligent about context:
- "Swiggy order" = DEBIT, Food
- "Salary credited" = CREDIT, Salary
- "Uber ride" = DEBIT, Transport
- "Netflix subscription" = DEBIT, Entertainment
- "Car EMI" = EMI, Loan Payment
- "Amazon shopping" = DEBIT, Shopping
- "Electricity bill" = DEBIT, Bills
- "Freelance payment received" = CREDIT, Salary
- "Mutual fund investment" = INVESTMENT, Investment
- "Credit card bill payment" = CARD, Bills

Respond ONLY in the format above.
        `.trim();

        const aiResult = await gemini.generateContent(prompt);
        const aiResponse = await aiResult.response.text();

        // Parse AI response
        const typeMatch = aiResponse.match(/TYPE:\s*(\w+)/i);
        const categoryMatch = aiResponse.match(/CATEGORY:\s*([^\n]+)/i);

        if (typeMatch) {
          const detectedType = typeMatch[1].toUpperCase();
          const typeMap: Record<string, CreditType> = {
            CREDIT: CreditType.CREDIT,
            DEBIT: CreditType.DEBIT,
            LOAN: CreditType.LOAN,
            EMI: CreditType.EMI,
            CARD: CreditType.CARD,
            INVESTMENT: CreditType.INVESTMENT,
            TRANSFER: CreditType.TRANSFER,
          };

          if (typeMap[detectedType]) {
            finalType = detectedType.toLowerCase();
            aiDetected = true;
          }
        }

        if (categoryMatch) {
          finalCategory = categoryMatch[1].trim();
          // Validate category
          const validCategories = [
            "Salary",
            "Food",
            "Transport",
            "Entertainment",
            "Shopping",
            "Bills",
            "Rent",
            "Healthcare",
            "Education",
            "Investment",
            "Loan Payment",
            "Other",
          ];
          if (!validCategories.includes(finalCategory)) {
            finalCategory = "Other";
          }
        }
      } catch (err) {
        console.error("AI detection error:", err);
        // Fall back to user input or defaults
        finalCategory = finalCategory || "Other";
      }
    }

    // Map final type to Prisma enum
    const typeMap: Record<string, CreditType> = {
      credit: CreditType.CREDIT,
      debit: CreditType.DEBIT,
      loan: CreditType.LOAN,
      emi: CreditType.EMI,
      card: CreditType.CARD,
      investment: CreditType.INVESTMENT,
      transfer: CreditType.TRANSFER,
    };
    const creditType = typeMap[finalType?.toLowerCase()] || CreditType.DEBIT;

    // Create transaction
    const newTxn = await prisma.credit.create({
      data: {
        userId: user.id,
        type: creditType,
        amount: parseFloat(amount),
        description,
        category: finalCategory || "Other",
      },
    });

    return NextResponse.json({
      transaction: newTxn,
      aiDetected,
      detectedType: aiDetected ? finalType : null,
      detectedCategory: finalCategory,
    });
  } catch (error) {
    console.error("POST /api/transactions error:", error);
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 }
    );
  }
}