import "./globals.css";
import Link from "next/link";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-800">
        <nav className="flex justify-between items-center px-6 py-3 bg-white shadow">
          <Link href="/" className="font-bold text-xl text-blue-600">
            CrediSight
          </Link>
          <div className="space-x-4">
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/auth/login" className="text-blue-600 font-semibold">
              Login
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
