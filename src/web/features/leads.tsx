import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  MessageSquare,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import type { Dashboard, Lead, LeadDetail, Member } from "../../shared/contracts.ts";
import { lostReasons, sources, statuses } from "../../shared/contracts.ts";
import { api, dateTime, dubaiInput, errorCode, fromDubaiInput } from "../api.ts";
import { Badge, Busy, ErrorNotice, LeadTable, Modal } from "../components/ui.tsx";
import { ExportButton } from "./import-export.tsx";
import { CommentEdit, LeadActions } from "./lead-actions.tsx";

type LeadList = { items: Lead[]; total: number; page: number; pageSize: number };
function useRefresh() {
  const client = useQueryClient();
  return async () => {
    await Promise.all(
      ["leads", "lead", "dashboard", "notifications", "reports"].map((key) =>
        client.invalidateQueries({ queryKey: [key] }),
      ),
    );
  };
}
export function Overview({ member }: { member: Member }) {
  const { t } = useTranslation();
  const stats = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api<Dashboard>("/dashboard"),
    refetchInterval: 60000,
  });
  const list = useQuery({
    queryKey: ["leads", "recent"],
    queryFn: () => api<LeadList>("/leads"),
    refetchInterval: 60000,
  });
  const cards = [
    { key: "total", path: "/leads", icon: <Users size={19} /> },
    { key: "today", path: "/follow-ups?due=today", icon: <Check size={19} /> },
    { key: "overdue", path: "/follow-ups?due=overdue", icon: <ArrowRight size={19} /> },
    { key: "converted", path: "/leads?status=converted", icon: <Check size={19} /> },
  ] as const;
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("teamSnapshot")}</span>
          <h1>{t("hello")}</h1>
          <p>{t("overviewSubtitle")}</p>
        </div>
        {member.role === "manager" && (
          <Link className="button primary" to="/leads?add=1">
            <Plus size={18} />
            {t("newLead")}
          </Link>
        )}
      </div>
      <ErrorNotice error={stats.error} />
      <div className="stats">
        {cards.map((card) => (
          <Link to={card.path} className={`stat-card ${card.key}`} key={card.key}>
            <div className="stat-top">
              <span>{t(card.key)}</span>
              <span className="stat-icon">{card.icon}</span>
            </div>
            <strong>{stats.data?.[card.key] ?? "—"}</strong>
            <small>{t(card.key === "overdue" ? "attention" : "overview")}</small>
          </Link>
        ))}
      </div>
      <div className="focus-banner">
        <div>
          <span className="eyebrow">{t("followUps")}</span>
          <h2>{t("nextSteps")}</h2>
          <p>{t("nextStepsText")}</p>
        </div>
        <Link className="button secondary" to="/follow-ups?due=today">
          {t("followUps")}
          <ArrowRight size={16} />
        </Link>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h2>{t("recentLeads")}</h2>
          <Link className="text-link" to="/leads">
            {t("viewAll")}
            <ArrowRight size={15} />
          </Link>
        </div>
        {list.isPending ? (
          <Busy />
        ) : list.error ? (
          <ErrorNotice error={list.error} />
        ) : (
          <LeadTable items={list.data.items.slice(0, 6)} />
        )}
      </section>
      {member.role !== "staff" && (
        <Link className="unassigned-note" to="/leads?due=unassigned">
          <span className="dot" />
          {stats.data?.unassigned ?? 0} {t("unassigned")}
          <ArrowRight size={15} />
        </Link>
      )}
    </>
  );
}
export function NewLead({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const refresh = useRefresh();
  const [confirmed, setConfirmed] = useState(false);
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      api<{ id: string }>("/leads", {
        customerName: form.get("customerName"),
        phone: form.get("phone"),
        source: form.get("source"),
        requirement: form.get("requirement"),
        acknowledgeDuplicate: confirmed,
      }),
    onSuccess: async (lead) => {
      await refresh();
      onClose();
      navigate(`/leads/${lead.id}`);
    },
  });
  return (
    <Modal open onClose={onClose} title={t("newLead")}>
      <p className="subtitle">{t("newLeadSubtitle")}</p>
      <form
        onChange={() => {
          if (confirmed) setConfirmed(false);
        }}
        onSubmit={(event) => {
          event.preventDefault();
          mutation.mutate(new FormData(event.currentTarget));
        }}
      >
        <label>
          {t("customerName")}
          <input name="customerName" required maxLength={160} autoComplete="off" dir="auto" />
        </label>
        <div className="form-grid">
          <label>
            {t("phone")}
            <input
              name="phone"
              type="tel"
              placeholder="+971 50 123 4567"
              required
              maxLength={40}
              dir="ltr"
            />
          </label>
          <label>
            {t("source")}
            <select name="source" defaultValue="" required>
              <option value="" disabled>
                {t("sourcePlaceholder")}
              </option>
              {sources.map((source) => (
                <option key={source} value={source}>
                  {t(`sourceLabels.${source}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t("requirement")}
          <textarea
            name="requirement"
            rows={4}
            maxLength={5000}
            placeholder={t("requirementHint")}
            dir="auto"
          />
        </label>
        {errorCode(mutation.error) === "duplicate_phone" ? (
          <div className="notice warning">
            <div>
              <strong>{t("duplicateTitle")}</strong>
              <p>{t("duplicateText")}</p>
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => {
                    event.stopPropagation();
                    setConfirmed(event.target.checked);
                  }}
                />
                {t("duplicateConfirm")}
              </label>
            </div>
          </div>
        ) : (
          <ErrorNotice error={mutation.error} />
        )}
        <div className="form-footer">
          <button className="button secondary" type="button" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" className="button primary" disabled={mutation.isPending}>
            {mutation.isPending ? t("saving") : t("createLead")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function LeadsPage({ member, followUps = false }: { member: Member; followUps?: boolean }) {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const [showAdd, setShowAdd] = useState(params.get("add") === "1");
  const [search, setSearch] = useState(params.get("q") ?? "");
  const query = new URLSearchParams(params);
  query.delete("add");
  if (followUps && !query.has("due")) query.set("due", "today");
  const key = query.toString();
  const list = useQuery({
    queryKey: ["leads", key],
    queryFn: () => api<LeadList>(`/leads?${key}`),
    refetchInterval: 60000,
  });
  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => api<Member[]>("/team"),
    enabled: member.role !== "staff",
  });
  const filter = useCallback(
    (name: string, value: string) => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(name, value);
        else next.delete(name);
        next.delete("page");
        return next;
      });
    },
    [setParams],
  );
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (params.get("q") ?? "")) filter("q", search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, params, filter]);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">{t("workspace")}</span>
          <h1>{t(followUps ? "followUps" : member.role === "staff" ? "myLeads" : "allLeads")}</h1>
          <p>{t("dubaiTime")}</p>
        </div>
        {["owner", "admin"].includes(member.role) && <ExportButton query={key} />}
        {member.role === "manager" && (
          <Link className="button secondary" to="/import">
            {t("extra.import")}
          </Link>
        )}
        {member.role === "manager" && (
          <button type="button" className="button primary" onClick={() => setShowAdd(true)}>
            <Plus size={18} />
            {t("newLead")}
          </button>
        )}
      </div>
      <div className="view-tabs">
        {(followUps ? ["today", "overdue"] : ["allLeads", "unassigned"])
          .filter((value) => member.role !== "staff" || value !== "unassigned")
          .map((value) => (
            <button
              type="button"
              key={value}
              className={(query.get("due") ?? "allLeads") === value ? "selected" : ""}
              onClick={() => filter("due", value === "allLeads" ? "" : value)}
            >
              {t(value)}
            </button>
          ))}
      </div>
      <section className="panel">
        <div className="filters">
          {member.role !== "staff" && (
            <select
              aria-label={t("extra.archivedFilter")}
              value={params.get("archived") ?? "no"}
              onChange={(e) => filter("archived", e.target.value)}
            >
              <option value="no">{t("extra.activeLeads")}</option>
              <option value="yes">{t("extra.archived")}</option>
            </select>
          )}
          <div className="search-input">
            <Search size={17} />
            <input
              aria-label={t("search")}
              placeholder={t("search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <select
            aria-label={t("status")}
            value={params.get("status") ?? ""}
            onChange={(event) => filter("status", event.target.value)}
          >
            <option value="">{t("anyStatus")}</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {t(`statusLabels.${status}`)}
              </option>
            ))}
          </select>
          <select
            aria-label={t("source")}
            value={params.get("source") ?? ""}
            onChange={(event) => filter("source", event.target.value)}
          >
            <option value="">{t("anySource")}</option>
            {sources.map((source) => (
              <option key={source} value={source}>
                {t(`sourceLabels.${source}`)}
              </option>
            ))}
          </select>
          {member.role !== "staff" && (
            <select
              aria-label={t("assignedTo")}
              value={params.get("assignee") ?? ""}
              onChange={(event) => filter("assignee", event.target.value)}
            >
              <option value="">{t("anyMember")}</option>
              {team.data
                ?.filter((person) => person.role === "staff")
                .map((person) => (
                  <option value={person.id} key={person.id}>
                    {person.name}
                  </option>
                ))}
            </select>
          )}
        </div>
        {list.isPending ? (
          <Busy />
        ) : list.error ? (
          <ErrorNotice error={list.error} />
        ) : (
          <>
            <LeadTable
              items={list.data.items}
              filtered={Boolean(
                query.get("q") ||
                  query.get("status") ||
                  query.get("source") ||
                  query.get("due") ||
                  query.get("assignee"),
              )}
            />
            <div className="pagination">
              <span>
                {list.data.total} {t("leads")}
              </span>
              <div>
                <button
                  type="button"
                  className="button secondary compact"
                  disabled={list.data.page === 1}
                  onClick={() =>
                    setParams((p) => {
                      p.set("page", String(list.data.page - 1));
                      return p;
                    })
                  }
                >
                  {t("previous")}
                </button>
                <span>
                  {t("page")} {list.data.page}
                </span>
                <button
                  type="button"
                  className="button secondary compact"
                  disabled={list.data.page * 25 >= list.data.total}
                  onClick={() =>
                    setParams((p) => {
                      p.set("page", String(list.data.page + 1));
                      return p;
                    })
                  }
                >
                  {t("next")}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      {showAdd && member.role === "manager" && (
        <NewLead
          onClose={() => {
            setShowAdd(false);
            if (params.has("add"))
              setParams((p) => {
                p.delete("add");
                return p;
              });
          }}
        />
      )}
    </>
  );
}
export function LeadPage({ member }: { member: Member }) {
  const { id } = useParams();
  const lead = useQuery({
    queryKey: ["lead", id],
    queryFn: () => api<LeadDetail>(`/leads/${id}`),
    refetchInterval: 60000,
  });
  if (lead.isPending) return <Busy />;
  if (lead.error) return <ErrorNotice error={lead.error} />;
  return (
    <LeadContent key={`${lead.data.id}:${lead.data.version}`} lead={lead.data} member={member} />
  );
}
function LeadContent({ lead, member }: { lead: LeadDetail; member: Member }) {
  const { t, i18n } = useTranslation();
  const refresh = useRefresh();
  const [status, setStatus] = useState(lead.status);
  const [reason, setReason] = useState(lead.lostReason ?? "");
  const team = useQuery({
    queryKey: ["team"],
    queryFn: () => api<Member[]>("/team"),
    enabled: member.role === "manager",
  });
  const closed = lead.status === "converted" || lead.status === "lost";
  const chosenClosed = status === "converted" || status === "lost";
  const mayEdit = !lead.archivedAt && (member.role === "manager" || member.role === "staff");
  const assignment = useMutation({
    mutationFn: (form: FormData) =>
      api(`/leads/${lead.id}/assign`, {
        version: lead.version,
        assigneeId: form.get("assigneeId"),
        nextFollowUpAt: fromDubaiInput(String(form.get("due"))),
      }),
    onSuccess: refresh,
  });
  const update = useMutation({
    mutationFn: (form: FormData) =>
      api(
        `/leads/${lead.id}`,
        {
          version: lead.version,
          status,
          nextFollowUpAt: chosenClosed ? null : fromDubaiInput(String(form.get("due"))),
          lostReason: status === "lost" ? reason || null : null,
          lostExplanation: String(form.get("explanation") ?? ""),
          reopenReason: String(form.get("reopenReason") ?? ""),
        },
        "PATCH",
      ),
    onSuccess: refresh,
  });
  const comment = useMutation({
    mutationFn: (form: HTMLFormElement) =>
      api(`/leads/${lead.id}/comments`, { body: new FormData(form).get("body") }).then(() =>
        form.reset(),
      ),
    onSuccess: refresh,
  });
  return (
    <>
      <Link className="text-link back-link" to="/leads">
        <ArrowLeft size={16} />
        {t("backToLeads")}
      </Link>
      <div className="page-heading detail-heading">
        <div className="customer-title">
          <span className="avatar large">{lead.customerName.slice(0, 1)}</span>
          <div>
            <h1 dir="auto">{lead.customerName}</h1>
            <a className="phone-link" href={`tel:${lead.phone}`}>
              <Phone size={14} />
              <bdi dir="ltr">{lead.phone}</bdi>
            </a>
          </div>
        </div>
        <Badge status={lead.status} />
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel padded">
            <div className="section-heading">
              <h2>{t("customerDetails")}</h2>
              <span className="source-chip">{t(`sourceLabels.${lead.source}`)}</span>
            </div>
            <div className="detail-metadata">
              <div>
                <small>{t("assignedTo")}</small>
                <strong dir="auto">{lead.assigneeName ?? t("unassigned")}</strong>
              </div>
              <div>
                <small>{t("followUp")}</small>
                <strong>{dateTime(lead.nextFollowUpAt, i18n.language)}</strong>
              </div>
            </div>
            <h3 className="field-heading">
              {t("requirement")} <span>{t("originalText")}</span>
            </h3>
            <p className="narrative" dir="auto">
              {lead.requirement || t("noMessage")}
            </p>
            <p className="fine-print">{t("translationDeferred")}</p>
            {lead.archivedAt && (
              <div className="notice warning">
                <strong>{t("extra.archived")}</strong>
                <p dir="auto">{lead.archiveReason}</p>
                <p>{t("extra.archiveHint")}</p>
              </div>
            )}
          </section>
          <section className="panel padded">
            <div className="section-heading">
              <h2>
                <MessageSquare size={18} />
                {t("comments")} <span className="count-pill">{lead.comments.length}</span>
              </h2>
            </div>
            {!lead.comments.length && <p className="muted">{t("noComments")}</p>}
            {lead.comments.map((item) => (
              <article className="comment" key={item.id}>
                <CommentEdit lead={lead} comment={item} member={member} />
                <div className="comment-heading">
                  <strong dir="auto">{item.authorName}</strong>
                  <time>{dateTime(item.createdAt, i18n.language)}</time>
                </div>
                <p dir="auto">{item.body}</p>
              </article>
            ))}
            {mayEdit && (
              <form
                className="comment-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  comment.mutate(event.currentTarget);
                }}
              >
                <label className="sr-only" htmlFor="comment-body">
                  {t("comments")}
                </label>
                <textarea
                  id="comment-body"
                  name="body"
                  rows={3}
                  placeholder={t("commentPlaceholder")}
                  maxLength={5000}
                  required
                  dir="auto"
                />
                <ErrorNotice error={comment.error} />
                <button
                  type="submit"
                  className="button primary compact"
                  disabled={comment.isPending}
                >
                  {t("addComment")}
                </button>
              </form>
            )}
          </section>
          <section className="panel padded">
            <h2>{t("activity")}</h2>
            <div className="timeline">
              {lead.activities.map((item) => (
                <div key={item.id} className="timeline-item">
                  <span className="timeline-dot" />
                  <div>
                    <p>
                      <strong dir="auto">{item.actorName}</strong> ·{" "}
                      {t(`activityLabels.${item.kind}`)}
                    </p>
                    {item.detail.status && <Badge status={item.detail.status} />}
                    {item.detail.assigneeName && <p dir="auto">{item.detail.assigneeName}</p>}
                    {item.detail.reason && (
                      <p className="narrative" dir="auto">
                        {item.detail.reason}
                      </p>
                    )}
                    {item.detail.lostReason && <p>{t(`reasonLabels.${item.detail.lostReason}`)}</p>}
                    {item.detail.before && item.detail.after && (
                      <details>
                        <summary>{t("extra.revision")}</summary>
                        {Object.entries(item.detail.before).map(([field, value]) => (
                          <div key={field} className="revision-values">
                            <strong>{t(field === "body" ? "comments" : field)}</strong>
                            <p dir="auto">
                              {t("extra.before")}: {value || "—"}
                            </p>
                            <p dir="auto">
                              {t("extra.after")}: {item.detail.after?.[field] || "—"}
                            </p>
                          </div>
                        ))}
                      </details>
                    )}
                    <time>{dateTime(item.createdAt, i18n.language)}</time>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <aside className="detail-side">
          <LeadActions lead={lead} member={member} />
          {member.role === "manager" && !closed && !lead.archivedAt && (
            <section className="panel padded">
              <h2>{t("assignment")}</h2>
              <p className="fine-print">{t("assignmentHint")}</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  assignment.mutate(new FormData(event.currentTarget));
                }}
              >
                <label>
                  {t("assignedTo")}
                  <select name="assigneeId" defaultValue={lead.assigneeId ?? ""} required>
                    <option value="">{t("chooseMember")}</option>
                    {team.data
                      ?.filter((person) => person.active && person.role === "staff")
                      .map((person) => (
                        <option value={person.id} key={person.id}>
                          {person.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  {t("followUp")}
                  <input
                    name="due"
                    type="datetime-local"
                    required
                    defaultValue={dubaiInput(lead.nextFollowUpAt)}
                  />
                </label>
                <small>{t("dubaiTime")}</small>
                <ErrorNotice error={assignment.error} />
                <button
                  type="submit"
                  className="button secondary full"
                  disabled={assignment.isPending}
                >
                  {t("assign")}
                </button>
              </form>
            </section>
          )}
          {mayEdit && (
            <section className="panel padded">
              <h2>{t("updateProgress")}</h2>
              {closed && <p className="fine-print">{t("closedInfo")}</p>}
              {(!closed || member.role === "manager") && (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    update.mutate(new FormData(event.currentTarget));
                  }}
                >
                  <label>
                    {t("status")}
                    <select
                      value={status}
                      onChange={(event) => setStatus(event.target.value as Lead["status"])}
                    >
                      {statuses.map((value) => (
                        <option key={value} value={value}>
                          {t(`statusLabels.${value}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                  {!chosenClosed && (
                    <label>
                      {t("followUp")}
                      <input
                        name="due"
                        type="datetime-local"
                        required
                        defaultValue={dubaiInput(lead.nextFollowUpAt)}
                      />
                      <small>{t("dubaiTime")}</small>
                    </label>
                  )}
                  {status === "lost" && (
                    <>
                      <label>
                        {t("lostReason")}
                        <select
                          value={reason}
                          required
                          onChange={(event) => setReason(event.target.value as typeof reason)}
                        >
                          <option value="">—</option>
                          {lostReasons.map((value) => (
                            <option key={value} value={value}>
                              {t(`reasonLabels.${value}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      {reason === "other" && (
                        <label>
                          {t("explanation")}
                          <textarea name="explanation" required maxLength={2000} dir="auto" />
                        </label>
                      )}
                    </>
                  )}
                  {closed && !chosenClosed && (
                    <label>
                      {t("reopenReason")}
                      <textarea name="reopenReason" required maxLength={2000} dir="auto" />
                    </label>
                  )}
                  <ErrorNotice error={update.error} />
                  <button type="submit" className="button primary full" disabled={update.isPending}>
                    {update.isPending ? t("saving") : t("save")}
                  </button>
                </form>
              )}
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
