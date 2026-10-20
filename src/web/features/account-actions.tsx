import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Member, roles } from "../../shared/contracts.ts";
import { api, dateTime } from "../api.ts";
import { ErrorNotice, Modal } from "../components/ui.tsx";

export function AccountActions({ person, current }: { person: Member; current: Member }) {
  const { t, i18n } = useTranslation();
  const client = useQueryClient();
  const [mode, setMode] = useState<"role" | "recovery" | null>(null);
  const role = useMutation({
    mutationFn: (form: FormData) =>
      api(`/team/${person.id}/role`, { role: form.get("role") }, "PATCH"),
    onSuccess: async () => {
      setMode(null);
      await client.invalidateQueries({ queryKey: ["team"] });
    },
  });
  const recovery = useMutation({
    mutationFn: (form: HTMLFormElement) => {
      const currentPassword = new FormData(form).get("currentPassword");
      form.reset();
      return api<{ url: string; expiresAt: string }>(`/team/${person.id}/recovery`, {
        currentPassword,
      });
    },
  });
  return (
    <>
      {person.id !== current.id && (
        <button
          type="button"
          className="button secondary compact"
          onClick={() => {
            role.reset();
            setMode("role");
          }}
        >
          {t("extra.roleChange")}
        </button>
      )}
      {person.active && (
        <button
          type="button"
          className="button secondary compact"
          onClick={() => {
            recovery.reset();
            setMode("recovery");
          }}
        >
          {t("extra.recovery")}
        </button>
      )}
      <Modal
        open={mode !== null}
        onClose={() => {
          setMode(null);
          recovery.reset();
        }}
        title={t(mode === "role" ? "extra.roleChange" : "extra.recovery")}
      >
        <p>
          <strong dir="auto">{person.name}</strong> · <bdi>{person.email}</bdi>
        </p>
        {mode === "role" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              role.mutate(new FormData(e.currentTarget));
            }}
          >
            <p>{t("extra.roleHint")}</p>
            <label>
              {t("role")}
              <select name="role" defaultValue={person.role}>
                {roles.map((value) => (
                  <option value={value} key={value}>
                    {t(`roleLabels.${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <ErrorNotice error={role.error} />
            <button type="submit" className="button primary" disabled={role.isPending}>
              {t("save")}
            </button>
          </form>
        ) : recovery.data ? (
          <div role="status">
            <label>
              {t("extra.privateLink")}
              <textarea
                readOnly
                value={recovery.data.url}
                dir="ltr"
                onFocus={(e) => e.target.select()}
              />
            </label>
            <p>
              {t("extra.expires")}: {dateTime(recovery.data.expiresAt, i18n.language)}
            </p>
            <p>{t("extra.recoveryHint")}</p>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              recovery.mutate(e.currentTarget);
            }}
          >
            <p>{t("extra.recoveryHint")}</p>
            <label>
              {t("currentPassword")}
              <input
                name="currentPassword"
                type="password"
                required
                maxLength={128}
                autoComplete="current-password"
              />
            </label>
            <ErrorNotice error={recovery.error} />
            <button type="submit" className="button primary" disabled={recovery.isPending}>
              {t("extra.recovery")}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}

export function ResetPassword() {
  const { t, i18n } = useTranslation();
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get("token") ?? "",
  );
  const [mismatch, setMismatch] = useState(false);
  useEffect(() => {
    window.history.replaceState(null, "", "/reset");
  }, []);
  const reset = useMutation({
    mutationFn: (newPassword: string) => api("/recovery/complete", { token, newPassword }),
  });
  return (
    <main className="recovery-screen panel padded narrow">
      <button
        className="language-button"
        type="button"
        onClick={() => void i18n.changeLanguage(i18n.language === "en" ? "ar" : "en")}
      >
        {t("language")}
      </button>
      <h1>{t("extra.resetPassword")}</h1>
      <p>{t("extra.resetHint")}</p>
      {reset.isSuccess ? (
        <p role="status">{t("passwordChanged")}</p>
      ) : !token ? (
        <p role="alert">{t("extra.invalidLink")}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            if (data.get("password") !== data.get("confirm")) {
              setMismatch(true);
              return;
            }
            setMismatch(false);
            reset.mutate(String(data.get("password")));
            e.currentTarget.reset();
          }}
        >
          <label>
            {t("newPassword")}
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          <label>
            {t("extra.confirmPassword")}
            <input
              name="confirm"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
          {mismatch && <p role="alert">{t("extra.mismatch")}</p>}
          <ErrorNotice error={reset.error} />
          <button type="submit" className="button primary" disabled={reset.isPending}>
            {t("extra.resetPassword")}
          </button>
        </form>
      )}
      <p>
        <a href="/">{t("extra.backLogin")}</a>
      </p>
    </main>
  );
}
