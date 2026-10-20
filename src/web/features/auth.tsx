import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api.ts";
import { Busy, ErrorNotice } from "../components/ui.tsx";

export function AuthScreen() {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const setup = useQuery({
    queryKey: ["setup"],
    queryFn: () => api<{ required: boolean }>("/setup"),
  });
  const [setupKey] = useState(() => {
    const key = new URLSearchParams(window.location.hash.slice(1)).get("setup") ?? "";
    return key;
  });
  useEffect(() => {
    if (setupKey) window.history.replaceState(null, "", window.location.pathname);
  }, [setupKey]);
  const [created, setCreated] = useState(false);
  const mutation = useMutation({
    mutationFn: async (form: FormData) => {
      const email = String(form.get("email"));
      const password = String(form.get("password"));
      if (setup.data?.required && !created) {
        await api("/setup", {
          name: String(form.get("name")),
          email,
          password,
          key: setupKey || String(form.get("key")),
        });
        setCreated(true);
      }
      await api("/auth/sign-in/email", { email, password, rememberMe: false });
    },
    onSuccess: () => {
      client.clear();
      window.location.assign("/");
    },
  });
  const isSetup = setup.data?.required && !created;
  return (
    <div className="auth-shell">
      <section className="auth-brand">
        <div className="wordmark">
          inaya<span>DOMESTIC WORKERS</span>
        </div>
        <div className="brand-story">
          <span className="eyebrow light">{t("builtAroundPeople")}</span>
          <h1>{t("loginBrandLine")}</h1>
          <p>{t("loginBrandText")}</p>
          <div className="brand-art" aria-hidden="true">
            <div />
            <div />
            <div />
          </div>
        </div>
        <div className="brand-footer">
          <ShieldCheck size={16} />
          {t("secureWorkspace")}
        </div>
      </section>
      <main className="auth-main">
        <button
          className="language-button"
          type="button"
          onClick={() => void i18n.changeLanguage(i18n.language === "en" ? "ar" : "en")}
        >
          {t("language")}
        </button>
        <div className="auth-form">
          <span className="eyebrow">{t("workspace")}</span>
          <h1>{t(isSetup ? "setupTitle" : "welcome")}</h1>
          <p className="subtitle">{t(isSetup ? "setupSubtitle" : "signInSubtitle")}</p>
          {setup.isPending ? (
            <Busy />
          ) : setup.error ? (
            <ErrorNotice error={setup.error} />
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate(new FormData(event.currentTarget));
              }}
            >
              {isSetup && (
                <label>
                  {t("fullName")}
                  <input name="name" autoComplete="name" required maxLength={100} />
                </label>
              )}
              <label>
                {t("email")}
                <input
                  name="email"
                  type="email"
                  autoComplete="username"
                  dir="ltr"
                  required
                  maxLength={254}
                />
              </label>
              <label>
                {t("password")}
                <input
                  name="password"
                  type="password"
                  autoComplete={isSetup ? "new-password" : "current-password"}
                  minLength={isSetup ? 12 : 1}
                  maxLength={128}
                  required
                />
              </label>
              {isSetup && !setupKey && (
                <label>
                  {t("setupKey")}
                  <input name="key" type="password" required minLength={32} autoComplete="off" />
                  <small>{t("setupKeyHint")}</small>
                </label>
              )}
              <ErrorNotice error={mutation.error} />
              {!isSetup && (
                <details className="recovery-help">
                  <summary>{t("extra.forgot")}</summary>
                  <p>{t("extra.forgotHint")}</p>
                </details>
              )}
              <button type="submit" className="button primary full" disabled={mutation.isPending}>
                {mutation.isPending ? t("saving") : t(isSetup ? "createAdmin" : "signIn")}
                <ArrowRight size={18} />
              </button>
            </form>
          )}
        </div>
        <div className="auth-bottom">Inaya Domestic Workers · {t("secureWorkspace")}</div>
      </main>
    </div>
  );
}
