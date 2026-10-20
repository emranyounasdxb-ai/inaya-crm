import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Member } from "../../shared/contracts.ts";
import { sources, statuses } from "../../shared/contracts.ts";
import { api } from "../api.ts";
import { Busy, ErrorNotice } from "../components/ui.tsx";

type Group = { key: string | null; name?: string | null; total: number };
type Report = {
  newBySource: Group[];
  convertedBySource: Group[];
  newByStaff: Group[];
  convertedByStaff: Group[];
  lostByReason: Group[];
};
const today = () => new Date(Date.now() + 4 * 3600000).toISOString().slice(0, 10);
function range(preset: string) {
  const end = today();
  const start = new Date(`${end}T00:00:00Z`);
  if (preset === "yesterday") start.setUTCDate(start.getUTCDate() - 1);
  if (preset === "thisWeek") start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (preset === "thisMonth") start.setUTCDate(1);
  const from = start.toISOString().slice(0, 10);
  return { from, to: preset === "yesterday" ? from : end };
}
export function ReportsPage() {
  const { t } = useTranslation();
  const [dates, setDates] = useState(() => range("thisMonth"));
  const [preset, setPreset] = useState("thisMonth");
  const [source, setSource] = useState("");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const query = new URLSearchParams({
    ...dates,
    ...(source ? { source } : {}),
    ...(status ? { status } : {}),
    ...(assignee ? { assignee } : {}),
  }).toString();
  const report = useQuery({
    queryKey: ["reports", query],
    queryFn: () => api<Report>(`/reports?${query}`),
  });
  const team = useQuery({ queryKey: ["team"], queryFn: () => api<Member[]>("/team") });
  const sum = (groups: Group[]) => groups.reduce((value, group) => value + group.total, 0);
  function groupTable(first: Group[], second: Group[], staff = false) {
    const keys = [...new Set([...first, ...second].map((group) => group.key))];
    return keys.length ? (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>{t(staff ? "assignedTo" : "source")}</th>
              <th>{t("newEnquiries")}</th>
              <th>{t("bookings")}</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key ?? "unassigned"}>
                <td>
                  {staff
                    ? ([...first, ...second].find((group) => group.key === key)?.name ??
                      t("unassigned"))
                    : t(`sourceLabels.${key}`)}
                </td>
                <td>{first.find((group) => group.key === key)?.total ?? 0}</td>
                <td>{second.find((group) => group.key === key)?.total ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="padded muted">{t("noReport")}</p>
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("workspace")}</span>
          <h1>{t("reports")}</h1>
          <p>{t("reportSubtitle")}</p>
        </div>
      </div>
      <section className="panel padded">
        <div className="view-tabs">
          {["today", "yesterday", "thisWeek", "thisMonth"].map((value) => (
            <button
              type="button"
              className={preset === value ? "selected" : ""}
              key={value}
              onClick={() => {
                setPreset(value);
                setDates(range(value));
              }}
            >
              {t(value)}
            </button>
          ))}
        </div>
        <div className="report-filters">
          <label>
            {t("dateFrom")}
            <input
              type="date"
              value={dates.from}
              onChange={(event) => {
                setPreset("custom");
                setDates({ ...dates, from: event.target.value });
              }}
            />
          </label>
          <label>
            {t("dateTo")}
            <input
              type="date"
              value={dates.to}
              onChange={(event) => {
                setPreset("custom");
                setDates({ ...dates, to: event.target.value });
              }}
            />
          </label>
          <label>
            {t("source")}
            <select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">{t("anySource")}</option>
              {sources.map((item) => (
                <option key={item} value={item}>
                  {t(`sourceLabels.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("status")}
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">{t("anyStatus")}</option>
              {statuses.map((item) => (
                <option key={item} value={item}>
                  {t(`statusLabels.${item}`)}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("assignedTo")}
            <select value={assignee} onChange={(event) => setAssignee(event.target.value)}>
              <option value="">{t("anyMember")}</option>
              {team.data
                ?.filter((person) => person.role === "staff")
                .map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      </section>
      {report.isPending ? (
        <Busy />
      ) : report.error ? (
        <ErrorNotice error={report.error} />
      ) : (
        <>
          <div className="stats two">
            <div className="stat-card">
              <span>{t("newEnquiries")}</span>
              <strong>{sum(report.data.newBySource)}</strong>
            </div>
            <div className="stat-card">
              <span>{t("bookings")}</span>
              <strong>{sum(report.data.convertedBySource)}</strong>
            </div>
          </div>
          <p className="fine-print report-definition">{t("reportDefinition")}</p>
          <div className="report-grid">
            <section className="panel">
              <div className="section-heading">
                <h2>{t("sourcePerformance")}</h2>
              </div>
              {groupTable(report.data.newBySource, report.data.convertedBySource)}
            </section>
            <section className="panel">
              <div className="section-heading">
                <h2>{t("staffPerformance")}</h2>
              </div>
              {groupTable(report.data.newByStaff, report.data.convertedByStaff, true)}
            </section>
          </div>
          <section className="panel padded">
            <h2>{t("lostBreakdown")}</h2>
            <p className="fine-print">{t("lostDefinition")}</p>
            {report.data.lostByReason.length ? (
              report.data.lostByReason.map((group) => (
                <div className="reason-row" key={group.key}>
                  <span>{t(`reasonLabels.${group.key}`)}</span>
                  <strong>{group.total}</strong>
                </div>
              ))
            ) : (
              <p className="muted">{t("noReport")}</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
