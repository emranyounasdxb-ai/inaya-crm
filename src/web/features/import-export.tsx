import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { sources } from "../../shared/contracts.ts";
import { ApiError, api } from "../api.ts";
import { ErrorNotice, Modal } from "../components/ui.tsx";

type PreviewRow = {
  row: number;
  customerName: string;
  phone: string;
  source: string;
  requirement: string;
  createdAt: string;
  errors: string[];
  duplicate: boolean;
};
type Preview = { id: string; rows: PreviewRow[] };
const fields = ["customerName", "phone", "source", "requirement", "createdAt"] as const;
export function ImportPage() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const workerRef = useRef<Worker | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanup = () => {
    workerRef.current?.terminate();
    workerRef.current = null;
    if (timerRef.current) clearTimeout(timerRef.current);
  };
  useEffect(
    () => () => {
      workerRef.current?.terminate();
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );
  const preview = useMutation({
    mutationFn: () =>
      api<Preview>("/import/preview", {
        rows: rows
          .slice(1)
          .map((row) =>
            Object.fromEntries(
              fields.map((field) => [
                field,
                mapping[field] === "" || mapping[field] === undefined
                  ? ""
                  : (row[Number(mapping[field])] ?? ""),
              ]),
            ),
          ),
      }),
    onSuccess: (value) =>
      setSelected(
        new Set(value.rows.filter((r) => !r.errors.length && !r.duplicate).map((r) => r.row)),
      ),
  });
  const commit = useMutation({
    mutationFn: () =>
      api<{ imported: number; skipped: number }>("/import/commit", {
        id: preview.data?.id,
        selected: preview.data?.rows
          .filter((r) => selected.has(r.row))
          .map((r) => ({ row: r.row, acknowledgeDuplicate: r.duplicate })),
      }),
    onSuccess: async () => {
      await client.invalidateQueries();
    },
  });
  async function read(file: File | undefined) {
    cleanup();
    setRows([]);
    setFileError(false);
    preview.reset();
    commit.reset();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024 || !/\.(xlsx|csv)$/i.test(file.name)) {
      setFileError(true);
      return;
    }
    setReading(true);
    const worker = new Worker(new URL("./import-worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    const failure = () => {
      cleanup();
      setReading(false);
      setFileError(true);
    };
    worker.onerror = failure;
    worker.onmessage = (event: MessageEvent<{ rows?: string[][]; error?: string }>) => {
      cleanup();
      setReading(false);
      if (!event.data.rows) {
        setFileError(true);
        return;
      }
      const values = event.data.rows;
      setRows(values);
      setMapping(
        Object.fromEntries(
          fields.map((field) => {
            const index = values[0].findIndex(
              (header) => header.trim().toLowerCase() === field.toLowerCase(),
            );
            return [field, index < 0 ? "" : String(index)];
          }),
        ),
      );
    };
    timerRef.current = setTimeout(failure, 10000);
    try {
      const buffer = await file.arrayBuffer();
      if (workerRef.current === worker) worker.postMessage({ name: file.name, buffer }, [buffer]);
    } catch {
      failure();
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>{t("extra.import")}</h1>
          <p>{t("extra.importHint")}</p>
        </div>
      </div>
      <section className="panel padded">
        <label>
          {t("extra.file")}
          <input
            type="file"
            accept=".xlsx,.csv"
            disabled={reading || preview.isPending || commit.isPending}
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </label>
        {reading && <p role="status">{t("loading")}</p>}
        {fileError && <p role="alert">{t("extra.fileError")}</p>}
        {rows.length > 0 && !commit.isSuccess && (
          <>
            <p>{t("extra.mapRequired")}</p>
            <div className="form-grid">
              {fields.map((field) => (
                <label key={field}>
                  {t(field === "createdAt" ? "extra.createdDate" : field)}
                  <select
                    disabled={preview.isPending || commit.isPending}
                    value={mapping[field] ?? ""}
                    onChange={(e) => {
                      setMapping({ ...mapping, [field]: e.target.value });
                      preview.reset();
                      commit.reset();
                    }}
                  >
                    <option value="">{t("extra.skipColumn")}</option>
                    {rows[0].map((header, index) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Worksheet column positions are immutable identifiers, including duplicate/blank headers.
                      <option key={`${index}:${header}`} value={index}>
                        {index + 1}: {header || t("extra.column")}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <p className="fine-print">{t("extra.dateHint")}</p>
            <details>
              <summary>{t("extra.sourceCodes")}</summary>
              {sources.map((source) => (
                <p key={source}>
                  <code>{source}</code> — {t(`sourceLabels.${source}`)}
                </p>
              ))}
            </details>
            <button
              type="button"
              className="button secondary"
              disabled={
                preview.isPending ||
                commit.isPending ||
                fields.slice(0, 3).some((field) => !mapping[field])
              }
              onClick={() => preview.mutate()}
            >
              {t("extra.preview")}
            </button>
          </>
        )}
        <ErrorNotice error={preview.error || commit.error} />
        {preview.data && !commit.isSuccess && (
          <>
            <p>{t("extra.importDuplicateHint")}</p>
            <div className="import-preview">
              <table>
                <thead>
                  <tr>
                    <th>{t("extra.include")}</th>
                    <th>{t("extra.row")}</th>
                    <th>{t("customerName")}</th>
                    <th>{t("phone")}</th>
                    <th>{t("source")}</th>
                    <th>{t("requirement")}</th>
                    <th>{t("extra.createdDate")}</th>
                    <th>{t("extra.validation")}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.data.rows.map((row) => (
                    <tr key={row.row}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`${t("extra.include")} ${row.row}`}
                          disabled={Boolean(row.errors.length) || commit.isPending}
                          checked={selected.has(row.row)}
                          onChange={(e) =>
                            setSelected((previous) => {
                              const next = new Set(previous);
                              if (e.target.checked) next.add(row.row);
                              else next.delete(row.row);
                              return next;
                            })
                          }
                        />
                      </td>
                      <td>{row.row}</td>
                      <td dir="auto">{row.customerName}</td>
                      <td dir="ltr">{row.phone}</td>
                      <td>{row.source}</td>
                      <td dir="auto">{row.requirement}</td>
                      <td dir="ltr">{row.createdAt}</td>
                      <td>
                        {row.errors.length
                          ? row.errors
                              .map((field) =>
                                t(field === "createdAt" ? "extra.createdDate" : field),
                              )
                              .join(", ")
                          : t(row.duplicate ? "extra.duplicate" : "extra.ready")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-footer">
              <span>
                {selected.size} / {preview.data.rows.length}
              </span>
              <button
                type="button"
                className="button primary"
                disabled={!selected.size || commit.isPending}
                onClick={() => commit.mutate()}
              >
                {t("extra.importSelected")}
              </button>
            </div>
          </>
        )}
        {commit.data && (
          <div className="notice success" role="status">
            <p>
              {t("extra.importResult")}: {commit.data.imported} {t("extra.imported")},{" "}
              {commit.data.skipped} {t("extra.skipped")}
            </p>
            <Link to="/leads">{t("viewAll")}</Link>
          </div>
        )}
      </section>
    </>
  );
}

export function ExportButton({ query }: { query: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const download = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/export/leads?${query}`, { credentials: "same-origin" });
      if (!response.ok) {
        const body = await response.json();
        throw new ApiError(body.code);
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "inaya-leads.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onSuccess: () => setOpen(false),
  });
  return (
    <>
      <button
        type="button"
        className="button secondary"
        onClick={() => {
          download.reset();
          setOpen(true);
        }}
      >
        {t("extra.export")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("extra.export")}>
        <p>{t("extra.exportHint")}</p>
        <ErrorNotice error={download.error} />
        <button
          className="button primary"
          type="button"
          disabled={download.isPending}
          onClick={() => download.mutate()}
        >
          {t("extra.export")}
        </button>
      </Modal>
    </>
  );
}
