import { createClient } from "../../lib/auth";
import { redirect } from "next/navigation";
// import DashboardClient from "";
import DashboardClient from "./DashboardClient";

export default async function Dashboard() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      console.error("Auth error in dashboard:", error);
      redirect("/auth/login");
    }

    return (
      <main className="p-10">
        <h1 className="text-3xl font-bold">Welcome, {user?.email}</h1>
        <p className="text-gray-600 mt-2">
          This is your private credit dashboard.
        </p>
        <div className="mt-4 p-4 bg-gray-100 rounded">
          <p className="text-sm text-gray-600">User ID: {user?.id}</p>
        </div>

        {/* Client-side credit manager */}
        {user?.id && <DashboardClient userId={user.id} />}
      </main>
    );
  } catch (error) {
    console.error("Dashboard error:", error);
    redirect("/auth/login");
  }
}
