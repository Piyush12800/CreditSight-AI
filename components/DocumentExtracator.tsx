// components/DocumentExtractor.tsx
"use client";

import { useState } from "react";

type ExtractedTransaction = {
  type: string;
  amount: number;
  description: string;
  category: string;
  date?: string;
  merchant?: string;
};

export default function DocumentExtractor({ 
  onTransactionsExtracted 
}: { 
  onTransactionsExtracted: (transactions: ExtractedTransaction[]) => void 
}) {
  const [uploading, setUploading] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedTransaction[]>([]);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setStatus("📄 Reading document...");
    setError("");
    setExtractedData([]);

    try {
      const file = files[0];
      const formData = new FormData();
      formData.append("file", file);

      setStatus("🤖 AI is analyzing your document...");

      const response = await fetch("/api/extract-expenses", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to extract data");
      }

      const data = await response.json();
      
      if (data.transactions && data.transactions.length > 0) {
        setExtractedData(data.transactions);
        setStatus(`✅ Found ${data.transactions.length} transaction(s)!`);
      } else {
        setStatus("⚠️ No transactions found in document");
      }
    } catch (err: unknown) {
      console.error("Upload error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Failed to process document");
      }
      setStatus("");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleImportTransactions() {
    onTransactionsExtracted(extractedData);
    setExtractedData([]);
    setStatus("✅ Transactions imported successfully!");
    setTimeout(() => setStatus(""), 3000);
  }

  function handleRemoveTransaction(index: number) {
    setExtractedData(prev => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 p-6 rounded-lg border-2 border-dashed border-indigo-300 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">📸</span>
        <h3 className="text-lg font-semibold text-gray-800">
          Smart Document Extractor
        </h3>
      </div>

      <p className="text-sm text-gray-600 mb-4">
        Upload bills, receipts, bank statements (PDF/Image) and AI will automatically extract expenses
      </p>

      {/* File Upload */}
      <div className="relative">
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleFileUpload}
          disabled={uploading}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
          id="file-upload"
        />
        <label
          htmlFor="file-upload"
          className={`flex items-center justify-center gap-3 p-4 bg-white border-2 border-indigo-300 rounded-lg cursor-pointer transition hover:bg-indigo-50 ${
            uploading ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          {uploading ? (
            <>
              <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="font-medium text-indigo-600">Processing...</span>
            </>
          ) : (
            <>
              <span className="text-2xl">📄</span>
              <span className="text-2xl">🖼️</span>
              <span className="font-medium text-gray-700">
                Click to upload PDF or Image
              </span>
            </>
          )}
        </label>
      </div>

      {/* Status Messages */}
      {status && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">{status}</p>
        </div>
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">⚠️ {error}</p>
        </div>
      )}

      {/* Extracted Transactions Preview */}
      {extractedData.length > 0 && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-gray-800 flex items-center gap-2">
              <span className="text-green-600">✓</span>
              Extracted Transactions
            </h4>
            <button
              onClick={handleImportTransactions}
              className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
            >
              Import All ({extractedData.length})
            </button>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {extractedData.map((txn, index) => (
              <div
                key={index}
                className="bg-white p-4 rounded-lg border border-gray-200 flex justify-between items-start"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      txn.type === "CREDIT" 
                        ? "bg-green-100 text-green-800" 
                        : "bg-red-100 text-red-800"
                    }`}>
                      {txn.type}
                    </span>
                    <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {txn.category}
                    </span>
                  </div>
                  <p className="font-semibold text-lg text-gray-900">
                    ₹{txn.amount.toFixed(2)}
                  </p>
                  <p className="text-sm text-gray-600">{txn.description}</p>
                  {txn.merchant && (
                    <p className="text-xs text-gray-500 mt-1">
                      Merchant: {txn.merchant}
                    </p>
                  )}
                  {txn.date && (
                    <p className="text-xs text-gray-500">Date: {txn.date}</p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveTransaction(index)}
                  className="text-red-600 hover:text-red-800 text-sm font-medium ml-4"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Supported Formats */}
      <div className="mt-4 pt-4 border-t border-indigo-200">
        <p className="text-xs text-gray-500">
          <strong>Supported formats:</strong> PDF, JPG, PNG, WEBP
        </p>
        <p className="text-xs text-gray-500 mt-1">
          <strong>Works with:</strong> Restaurant bills, shopping receipts, bank statements, 
          credit card statements, utility bills, invoices
        </p>
      </div>
    </div>
  );
}