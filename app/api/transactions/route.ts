// app/api/transactions/route.ts
import { NextResponse } from "next/server";
import { PrismaClient, CreditType } from "@prisma/client";
import { createClient } from "../../../lib/auth";

const prisma = new PrismaClient();

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure the user exists in Prisma
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email ?? "unknown" },
  });

  const credits = await prisma.credit.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
  });

  return NextResponse.json(credits);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure the user exists in Prisma
  await prisma.user.upsert({
    where: { id: user.id },
    update: {},
    create: { id: user.id, email: user.email ?? "unknown" },
  });

  const body = await req.json();
  const { type, amount, description, category } = body;

  // Convert lowercase string to CreditType enum
  const typeMap: Record<string, CreditType> = {
    'credit': CreditType.CREDIT,
    'debit': CreditType.DEBIT,
    'loan': CreditType.LOAN,
    'emi': CreditType.EMI,
    'card': CreditType.CARD,
    'investment': CreditType.INVESTMENT,
    'transfer': CreditType.TRANSFER,
  };

  const creditType = typeMap[type.toLowerCase()] || CreditType.DEBIT;

  const newTxn = await prisma.credit.create({
    data: {
      userId: user.id,
      type: creditType,
      amount: parseFloat(amount),
      description,
      category: category || null,
    },
  });

  return NextResponse.json({ transaction: newTxn });
}