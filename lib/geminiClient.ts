import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not defined in environment variables");
}

const geminiClient =  new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const gemini = geminiClient.getGenerativeModel({model:"gemini-2.5-flash"});
