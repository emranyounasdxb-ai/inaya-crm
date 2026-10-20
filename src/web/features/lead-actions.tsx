import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LeadDetail, Member } from "../../shared/contracts.ts";
import { sources } from "../../shared/contracts.ts";
import { api, errorCode, fromDubaiInput } from "../api.ts";
import { ErrorNotice, Modal } from "../components/ui.tsx";

function useRefreshLead() {
  const client = useQueryClient();
  return async () => {
    await client.invalidateQueries();
  };
}
export function LeadActions({ lead, member }: { lead: LeadDetail; member: Member }) {
  const { t } = useTranslation();
  const refresh = useRefreshLead();
  const [mode, setMode] = useState<"edit" | "archive" | null>(null);
  const [duplicate, setDuplicate] = useState(false);
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      mode === "edit"
        ? api(
            `/leads/${lead.id}/details`,
            {
              version: lead.version,
              customerName: form.get("customerName"),
              phone: form.get("phone"),
              source: form.get("source"),
              requirement: form.get("requirement"),
              reason: form.get("reason"),
              acknowledgeDuplicate: duplicate,
            },
            "PATCH",
          )
        : api(`/leads/${lead.id}/archive`, {
            version: lead.version,
            archived: !lead.archivedAt,
            reason: form.get("reason"),
            ...(form.get("due") ? { nextFollowUpAt: fromDubaiInput(String(form.get("due"))) } : {}),
          }),
    onSuccess: async () => {
      setMode(null);
      await refresh();
    },
  });
  if (member.role !== "manager") return null;
  return (
    <section className="panel padded">
      <h2>{t("actions")}</h2>
      <div className="action-row">
        {!lead.archivedAt && (
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              mutation.reset();
              setDuplicate(false);
              setMode("edit");
            }}
          >
            {t("extra.editDetails")}
          </button>
        )}
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            mutation.reset();
            setMode("archive");
          }}
        >
          {t(lead.archivedAt ? "extra.restore" : "extra.archive")}
        </button>
      </div>
      <Modal
        open={mode !== null}
        onClose={() => setMode(null)}
        title={t(
          mode === "edit"
            ? "extra.editDetails"
            : lead.archivedAt
              ? "extra.restore"
              : "extra.archive",
        )}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          {mode === "edit" ? (
            <>
              <label>
                {t("customerName")}
                <input
                  name="customerName"
                  defaultValue={lead.customerName}
                  required
                  maxLength={160}
                  dir="auto"
                />
              </label>
              <label>
                {t("phone")}
                <input
                  name="phone"
                  type="tel"
                  defaultValue={lead.phone}
                  required
                  maxLength={40}
                  dir="ltr"
                  onChange={() => setDuplicate(false)}
                />
              </label>
              <label>
                {t("source")}
                <select name="source" defaultValue={lead.source}>
                  {sources.map((source) => (
                    <option key={source} value={source}>
                      {t(`sourceLabels.${source}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("requirement")}
                <textarea
                  name="requirement"
                  defaultValue={lead.requirement}
                  maxLength={5000}
                  rows={4}
                  dir="auto"
                />
              </label>
              {errorCode(mutation.error) === "duplicate_phone" && (
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={duplicate}
                    onChange={(e) => setDuplicate(e.target.checked)}
                  />
                  {t("duplicateConfirm")}
                </label>
              )}
            </>
          ) : (
            <>
              <p>{t("extra.archiveHint")}</p>
              {lead.archivedAt &&
                lead.assigneeId &&
                !["converted", "lost"].includes(lead.status) && (
                  <label>
                    {t("followUp")}
                    <input name="due" type="datetime-local" required />
                    <small>{t("dubaiTime")}</small>
                  </label>
                )}
            </>
          )}
          <label>
            {t("extra.reason")}
            <textarea name="reason" required maxLength={2000} dir="auto" />
          </label>
          <ErrorNotice error={mutation.error} />
          <button className="button primary" type="submit" disabled={mutation.isPending}>
            {t("save")}
          </button>
        </form>
      </Modal>
    </section>
  );
}
export function CommentEdit({
  lead,
  comment,
  member,
}: {
  lead: LeadDetail;
  comment: LeadDetail["comments"][number];
  member: Member;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const refresh = useRefreshLead();
  const mutation = useMutation({
    mutationFn: (form: FormData) =>
      api(
        `/leads/${lead.id}/comments/${comment.id}`,
        { body: form.get("body"), revision: comment.sourceRevision },
        "PATCH",
      ),
    onSuccess: async () => {
      setOpen(false);
      await refresh();
    },
  });
  if (
    lead.archivedAt ||
    member.id !== comment.authorId ||
    !["staff", "manager"].includes(member.role)
  )
    return null;
  return (
    <>
      <button
        className="text-link"
        type="button"
        onClick={() => {
          mutation.reset();
          setOpen(true);
        }}
      >
        {t("extra.editComment")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("extra.editComment")}>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(new FormData(event.currentTarget));
          }}
        >
          <label>
            {t("comments")}
            <textarea
              name="body"
              defaultValue={comment.body}
              rows={5}
              required
              maxLength={5000}
              dir="auto"
            />
          </label>
          <ErrorNotice error={mutation.error} />
          <button className="button primary" type="submit" disabled={mutation.isPending}>
            {t("save")}
          </button>
        </form>
      </Modal>
    </>
  );
}
