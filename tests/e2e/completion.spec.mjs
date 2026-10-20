import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { workbook } from "../workbook.mjs";

const fixture = () => JSON.parse(readFileSync(".local/e2e-fixture.json", "utf8"));
async function signIn(page, role) {
  await page.goto("/");
  await page.getByLabel("Email address", { exact: true }).fill(fixture().people[role].email);
  await page.getByLabel("Password", { exact: true }).fill(fixture().password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A clearer day, a closer team." })).toBeVisible();
}
test("manager previews CSV, imports once, edits details/comments and archives/restores", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await signIn(page, "manager");
  await page.goto("/import");
  await page.getByLabel("Spreadsheet file").setInputFiles({
    name: "leads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      'customerName,phone,source,requirement,createdAt\nImport browser,+971508765432,call,"Customer message,\nsecond line عربي",2020-01-02\nInvalid phone,no,call,,\n',
    ),
  });
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.getByRole("checkbox", { name: "Include 2", exact: true })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Include 3", exact: true })).toBeDisabled();
  await page.screenshot({ path: ".local/preview/import-preview.png", fullPage: true });
  await page.getByRole("button", { name: "Import selected rows" }).click();
  await expect(page.getByRole("status")).toContainText("Import completed");
  await page.goto("/leads?q=508765432");
  await page.getByRole("link", { name: "Enquiry details: Import browser", exact: true }).click();
  await page.getByRole("button", { name: "Edit lead details", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Customer name", { exact: true }).fill("Edited browser import");
  await dialog.getByLabel("Reason for change").fill("Customer corrected name");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Edited browser import" })).toBeVisible();
  await page.getByLabel("Comments", { exact: true }).fill("Original comment");
  await page.getByRole("button", { name: "Add comment", exact: true }).click();
  await page.getByRole("button", { name: "Edit my comment" }).click();
  await dialog.getByRole("textbox", { name: "Comments", exact: true }).fill("Revised comment");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.locator("article.comment")).toContainText("Revised comment");
  await page.getByRole("button", { name: "Archive lead", exact: true }).click();
  await dialog.getByLabel("Reason for change").fill("Duplicate review complete");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Restore lead", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add comment", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Restore lead", exact: true }).click();
  await dialog.getByLabel("Reason for change").fill("New enquiry received");
  await dialog.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByRole("button", { name: "Archive lead", exact: true })).toBeVisible();
  await page.screenshot({ path: ".local/preview/completion-history.png", fullPage: true });
  expect(errors).toEqual([]);
});
test("admin issues a private reset link, user resets password and admin exports CSV", async ({
  page,
  browser,
}) => {
  await signIn(page, "admin");
  await page.goto("/team");
  const person = page.getByRole("row").filter({ hasText: fixture().people.other.email });
  await person.getByRole("button", { name: "Issue password reset link" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Current password", { exact: true }).fill(fixture().password);
  await dialog.getByRole("button", { name: "Issue password reset link" }).click();
  const privateLink = await dialog
    .getByRole("textbox", { name: "Private reset link", exact: true })
    .inputValue();
  const context = await browser.newContext();
  const target = await context.newPage();
  // Test server runs at a separate origin; replace only the origin, preserving the private fragment.
  const targetUrl = new URL(privateLink);
  targetUrl.port = "4311";
  await target.goto(targetUrl.toString());
  await expect(target.getByRole("heading", { name: "Reset password" })).toBeVisible();
  await expect(target).toHaveURL(/\/reset$/);
  await target.getByLabel("New password", { exact: true }).fill(`${fixture().password}-new`);
  await target
    .getByLabel("Confirm new password", { exact: true })
    .fill(`${fixture().password}-new`);
  await target.getByRole("button", { name: "Reset password", exact: true }).click();
  await expect(target.getByRole("status")).toContainText("Password");
  await context.close();
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await page.goto("/leads");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("dialog").getByRole("button", { name: "Export CSV", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe("inaya-leads.csv");
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Database backups" })).toBeVisible();
});
test("XLSX worker reads first worksheet and malformed workbooks fail safely", async ({ page }) => {
  await signIn(page, "manager");
  await page.goto("/import");
  await page.getByLabel("Spreadsheet file").setInputFiles({
    name: "leads.xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer: workbook(),
  });
  await page.getByRole("button", { name: "Validate preview" }).click();
  await expect(page.getByRole("cell", { name: "Excel import عربي", exact: true })).toBeVisible();
  await expect(
    page.getByRole("cell", { name: "2020-02-02T20:00:00.000Z", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Spreadsheet file").setInputFiles({
    name: "broken.xlsx",
    mimeType: "application/octet-stream",
    buffer: Buffer.from("not a workbook"),
  });
  await expect(page.getByRole("alert")).toContainText("Could not read this file");
});
