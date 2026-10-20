import { z } from "zod";

export const roles = ["owner", "admin", "manager", "staff"] as const;
export const statuses = [
  "new",
  "contacted",
  "follow_up",
  "interested",
  "converted",
  "lost",
] as const;
export const sources = [
  "google_ads",
  "whatsapp",
  "call",
  "facebook",
  "instagram",
  "website",
  "referral",
  "other",
] as const;
export const lostReasons = [
  "price",
  "unavailable",
  "competitor",
  "not_needed",
  "no_response",
  "other",
] as const;
export const roleSchema = z.enum(roles);
export const statusSchema = z.enum(statuses);
export const languageSchema = z.enum(["en", "ar"]);
export const accountInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    email: z
      .email()
      .max(254)
      .transform((email) => email.toLowerCase()),
    password: z.string().min(12).max(128),
    role: roleSchema,
  })
  .strict();
export const leadInput = z
  .object({
    customerName: z.string().trim().min(1).max(160),
    phone: z.string().trim().min(5).max(40),
    source: z.enum(sources),
    requirement: z.string().trim().max(5000).default(""),
    acknowledgeDuplicate: z.boolean().default(false),
  })
  .strict();
export const versionInput = z.object({ version: z.number().int().positive() });
export const assignmentInput = versionInput
  .extend({
    assigneeId: z.string().min(1).max(100),
    nextFollowUpAt: z.iso.datetime({ offset: true }),
  })
  .strict();
export const updateInput = versionInput
  .extend({
    status: statusSchema,
    nextFollowUpAt: z.iso.datetime({ offset: true }).nullable(),
    lostReason: z.enum(lostReasons).nullable().default(null),
    lostExplanation: z.string().trim().max(2000).default(""),
    reopenReason: z.string().trim().max(2000).default(""),
  })
  .strict();
export const commentInput = z.object({ body: z.string().trim().min(1).max(5000) }).strict();
export const editLeadInput = leadInput
  .extend({
    version: z.number().int().positive(),
    reason: z.string().trim().min(1).max(2000),
  })
  .strict();
export const archiveInput = versionInput
  .extend({
    archived: z.boolean(),
    reason: z.string().trim().min(1).max(2000),
    nextFollowUpAt: z.iso.datetime({ offset: true }).optional(),
  })
  .strict();
export const listInput = z.object({
  q: z.string().trim().max(100).default(""),
  status: statusSchema.optional(),
  source: z.enum(sources).optional(),
  assignee: z.string().max(100).optional(),
  due: z.enum(["today", "overdue", "unassigned"]).optional(),
  archived: z.enum(["yes", "no"]).default("no"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type Role = z.infer<typeof roleSchema>;
export type Status = z.infer<typeof statusSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Member = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  language: Language;
};
export type Lead = {
  id: string;
  customerName: string;
  phone: string;
  source: (typeof sources)[number];
  requirement: string;
  status: Status;
  assigneeId: string | null;
  assigneeName: string | null;
  nextFollowUpAt: string | null;
  lostReason: (typeof lostReasons)[number] | null;
  lostExplanation: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceRevision: number;
  archivedAt: string | null;
  archiveReason: string | null;
};
export type Activity = {
  id: string;
  kind: string;
  actorName: string;
  createdAt: string;
  detail: {
    status?: Status;
    assigneeName?: string;
    nextFollowUpAt?: string | null;
    reason?: string;
    lostReason?: string;
    before?: Record<string, string>;
    after?: Record<string, string>;
  };
};
export type LeadDetail = Lead & {
  comments: {
    id: string;
    body: string;
    authorName: string;
    authorId: string;
    sourceRevision: number;
    createdAt: string;
  }[];
  activities: Activity[];
};
export type Dashboard = {
  total: number;
  unassigned: number;
  overdue: number;
  today: number;
  converted: number;
  lost: number;
};
