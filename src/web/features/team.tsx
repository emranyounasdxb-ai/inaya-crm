import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Member } from "../../shared/contracts.ts";
import { roles } from "../../shared/contracts.ts";
import { api, dateTime } from "../api.ts";
import { Busy, ErrorNotice, Modal } from "../components/ui.tsx";
import { AccountActions } from "./account-actions.tsx";

export function TeamPage({ member }: { member: Member }) {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState(false);
  const team = useQuery({ queryKey: ["team"], queryFn: () => api<Member[]>("/team") });
  const refresh = () => client.invalidateQueries({ queryKey: ["team"] });
  const add = useMutation({
    mutationFn: (form: FormData) =>
      api("/team", {
        name: form.get("name"),
        email: form.get("email"),
        password: form.get("password"),
        role: form.get("role"),
      }),
    onSuccess: async () => {
      setOpen(false);
      setCreated(true);
      await refresh();
    },
  });
  const toggle = useMutation({
    mutationFn: (person: Member) =>
      api(`/team/${person.id}/active`, { active: !person.active }, "PATCH"),
    onSuccess: refresh,
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("workspace")}</span>
          <h1>{t("team")}</h1>
          <p>{t("teamSubtitle")}</p>
        </div>
        {member.role === "admin" && (
          <button
            type="button"
            className="button primary"
            onClick={() => {
              add.reset();
              setOpen(true);
            }}
          >
            <Plus size={18} />
            {t("createAccount")}
          </button>
        )}
      </div>
      {created && (
        <div className="notice success" role="status">
          {t("accountCreated")}
        </div>
      )}
      <ErrorNotice error={toggle.error} />
      <section className="panel">
        {team.isPending ? (
          <Busy />
        ) : team.error ? (
          <ErrorNotice error={team.error} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t("fullName")}</th>
                  <th>{t("email")}</th>
                  <th>{t("role")}</th>
                  <th>{t("status")}</th>
                  {member.role === "admin" && <th>{t("actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {team.data.map((person) => (
                  <tr key={person.id}>
                    <td>
                      <div className="customer-link">
                        <span className="avatar small">{person.name.slice(0, 1)}</span>
                        <strong dir="auto">{person.name}</strong>
                      </div>
                    </td>
                    <td>
                      <bdi dir="ltr">{person.email}</bdi>
                    </td>
                    <td>{t(`roleLabels.${person.role}`)}</td>
                    <td>
                      <span
                        className={`badge ${person.active ? "status-converted" : "status-lost"}`}
                      >
                        <span />
                        {t(person.active ? "active" : "inactive")}
                      </span>
                    </td>
                    {member.role === "admin" && (
                      <td>
                        <AccountActions person={person} current={member} />
                        {person.id !== member.id && (
                          <button
                            type="button"
                            className="button secondary compact"
                            disabled={toggle.isPending}
                            onClick={() => toggle.mutate(person)}
                          >
                            {t(person.active ? "deactivate" : "reactivate")}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Modal open={open} onClose={() => setOpen(false)} title={t("createAccount")}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            add.mutate(new FormData(event.currentTarget));
          }}
        >
          <label>
            {t("fullName")}
            <input name="name" required maxLength={100} dir="auto" />
          </label>
          <label>
            {t("email")}
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              dir="ltr"
              autoComplete="off"
            />
          </label>
          <label>
            {t("password")}
            <input
              name="password"
              type="password"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <small>{t("minimumPassword")}</small>
          </label>
          <label>
            {t("role")}
            <select name="role" defaultValue="staff">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {t(`roleLabels.${role}`)}
                </option>
              ))}
            </select>
          </label>
          <ErrorNotice error={add.error} />
          <div className="form-footer">
            <button type="button" className="button secondary" onClick={() => setOpen(false)}>
              {t("cancel")}
            </button>
            <button type="submit" className="button primary" disabled={add.isPending}>
              {t("createAccount")}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
export function SettingsPage({ member }: { member: Member }) {
  const { t, i18n } = useTranslation();
  const backups = useQuery({
    queryKey: ["backups"],
    queryFn: () =>
      api<{ lastSuccess: string | null; lastRestore: string | null; lastAttemptFailed: boolean }>(
        "/backups/status",
      ),
    enabled: ["owner", "admin"].includes(member.role),
    refetchInterval: 60000,
  });
  const change = useMutation({
    mutationFn: async (form: HTMLFormElement) => {
      const data = new FormData(form);
      await api("/auth/change-password", {
        currentPassword: data.get("currentPassword"),
        newPassword: data.get("newPassword"),
        revokeOtherSessions: true,
      });
      form.reset();
    },
  });
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("settings")}</span>
          <h1>{t("accountSecurity")}</h1>
          <p>
            <bdi dir="ltr">{member.email}</bdi> · {t(`roleLabels.${member.role}`)}
          </p>
        </div>
        <ShieldCheck size={28} />
      </div>
      <section className="panel padded narrow">
        <h2>{t("changePassword")}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            change.mutate(event.currentTarget);
          }}
        >
          <label>
            {t("currentPassword")}
            <input
              type="password"
              name="currentPassword"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            {t("newPassword")}
            <input
              type="password"
              name="newPassword"
              required
              minLength={12}
              maxLength={128}
              autoComplete="new-password"
            />
            <small>{t("minimumPassword")}</small>
          </label>
          <ErrorNotice error={change.error} />
          {change.isSuccess && (
            <div className="notice success" role="status">
              {t("passwordChanged")}
            </div>
          )}
          <button type="submit" className="button primary" disabled={change.isPending}>
            {t("changePassword")}
          </button>
        </form>
      </section>
      {["owner", "admin"].includes(member.role) && (
        <section className="panel padded narrow">
          <h2>{t("extra.backup")}</h2>
          <p>{t("extra.backupHint")}</p>
          <ErrorNotice error={backups.error} />
          {backups.data && (
            <>
              {backups.data.lastAttemptFailed && (
                <p className="notice warning" role="alert">
                  {t("extra.backupFailure")}
                </p>
              )}
              <p>
                {t("extra.backupLast")}:{" "}
                {backups.data.lastSuccess
                  ? dateTime(backups.data.lastSuccess, i18n.language)
                  : t("extra.backupUnavailable")}
              </p>
              <p>
                {t("extra.backupRestore")}: {dateTime(backups.data.lastRestore, i18n.language)}
              </p>
              <small>{t("extra.localOnly")}</small>
            </>
          )}
        </section>
      )}
    </>
  );
}
