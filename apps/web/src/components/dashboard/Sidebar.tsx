"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { dashboardNav, roleLabels, type Role } from "@/lib/dashboard-nav";
import {
  CalendarIcon,
  GraduationCapIcon,
  MailIcon,
  PinIcon,
  UsersIcon,
  BookIcon,
  SettingsIcon,
} from "@/components/icons";
import { useRole } from "./RoleProvider";

const iconMap = {
  home: GraduationCapIcon,
  users: UsersIcon,
  teacher: BookIcon,
  result: CalendarIcon,
  notice: MailIcon,
  profile: PinIcon,
  settings: SettingsIcon,
} as const;

export default function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = dashboardNav.filter((i) => i.roles.includes(role));

  return (
    <aside className="hidden w-64 shrink-0 border-r border-ink-200 bg-white lg:block">
      <div className="flex h-16 items-center gap-2.5 border-b border-ink-200 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-navy-800 text-white">
          <GraduationCapIcon className="h-5 w-5" />
        </span>
        <span className="font-display text-sm font-extrabold leading-tight text-navy-900">
          MHS Dashboard
        </span>
      </div>
      <nav className="p-3" aria-label="Dashboard">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = iconMap[item.icon];
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-navy-50 text-navy-800"
                      : "text-ink-600 hover:bg-ink-100 hover:text-navy-800"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto border-t border-ink-200 p-4">
        <p className="text-xs text-ink-400">Signed in as</p>
        <p className="text-sm font-semibold text-navy-800">{roleLabels[role]}</p>
      </div>
    </aside>
  );
}
