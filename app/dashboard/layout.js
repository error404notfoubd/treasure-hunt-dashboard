import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import Sidebar from "@/components/sidebar";
import { ToastProvider } from "@/components/toast";
import DashboardClient from "./dashboard-client";
import PendingApproval from "./pending-approval";

export default async function DashboardLayout({ children }) {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "approved") {
    return (
      <ToastProvider>
        <PendingApproval user={user} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-surface-0">
        <Sidebar user={user} />
        <DashboardClient user={user}>{children}</DashboardClient>
      </div>
    </ToastProvider>
  );
}
