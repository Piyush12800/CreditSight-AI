"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

type Credit = {
  id: string;
  date: string;
  type: string;
  amount: number;
  description: string | null;
  category?: string | null;
};

export default function DashboardClient({ userId }: { userId: string }) {
  const [credits, setCredits] = useState<Credit[]>([]);
  const [form, setForm] = useState({ 
    type: "credit", 
    amount: "", 
    description: "",
    category: "" 
  });
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  // Transaction categories
  const categories = [
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
    "Other"
  ];

  // Load Transactions
  async function loadCredits() {
    const res = await fetch("/api/transactions");
    if (res.ok) {
      const data = await res.json();
      setCredits(Array.isArray(data) ? data : data.credits || []);
    } else {
      setCredits([]);
    }
  }

  // Add Transaction
  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ type: "credit", amount: "", description: "", category: "" });
    await loadCredits();
    setLoading(false);
  }

  useEffect(() => {
    loadCredits();
  }, []);

  // Calculate summary for chart
  const summary = (credits || []).reduce((acc: Record<string, number>, c) => {
    acc[c.type] = (acc[c.type] || 0) + c.amount;
    return acc;
  }, {});
  const chartData = Object.keys(summary).map((k) => ({ type: k, amount: summary[k] }));

  // 🔮 Fetch AI Insights
  async function getAiInsights() {
    setAiLoading(true);
    setAiSummary("");
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: customPrompt.trim() || "",
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiSummary(data.reply || "No response from AI.");
      } else {
        setAiSummary(`Error: ${data.error || "Something went wrong."}`);
      }
    } catch (err) {
      setAiSummary("⚠️ Failed to contact AI service.");
    }
    setAiLoading(false);
  }

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold mb-4">Credit Records</h2>

      {/* Add Transaction Form */}
      <form onSubmit={addCredit} className="flex flex-wrap gap-3 mb-6">
        <label htmlFor="transaction-type" className="sr-only">Transaction type</label>
        <select
          id="transaction-type"
          className="border p-2 rounded"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value })}
        >
          <option value="credit">Income</option>
          <option value="debit">Expense</option>
          <option value="loan">Loan</option>
          <option value="emi">EMI</option>
          <option value="card">Card Payment</option>
          <option value="investment">Investment</option>
          <option value="transfer">Transfer</option>
        </select>

        <label htmlFor="category" className="sr-only">Category</label>
        <select
          id="category"
          className="border p-2 rounded"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value="">Select Category</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>

        <input
          type="number"
          step="0.01"
          placeholder="Amount"
          className="border p-2 rounded flex-1"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />
        <input
          type="text"
          placeholder="Description"
          className="border p-2 rounded flex-1"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Saving..." : "Add"}
        </button>
      </form>

      {/* Transaction List */}
      <div className="space-y-2 mb-8">
        {credits.map((c) => (
          <div
            key={c.id}
            className="p-3 border rounded flex justify-between bg-white"
          >
            <div>
              <p className="font-medium">{c.type.toUpperCase()}</p>
              {c.category && (
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {c.category}
                </span>
              )}
              <p className="text-sm text-gray-500">{c.description}</p>
            </div>
            <div className="text-right">
              <p
                className={`font-bold ${
                  c.type === "CREDIT" ? "text-green-600" : "text-red-600"
                }`}
              >
                ₹{c.amount.toFixed(2)}
              </p>
              <p className="text-xs text-gray-400">
                {new Date(c.date).toLocaleDateString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Summary Chart */}
      {chartData.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-2">Summary</h3>
          <BarChart width={400} height={250} data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="type" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="amount" fill="#3b82f6" />
          </BarChart>
        </>
      )}

      {/* AI Insights Section */}
      <div className="mt-10 p-4 border rounded bg-gray-50">
        <h3 className="text-lg font-semibold mb-2">💡 AI Financial Insights</h3>

        <textarea
          placeholder="Ask a question like: What did I spend most on this month?"
          className="border w-full p-2 rounded mb-3"
          rows={3}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />

        <button
          onClick={getAiInsights}
          className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50"
          disabled={aiLoading}
        >
          {aiLoading ? "Analyzing..." : "Get AI Summary"}
        </button>

        {aiSummary && (
          <div className="mt-4 bg-white p-4 rounded border">
            <h4 className="font-semibold mb-2">AI Response:</h4>
            <p className="whitespace-pre-wrap text-gray-700">{aiSummary}</p>
          </div>
        )}
      </div>
    </section>
  );
}