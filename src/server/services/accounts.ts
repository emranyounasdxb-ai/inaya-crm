import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { z } from "zod";
import type { accountInput } from "../../shared/contracts.ts";
import type { Database } from "../db/index.ts";
import { account, activities, user } from "../db/schema.ts";

export async function createAccount(
  db: Database,
  input: z.infer<typeof accountInput>,
  actorId?: string,
) {
  const id = randomUUID();
  const password = await hashPassword(input.password);
  return db.transaction(async (tx) => {
    const [member] = await tx
      .insert(user)
      .values({
        id,
        name: input.name,
        email: input.email,
        role: input.role,
      })
      .returning({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        active: user.active,
        language: user.language,
      });
    await tx
      .insert(account)
      .values({ id: randomUUID(), accountId: id, providerId: "credential", userId: id, password });
    await tx.insert(activities).values({
      id: randomUUID(),
      actorId: actorId ?? id,
      kind: "account_created",
      detail: { userId: id, role: input.role },
    });
    return member;
  });
}
