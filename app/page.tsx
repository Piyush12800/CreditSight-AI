"use client"
import React from "react";
import { useState } from "react";

export default function Home (){
    const [prompt, setprompt] = useState("");
    const [response, setresponse] = useState("");

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        const res = await fetch("/api/ask-ai", {
            method: "POST",
            headers: {      "Content-Type": "application/json"    },
            body: JSON.stringify({ prompt }),
        });
        const data = await res.json();
        setresponse(data.reply|| data.error);
    }
    return(
        <main className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">CrediSight AI — Quick Test</h1>
      <form onSubmit={onSubmit}>
        <textarea
          className="w-full border p-3 rounded"
          value={prompt}
          onChange={(e) => setprompt(e.target.value)}
          placeholder="Ask the AI about credit scoring..."
        />
        <button className="mt-3 px-4 py-2 bg-blue-600 text-white rounded">Ask</button>
      </form>

      {response && (
        <div className="mt-6 p-4 bg-gray-100 rounded">
          <pre className="whitespace-pre-wrap">{response}</pre>
        </div>
      )}
    </main>
    );
}