import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const fixture = () => JSON.parse(readFileSync(".local/e2e-fixture.json", "utf8"));
async function signIn(page, role) {
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill(fixture().people[role].email);
  await page.getByLabel("Password", { exact: true }).fill(fixture().password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A clearer day, a closer team." })).toBeVisible();
}
test("manager captures and assigns; staff updates, comments and switches independently to Arabic", async ({
  browser,
}) => {
  const managerContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const manager = await managerContext.newPage();
  const staff = await staffContext.newPage();
  const errors = [];
  manager.on("pageerror", (error) => errors.push(error.message));
  staff.on("pageerror", (error) => errors.push(error.message));
  await signIn(manager, "manager");
  await manager.screenshot({ path: ".local/preview/overview-en.png", fullPage: true });
  await manager.getByRole("link", { name: "Add lead", exact: true }).click();
  await manager.getByLabel("Customer name", { exact: true }).fill("Browser test عميل");
  await manager.getByLabel("Phone number", { exact: true }).fill("+971 50 987 6543");
  await manager
    .getByRole("dialog")
    .getByRole("combobox", { name: "Lead source", exact: true })
    .selectOption("call");
  await manager
    .getByLabel("Requirement / customer message")
    .fill("<script>window.pwned = true</script> أحتاج عاملة منزلية");
  await manager.getByRole("button", { name: "Create lead", exact: true }).click();
  await expect(
    manager.getByRole("heading", { name: "Browser test عميل", exact: true }),
  ).toBeVisible();
  const leadUrl = manager.url();
  const assignment = manager
    .locator("section")
    .filter({ has: manager.getByRole("heading", { name: "Assignment", exact: true }) });
  await assignment
    .getByRole("combobox", { name: "Assigned to", exact: true })
    .selectOption(fixture().people.staff.id);
  await assignment.getByLabel("Next follow-up", { exact: true }).fill("2099-10-20T10:30");
  await assignment.getByRole("button", { name: "Assign lead", exact: true }).click();
  await expect(manager.getByText("Maryam Hassan", { exact: true }).first()).toBeVisible();
  await signIn(staff, "staff");
  await staff.goto(leadUrl);
  await expect(staff.getByRole("heading", { name: "Browser test عميل" })).toBeVisible();
  await staff
    .getByLabel("Comments", { exact: true })
    .fill("تم التواصل مع العميل. Follow-up confirmed.");
  await staff.getByRole("button", { name: "Add comment", exact: true }).click();
  await expect(
    staff.getByText("تم التواصل مع العميل. Follow-up confirmed.", { exact: true }),
  ).toBeVisible();
  const progress = staff
    .locator("section")
    .filter({ has: staff.getByRole("heading", { name: "Update progress", exact: true }) });
  await progress.getByRole("combobox", { name: "Status", exact: true }).selectOption("interested");
  await progress.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(staff.locator(".detail-heading .badge")).toHaveText("Interested");
  await staff.getByRole("button", { name: "العربية", exact: true }).click();
  await expect(staff.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(staff.getByRole("heading", { name: "تفاصيل الاستفسار", exact: true })).toBeVisible();
  await expect(staff.locator(".phone-link")).toContainText("+971509876543");
  await expect(
    staff.getByText("<script>window.pwned = true</script> أحتاج عاملة منزلية", { exact: true }),
  ).toBeVisible();
  expect(await staff.evaluate(() => window.pwned)).toBeUndefined();
  await expect(manager.locator("html")).toHaveAttribute("dir", "ltr");
  await staff.screenshot({ path: ".local/preview/lead-ar.png", fullPage: true });
  await staff.reload();
  await expect(staff.locator("html")).toHaveAttribute("dir", "rtl");
  await manager.reload();
  await manager
    .getByRole("combobox", { name: "Assigned to", exact: true })
    .selectOption(fixture().people.other.id);
  await manager.getByRole("button", { name: "Assign lead", exact: true }).click();
  await expect(manager.locator(".detail-metadata")).toContainText("Omar Ali");
  await staff.reload();
  await expect(staff.getByRole("alert")).toContainText("لم يعد مسنداً إليك");
  expect(errors).toEqual([]);
  await managerContext.close();
  await staffContext.close();
});
test("admin can create individual accounts; reporting renders without fabricated percentages", async ({
  page,
}) => {
  await signIn(page, "admin");
  await page.getByRole("link", { name: "Team", exact: true }).click();
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Full name", { exact: true }).fill("New team member");
  await dialog.getByLabel("Email address", { exact: true }).fill("newmember@example.test");
  await dialog.getByLabel(/^Password/).fill(fixture().password);
  await dialog.getByRole("combobox", { name: "Role", exact: true }).selectOption("staff");
  await dialog.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByText("newmember@example.test", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Reports", exact: true }).click();
  await expect(page.getByRole("heading", { name: "By source" })).toBeVisible();
  await expect(
    page.getByText("First booking confirmations", { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({ path: ".local/preview/reports-en.png", fullPage: true });
});
test("duplicate warning requires explicit acknowledgement and preserves both enquiries", async ({
  page,
}) => {
  await signIn(page, "manager");
  await page.getByRole("link", { name: "Add lead", exact: true }).click();
  await page.getByLabel("Customer name", { exact: true }).fill("Repeat enquiry");
  await page.getByLabel("Phone number", { exact: true }).fill("+971501234560");
  await page
    .getByRole("dialog")
    .getByRole("combobox", { name: "Lead source", exact: true })
    .selectOption("referral");
  await page.getByRole("button", { name: "Create lead", exact: true }).click();
  await expect(
    page.getByText("This phone number already has a lead.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("checkbox", { name: "Create a separate enquiry" }).check();
  await page.getByRole("button", { name: "Create lead", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Repeat enquiry", exact: true })).toBeVisible();
});
