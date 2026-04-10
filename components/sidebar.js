"use client";

import { useRouter, usePathname } from "next/navigation";
import { IconUsers, IconShield, IconActivity, IconSettings, IconLogout, IconClock } from "./icons";
import { apiFetch } from "@/lib/api-client";
import { ROLES, getRoleLevel } from "@/lib/roles";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Leads", icon: IconUsers, minLevel: 10 },
  { href: "/dashboard/requests", label: "Requests", icon: IconClock, minLevel: 80 },
  { href: "/dashboard/audit", label: "Audit Log", icon: IconActivity, minLevel: 80 },
  { href: "/dashboard/users", label: "User Management", icon: IconShield, minLevel: 80 },
  { href: "/dashboard/settings", label: "Settings", icon: IconSettings, minLevel: 10 },
];

export default function Sidebar({ user }) {
  const router = useRouter();
  const pathname = usePathname();
  const roleLevel = getRoleLevel(user?.role);
  const role = ROLES[user?.role] || ROLES.viewer;

  const handleLogout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const isActive = (href) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/dashboard/responses";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-[240px] bg-surface-1 border-r border-surface-3/50 flex flex-col flex-shrink-0 sticky top-0 h-screen">
      {/* Brand */}
      <div className="px-5 py-6 border-b border-surface-3/50">
        <h1 className="text-[15px] font-bold tracking-tight">Treasure Hunt</h1>
        <span className="text-[11px] text-ink-4 font-medium uppercase tracking-widest mt-1 block">
          Management Console
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {NAV_ITEMS.filter((item) => roleLevel >= item.minLevel).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <button
              key={item.href}
              onClick={() => router.push(item.href)}
              className={`
                w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[13px] font-medium
                transition-all duration-150 border-none cursor-pointer text-left
                ${active
                  ? "bg-accent-muted text-accent"
                  : "text-ink-2 hover:bg-surface-3/60 hover:text-ink-1"
                }
              `}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-surface-3/50">
        <div className="flex items-center gap-2.5 px-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white flex-shrink-0"
            style={{ background: role.color }}
          >
            {(user?.fullName || user?.email || "?")[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold truncate">
              {user?.fullName || user?.email}
            </div>
            <div className="text-[11px] text-ink-4 capitalize">{role.label}</div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="p-1.5 rounded-md text-ink-4 hover:text-danger hover:bg-danger-muted transition-colors"
          >
            <IconLogout />
          </button>
        </div>
      </div>
    </aside>
  );
}
