// app/api/ask-ai/route.ts
import { NextResponse } from "next/server";
import { gemini } from "../../../lib/geminiClient";
import { PrismaClient, CreditType } from "@prisma/client";
import { createClient } from "../../../lib/auth";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { prompt, analysisType = "general" } = await req.json();

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch recent transactions
    const transactions = await prisma.credit.findMany({
      where: { userId: user.id },
      orderBy: { date: "desc" },
      take: 100,
    });

    // Fetch financial goals
    const goals = await prisma.financialGoal.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    // Fetch recent AI conversations for context
    const recentConversations = await prisma.aiConversation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { prompt: true, createdAt: true },
    });

    // Calculate financial metrics
    const credits = transactions.filter((t) => t.type === CreditType.CREDIT);
    const debits = transactions.filter((t) => t.type === CreditType.DEBIT);
    const loans = transactions.filter((t) => t.type === CreditType.LOAN);
    const emis = transactions.filter((t) => t.type === CreditType.EMI);

    const totalCredit = credits.reduce((sum, t) => sum + t.amount, 0);
    const totalDebit = debits.reduce((sum, t) => sum + t.amount, 0);
    const totalLoans = loans.reduce((sum, t) => sum + t.amount, 0);
    const totalEMI = emis.reduce((sum, t) => sum + t.amount, 0);

    // Category breakdown
    const categoryBreakdown = transactions
      .filter((t) => t.category)
      .reduce((acc, t) => {
        const cat = t.category!;
        if (!acc[cat]) {
          acc[cat] = { total: 0, count: 0, type: t.type };
        }
        acc[cat].total += t.amount;
        acc[cat].count += 1;
        return acc;
      }, {} as Record<string, { total: number; count: number; type: CreditType }>);

    // Build comprehensive financial context
    const financialContext = `
USER FINANCIAL OVERVIEW:
========================
Period: Last ${transactions.length} transactions
Total Income: ₹${totalCredit.toFixed(2)}
Total Expenses: ₹${totalDebit.toFixed(2)}
Outstanding Loans: ₹${totalLoans.toFixed(2)}
Monthly EMI: ₹${totalEMI.toFixed(2)}
Net Balance: ₹${(totalCredit - totalDebit).toFixed(2)}
Savings Rate: ${totalCredit > 0 ? ((totalCredit - totalDebit) / totalCredit * 100).toFixed(1) : 0}%

SPENDING BY CATEGORY:
${Object.entries(categoryBreakdown)
  .sort(([, a], [, b]) => b.total - a.total)
  .map(([cat, data]) => `- ${cat}: ₹${data.total.toFixed(2)} (${data.count} transactions)`)
  .join("\n") || "No categorized transactions yet"}

FINANCIAL GOALS:
${goals.length > 0 
  ? goals.map(g => `- ${g.title}: ₹${g.currentAmount.toFixed(2)} / ₹${g.targetAmount.toFixed(2)} (${((g.currentAmount/g.targetAmount)*100).toFixed(0)}%) - ${g.status}`).join("\n")
  : "No financial goals set yet"}

RECENT TRANSACTIONS (Last 20):
${transactions.slice(0, 20).map(t => 
  `${t.date.toLocaleDateString()}: ${t.type} - ₹${t.amount.toFixed(2)} ${t.category ? `[${t.category}]` : ""} ${t.description || ""}`
).join("\n")}

CONVERSATION HISTORY:
${recentConversations.length > 0 
  ? recentConversations.map(c => `- ${c.createdAt.toLocaleDateString()}: ${c.prompt.slice(0, 100)}...`).join("\n")
  : "First conversation"}
`;

    // Build system prompt
    let systemPrompt = `You are an expert personal financial advisor for Indian users. You have access to the user's complete financial data.

Your expertise includes:
- Budgeting and expense optimization
- Investment strategies (Mutual Funds, Stocks, PPF, NPS, etc.)
- Debt and loan management
- Tax planning (Indian tax laws - 80C, 80D, etc.)
- Emergency fund planning
- Credit score improvement
- Financial goal planning

Always:
- Be conversational, empathetic, and encouraging
- Provide specific, actionable recommendations
- Use Indian currency (₹) and context
- Reference their actual data when giving advice
- Suggest practical next steps
- Be honest about financial realities

${financialContext}
`;

    // Add specific focus based on analysis type
    const analysisTypeFocus = {
      spending: "Analyze spending patterns, identify unnecessary expenses, and suggest budget optimizations.",
      savings: "Focus on savings potential, investment opportunities, and wealth-building strategies.",
      budget: "Create a practical monthly budget based on their income, expenses, and financial goals.",
      goals: "Help set SMART financial goals and create an actionable plan to achieve them.",
      debt: "Analyze debt situation, suggest repayment strategies, and help reduce financial burden.",
      investment: "Provide investment advice based on their risk profile and financial goals.",
      general: "Provide comprehensive financial analysis and personalized recommendations."
    };

    systemPrompt += `\n\nFOCUS AREA: ${analysisTypeFocus[analysisType as keyof typeof analysisTypeFocus] || analysisTypeFocus.general}`;

    const userPrompt = prompt || `Analyze my complete financial situation and provide personalized advice.`;

    const fullPrompt = `${systemPrompt}\n\nUSER QUESTION: ${userPrompt}\n\nProvide a clear, well-structured response with specific recommendations based on their actual financial data.`;

    // Generate AI response
    const result = await gemini.generateContent(fullPrompt);
    const response = result.response;
    const text = await response.text();

    // Store the conversation
    await prisma.aiConversation.create({
      data: {
        userId: user.id,
        prompt: userPrompt,
        response: text,
        analysisType,
      },
    });

    return NextResponse.json({ 
      reply: text,
      metrics: {
        totalIncome: totalCredit,
        totalExpenses: totalDebit,
        totalLoans: totalLoans,
        totalEMI: totalEMI,
        netBalance: totalCredit - totalDebit,
        savingsRate: totalCredit > 0 ? ((totalCredit - totalDebit) / totalCredit * 100) : 0,
        transactionCount: transactions.length,
        goalsCount: goals.length,
      },
      categories: Object.entries(categoryBreakdown).map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        type: data.type
      }))
    });
  } catch (error) {
    console.error("ask-ai error:", error);
    return NextResponse.json({ 
      error: "Failed to generate financial advice",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}