import {
  QueryCache,
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
} from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  CalendarClock,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  PanelsTopLeft,
  Settings,
  Users,
} from "lucide-react";
import { Direction } from "radix-ui";
import { lazy, StrictMode, Suspense, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { useTranslation } from "react-i18next";
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes } from "react-router";
import type { Member } from "../shared/contracts.ts";
import { api, dateTime, errorCode } from "./api.ts";
import "./i18n/index.ts";
import { Busy, ErrorNotice, Modal } from "./components/ui.tsx";
import "./styles.css";

const AuthScreen = lazy(() =>
  import("./features/auth.tsx").then((m) => ({ default: m.AuthScreen })),
);
const ResetPassword = lazy(() =>
  import("./features/account-actions.tsx").then((m) => ({ default: m.ResetPassword })),
);
const ImportPage = lazy(() =>
  import("./features/import-export.tsx").then((m) => ({ default: m.ImportPage })),
);
const Overview = lazy(() => import("./features/leads.tsx").then((m) => ({ default: m.Overview })));
const LeadPage = lazy(() => import("./features/leads.tsx").then((m) => ({ default: m.LeadPage })));
const LeadsPage = lazy(() =>
  import("./features/leads.tsx").then((m) => ({ default: m.LeadsPage })),
);
const ReportsPage = lazy(() =>
  import("./features/reports.tsx").then((m) => ({ default: m.ReportsPage })),
);
const TeamPage = lazy(() => import("./features/team.tsx").then((m) => ({ default: m.TeamPage })));
const SettingsPage = lazy(() =>
  import("./features/team.tsx").then((m) => ({ default: m.SettingsPage })),
);
const client = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (errorCode(error) === "unauthorized" && query.queryKey[0] !== "me") {
        client.clear();
        window.location.assign("/");
      }
    },
  }),
  defaultOptions: { queries: { retry: false, staleTime: 15000 }, mutations: { retry: false } },
});
function Application() {
  const { i18n } = useTranslation();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Member>("/me"),
    retry: false,
    refetchInterval: 60000,
  });
  useEffect(() => {
    if (me.data) void i18n.changeLanguage(me.data.language);
  }, [me.data, i18n]);
  useEffect(() => {
    document.documentElement.lang = i18n.language;
    document.documentElement.dir = i18n.language === "ar" ? "rtl" : "ltr";
  }, [i18n.language]);
  if (me.isPending) return <Busy />;
  if (window.location.pathname === "/reset") return <ResetPassword />;
  if (me.error && errorCode(me.error) !== "unauthorized")
    return (
      <main className="padded">
        <ErrorNotice error={me.error} />
      </main>
    );
  return (
    <Direction.Provider dir={i18n.language === "ar" ? "rtl" : "ltr"}>
      {me.data ? <Workspace member={me.data} /> : <AuthScreen />}
    </Direction.Provider>
  );
}
function Workspace({ member }: { member: Member }) {
  const { t, i18n } = useTranslation();
  const [showNotifications, setShowNotifications] = useState(false);
  const notices = useQuery({
    queryKey: ["notifications"],
    queryFn: () =>
      api<
        {
          id: string;
          leadId: string;
          customerName: string;
          createdAt: string;
          kind: "assigned" | "overdue";
        }[]
      >("/notifications"),
    refetchInterval: 60000,
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/sign-out", {}),
    onSuccess: () => {
      client.clear();
      window.location.assign("/");
    },
  });
  const language = useMutation({
    mutationFn: () =>
      api("/me/language", { language: i18n.language === "ar" ? "en" : "ar" }, "PATCH"),
    onSuccess: () => client.invalidateQueries({ queryKey: ["me"] }),
  });
  const read = useMutation({
    mutationFn: () => api("/notifications/read", {}),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const nav = [
    { to: "/", label: "overview", icon: LayoutDashboard },
    { to: "/leads", label: "leads", icon: PanelsTopLeft },
    { to: "/follow-ups", label: "followUps", icon: CalendarClock },
    ...(member.role !== "staff"
      ? [
          { to: "/reports", label: "reports", icon: BarChart3 },
          { to: "/team", label: "team", icon: Users },
        ]
      : []),
  ];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link className="wordmark" to="/">
          inaya<span>DOMESTIC WORKERS</span>
        </Link>
        <div className="sidebar-label">{t("workspace")}</div>
        <nav>
          {nav.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"}>
              <Icon size={19} strokeWidth={1.7} />
              <span>{t(label)}</span>
              {label === "leads" && <span className="nav-dot" />}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <NavLink to="/settings">
            <Settings size={18} />
            {t("settings")}
          </NavLink>
          <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOut size={18} />
            {t("signOut")}
          </button>
          <div className="sidebar-footnote">
            <span className="online-dot" />
            Inaya CRM <span>01</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-title">
            Inaya <span>/</span> {t("company")}
          </span>
          <div className="topbar-actions">
            <button
              className="language-button"
              type="button"
              disabled={language.isPending}
              onClick={() => language.mutate()}
            >
              {t("language")}
            </button>
            <button
              className="icon-button notification-button"
              type="button"
              onClick={() => setShowNotifications(true)}
              aria-label={t("notificationTitle")}
            >
              <Bell size={19} />
              {Boolean(notices.data?.length) && <span />}
            </button>
            <span className="topbar-divider" />
            <div className="user-menu">
              <span className="avatar">{member.name.slice(0, 1)}</span>
              <div>
                <strong dir="auto">{member.name}</strong>
                <small>{t(`roleLabels.${member.role}`)}</small>
              </div>
              <ChevronDown size={14} />
            </div>
          </div>
        </header>
        <main className="main-content">
          <ErrorNotice error={language.error || logout.error} />
          <Routes>
            <Route path="/" element={<Overview member={member} />} />
            <Route path="/leads" element={<LeadsPage member={member} />} />
            <Route path="/leads/:id" element={<LeadPage member={member} />} />
            <Route
              path="/import"
              element={member.role === "manager" ? <ImportPage /> : <Navigate to="/" replace />}
            />
            <Route path="/follow-ups" element={<LeadsPage member={member} followUps />} />
            <Route
              path="/team"
              element={
                member.role === "staff" ? <Navigate to="/" replace /> : <TeamPage member={member} />
              }
            />
            <Route
              path="/reports"
              element={member.role === "staff" ? <Navigate to="/" replace /> : <ReportsPage />}
            />
            <Route path="/settings" element={<SettingsPage member={member} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <footer className="workspace-footer">
            INAYA · {t("secureWorkspace")}
            <span>{t("dubaiTime")}</span>
          </footer>
        </main>
      </div>
      <Modal
        open={showNotifications}
        onClose={() => setShowNotifications(false)}
        title={t("notificationTitle")}
      >
        <ErrorNotice error={notices.error || read.error} />
        {notices.data?.length ? (
          <>
            <button type="button" className="text-link" onClick={() => read.mutate()}>
              {t("markRead")}
            </button>
            {notices.data.map((notice) => (
              <Link
                className="notification-item"
                key={notice.id}
                to={`/leads/${notice.leadId}`}
                onClick={() => setShowNotifications(false)}
              >
                <strong dir="auto">{notice.customerName}</strong>
                <small>{t(notice.kind === "overdue" ? "overdue" : "assignedToYou")}</small>
                <small>{dateTime(notice.createdAt, i18n.language)}</small>
              </Link>
            ))}
          </>
        ) : (
          <p className="muted">{t("noNotifications")}</p>
        )}
      </Modal>
    </div>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Application root is missing.");
createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <Suspense fallback={<Busy />}>
          <Application />
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
