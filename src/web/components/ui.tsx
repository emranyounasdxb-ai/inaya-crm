import { AlertCircle, ArrowUpRight, Inbox, X } from "lucide-react";
import { Dialog } from "radix-ui";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { Lead, Status } from "../../shared/contracts.ts";
import { dateTime, errorCode } from "../api.ts";

export function ErrorNotice({ error }: { error: unknown }) {
  const { t } = useTranslation();
  if (!error) return null;
  return (
    <div className="notice error" role="alert">
      <AlertCircle size={17} />
      <span>{t(`errors.${errorCode(error)}`, { defaultValue: t("errors.server_error") })}</span>
    </div>
  );
}
export function Busy() {
  const { t } = useTranslation();
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      {t("loading")}
    </div>
  );
}
export function Badge({ status }: { status: Status }) {
  const { t } = useTranslation();
  return (
    <span className={`badge status-${status}`}>
      <span />
      {t(`statusLabels.${status}`)}
    </span>
  );
}
export function Empty({ filtered = false }: { filtered?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="empty">
      <div className="empty-icon">
        <Inbox size={26} strokeWidth={1.5} />
      </div>
      <h3>{t(filtered ? "noResults" : "noLeads")}</h3>
      {!filtered && <p>{t("noLeadsText")}</p>}
    </div>
  );
}
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" aria-describedby={undefined}>
          <div className="section-heading">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label={t("close")}>
              <X size={20} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function LeadTable({ items, filtered = false }: { items: Lead[]; filtered?: boolean }) {
  const { t, i18n } = useTranslation();
  if (!items.length) return <Empty filtered={filtered} />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>{t("customer")}</th>
            <th>{t("source")}</th>
            <th>{t("status")}</th>
            <th>{t("assignedTo")}</th>
            <th>{t("followUp")}</th>
            <th>
              <span className="sr-only">{t("actions")}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((lead) => (
            <tr key={lead.id}>
              <td>
                <Link className="customer-link" to={`/leads/${lead.id}`}>
                  <span className="avatar small">{lead.customerName.slice(0, 1)}</span>
                  <span>
                    <strong dir="auto">{lead.customerName}</strong>
                    <small dir="ltr">{lead.phone}</small>
                  </span>
                </Link>
              </td>
              <td>{t(`sourceLabels.${lead.source}`)}</td>
              <td>
                <Badge status={lead.status} />
              </td>
              <td>
                {lead.assigneeName ? (
                  <span dir="auto">{lead.assigneeName}</span>
                ) : (
                  <span className="muted">{t("unassigned")}</span>
                )}
              </td>
              <td
                className={
                  lead.nextFollowUpAt && new Date(lead.nextFollowUpAt).getTime() < Date.now()
                    ? "overdue-text"
                    : ""
                }
              >
                {dateTime(lead.nextFollowUpAt, i18n.language)}
              </td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`${t("customerDetails")}: ${lead.customerName}`}
                  to={`/leads/${lead.id}`}
                >
                  <ArrowUpRight size={17} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
