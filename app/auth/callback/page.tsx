"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function CallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<string>("Processing login...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check hash fragments for tokens (magic link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token");

        if (access_token && refresh_token) {
          setStatus("Setting up your session...");
          
          console.log("Tokens found, setting session...");
          
          // Call API route to set session server-side
          const response = await fetch("/auth/set-session", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              access_token,
              refresh_token,
            }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to set session");
          }
          
          console.log("Session established successfully for:", data.user?.email);
          
          // Clear the hash from URL
          window.history.replaceState(null, "", window.location.pathname);
          
          // Small delay to ensure cookies are set
          await new Promise(resolve => setTimeout(resolve, 300));
          
          // Redirect to dashboard
          setStatus("Redirecting to dashboard...");
          window.location.href = "/dashboard"; // Use hard redirect instead of router.push
          return;
        }

        // No valid auth data found
        throw new Error("No authentication data found in URL");

      } catch (err: any) {
        console.error("Auth callback error:", err);
        setStatus(`Error: ${err.message}`);
        setTimeout(() => {
          router.push(`/auth/login?error=${encodeURIComponent(err.message || "Authentication failed")}`);
        }, 2000);
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded shadow-md text-center">
        <div className="animate-pulse mb-4">
          <div className="h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
        <p className="text-gray-600">{status}</p>
      </div>
    </div>
  );
}