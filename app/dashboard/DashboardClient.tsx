"use client";

import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import DocumentExtractor from "../../components/DocumentExtracator";
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
    type: "auto", // Default to auto-detect
    amount: "",
    description: "",
    category: "",
  });
  const [loading, setLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string>("");
  const [aiLoading, setAiLoading] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

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
    "Other",
  ];

  // Load Transactions
  async function loadCredits() {
    try {
      const res = await fetch("/api/transactions");
      
      if (!res.ok) {
        console.error("Failed to fetch:", res.status);
        return [];
      }
      
      const data = await res.json();
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.credits)) return data.credits;
      return [];
    } catch (error) {
      console.error("Failed to load credits:", error);
      return [];
    }
  }

  // Add Transaction with AI detection
  async function addCredit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setStatusMessage("💭 Analyzing transaction...");

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save transaction");
      }

      const data = await res.json();
      const { aiDetected, detectedType, detectedCategory } = data;

      // Build status message
      let message = "✅ Transaction added successfully!";
      if (aiDetected) {
        message = `🤖 AI detected: ${detectedType?.toUpperCase() || "DEBIT"}`;
        if (detectedCategory && !form.category) {
          message += ` | Category: "${detectedCategory}"`;
        }
      } else if (detectedCategory && !form.category) {
        message = `✅ Transaction added — AI categorized as "${detectedCategory}"`;
      }

      setStatusMessage(message);

      setForm({ type: "auto", amount: "", description: "", category: "" });
      const updatedCredits = await loadCredits();
      setCredits(updatedCredits);
    } catch (err: unknown) {
      console.error(err);
      setStatusMessage("⚠️ Failed to add transaction. Try again.");
    }

    setLoading(false);
    setTimeout(() => setStatusMessage(null), 5000);
  }

  // Load credits on mount
  useEffect(() => {
    (async () => {
      const credits = await loadCredits();
      setCredits(credits);
    })();
  }, []);

  // Chart summary by type
  const summary = (credits || []).reduce((acc: Record<string, number>, c) => {
    acc[c.type] = (acc[c.type] || 0) + c.amount;
    return acc;
  }, {});
  const chartData = Object.keys(summary).map((k) => ({
    type: k,
    amount: summary[k],
  }));

  // 🔮 Fetch AI Insights
  async function getAiInsights() {
    setAiLoading(true);
    setAiSummary("");
    try {
      const res = await fetch("/api/ask-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt:
            customPrompt.trim() ||
            "Analyze my financial data and give spending insights.",
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

  async function handleBulkImport(transactions: any[]) {
  setLoading(true);
  setStatusMessage(`📥 Importing ${transactions.length} transactions...`);

  try {
    let successCount = 0;
    for (const txn of transactions) {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: txn.type.toLowerCase(),
          amount: txn.amount,
          description: txn.description,
          category: txn.category,
        }),
      });

      if (res.ok) successCount++;
    }

    setStatusMessage(
      `✅ Successfully imported ${successCount}/${transactions.length} transactions!`
    );
    
    const updatedCredits = await loadCredits();
    setCredits(updatedCredits);
  } catch (err) {
    console.error("Bulk import error:", err);
    setStatusMessage("⚠️ Some transactions failed to import");
  }

  setLoading(false);
  setTimeout(() => setStatusMessage(null), 5000);
}

  const isAutoMode = form.type === "auto";

  return (
    <section className="mt-10">
      <h2 className="text-2xl font-semibold mb-4">💰 Credit Dashboard</h2>
       <DocumentExtractor onTransactionsExtracted={handleBulkImport} />
      {/* Add Transaction Form */}
      <form
        onSubmit={addCredit}
        className="bg-white p-4 rounded-lg shadow space-y-3"
      >
        {/* Mode Selector */}
        <div className="flex items-center gap-3 pb-3 border-b">
          <label className="font-medium text-gray-700">Detection Mode:</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "auto" })}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                isAutoMode
                  ? "bg-purple-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              🤖 AI Auto-Detect
            </button>
            <button
              type="button"
              onClick={() => setForm({ ...form, type: "debit" })}
              className={`px-4 py-2 rounded text-sm font-medium transition ${
                !isAutoMode
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              ✋ Manual Entry
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex flex-wrap gap-3">
          {/* Transaction Type - Only show in manual mode */}
          {!isAutoMode && (
            <>
              <label htmlFor="type-select" className="sr-only">
                Transaction Type
              </label>
              <select
                id="type-select"
                className="border p-2 rounded"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                aria-label="Transaction Type"
              >
                <option value="credit">Income</option>
                <option value="debit">Expense</option>
                <option value="loan">Loan</option>
                <option value="emi">EMI</option>
                <option value="card">Card Payment</option>
                <option value="investment">Investment</option>
                <option value="transfer">Transfer</option>
              </select>
            </>
          )}

          {/* Category Selector */}
          <label htmlFor="category-select" className="sr-only">
            Category
          </label>
          <select
            id="category-select"
            className="border p-2 rounded"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            aria-label="Category"
          >
            <option value="">
              {isAutoMode ? "AI Auto-Category" : "Select Category"}
            </option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Amount Input */}
          <input
            type="number"
            step="0.01"
            placeholder="Amount"
            className="border p-2 rounded flex-1 min-w-[120px]"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            required
          />

          {/* Description Input */}
          <input
            type="text"
            placeholder={
              isAutoMode
                ? "Describe transaction (e.g., 'Swiggy lunch order')"
                : "Description"
            }
            className="border p-2 rounded flex-1 min-w-[200px]"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required={isAutoMode}
          />

          {/* Submit Button */}
          <button
            type="submit"
            className={`px-4 py-2 rounded disabled:opacity-50 text-white font-medium ${
              isAutoMode ? "bg-purple-600 hover:bg-purple-700" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={loading}
          >
            {loading ? "Analyzing..." : isAutoMode ? "🤖 Add with AI" : "Add"}
          </button>
        </div>

        {/* AI Mode Helper Text */}
        {isAutoMode && (
          <p className="text-xs text-gray-600 bg-purple-50 p-2 rounded">
            💡 <strong>AI Mode:</strong> Just describe your transaction and AI will automatically detect if it's income or expense, plus categorize it for you!
          </p>
        )}
      </form>

      {/* Status Message */}
      {statusMessage && (
        <div className="text-sm text-center mb-4 text-gray-700 bg-blue-50 p-3 rounded border border-blue-200">
          {statusMessage}
        </div>
      )}

      {/* Transactions List */}
      <div className="space-y-2 mb-8 mt-6">
        <h3 className="text-lg font-semibold mb-3">Recent Transactions</h3>
        {credits.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No transactions yet. Add your first one above!</p>
        ) : (
          credits.map((c) => (
            <div
              key={c.id}
              className="p-3 border rounded flex justify-between bg-gray-50 hover:bg-gray-100 transition"
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
          ))
        )}
      </div>

      {/* Summary Chart */}
      {chartData.length > 0 && (
        <>
          <h3 className="text-lg font-semibold mb-2">📊 Summary</h3>
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
        <h3 className="text-lg font-semibold mb-2">🤖 AI Financial Insights</h3>

        <textarea
          placeholder="Ask a question like: What did I spend most on this month?"
          className="border w-full p-2 rounded mb-3"
          rows={3}
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />

        <button
          onClick={getAiInsights}
          className="bg-purple-600 text-white px-4 py-2 rounded disabled:opacity-50 hover:bg-purple-700 transition"
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