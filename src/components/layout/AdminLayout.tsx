import { useState, type ReactNode } from 'react';
import {
  BarChart3,
  ExternalLink,
  Inbox,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Package,
  Settings,
  Tag,
  Users,
  X,
} from 'lucide-react';
import { ImageWithFallback } from '../common/ImageWithFallback';
import type { AdminUser } from '../../types/isp';

interface AdminLayoutProps {
  admin: AdminUser;
  currentPath: string;
  onNavigate: (path: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

const ADMIN_NAV = [
  { label: 'Overview', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Packages', path: '/admin/dashboard/packages', icon: Package },
  { label: 'Offers', path: '/admin/dashboard/offers', icon: Tag },
  { label: 'Customers', path: '/admin/dashboard/customers', icon: Users },
  { label: 'Subscriptions', path: '/admin/dashboard/subscriptions', icon: Link2 },
  { label: 'Reports', path: '/admin/dashboard/reports', icon: BarChart3 },
  { label: 'Inquiries', path: '/admin/dashboard/inquiries', icon: Inbox },
  { label: 'Settings', path: '/admin/dashboard/settings', icon: Settings },
];

export function AdminLayout({
  admin,
  currentPath,
  onNavigate,
  onLogout,
  children,
}: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const activeNavItem =
    ADMIN_NAV.find((item) => item.path === currentPath) || ADMIN_NAV[0];

  function handleNav(path: string) {
    setSidebarOpen(false);
    onNavigate(path);
  }

  return (
    <div className="flex min-h-screen bg-[#F8FAFC] text-[#0B1F4D]">
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#0B1F4D]/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Left Navigation Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-150 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex min-h-16 items-center justify-between border-b border-slate-200 px-5 py-2.5">
          <a
            href="/admin/dashboard"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/admin/dashboard');
            }}
            className="flex min-w-0 flex-col items-center gap-0.5 text-center"
          >
            <ImageWithFallback
              src="/assets/aistudio/image_4c43d9bf.png"
              alt="Roman Communication"
              className="h-7 w-auto shrink-0 object-contain"
              fallbackTitle="Roman Communication"
            />
            <span className="truncate text-[11px] font-bold leading-none tracking-tight text-[#0B1F4D]">
              Roman Communication
            </span>
          </a>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Admin Navigation">
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.path;
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleNav(item.path);
                }}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  active
                    ? 'bg-[#0B1F4D] text-white'
                    : 'text-slate-600 hover:bg-[#EAF2FF] hover:text-[#0B1F4D]'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="border-t border-slate-200 p-3 space-y-1">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/');
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-[#0B1F4D]"
          >
            <ExternalLink className="h-4 w-4 shrink-0" />
            <span>Public Website</span>
          </a>
          <button
            type="button"
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="rounded-lg border border-slate-200 p-2 text-[#0B1F4D] hover:bg-slate-50 lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-400">Admin</span>
              <span className="text-slate-300">/</span>
              <span className="font-semibold text-[#0B1F4D]">{activeNavItem.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-[#0B1F4D]">{admin.name}</p>
              <p className="text-xs text-slate-500">{admin.email}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
