import { mkdirSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const username = process.env.E2E_USERNAME ?? "admin";
const password = process.env.E2E_PASSWORD ?? "";
const reportDir =
  process.env.E2E_REPORT_DIR ??
  "../docs/superpowers/test-reports/2026-06-13-support-workbench";

mkdirSync(reportDir, { recursive: true });

test.use({
  launchOptions: {
    channel: "chrome",
  },
});

async function screenshot(page: Page, name: string) {
  await page.screenshot({
    path: `${reportDir}/${name}.png`,
    fullPage: true,
  });
}

async function login(page: Page) {
  await page.goto(`${baseUrl}/workbench/`);
  await expect(page).toHaveURL(/\/dashboard\/login/);
  await screenshot(page, "01-login-redirect");

  await page.locator("#username").fill(username);
  await page.locator("#password").fill(password);
  await screenshot(page, "02-login-filled");

  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes("/api/auth/login") && response.status() === 200,
    { timeout: 15000 },
  );
  await page.locator('form button[type="submit"]').click();
  const loginResponse = await loginResponsePromise;
  console.log("login response", loginResponse.status(), loginResponse.url());

  await page.waitForURL((url) => !url.pathname.startsWith("/dashboard/login"), {
    timeout: 15000,
  });
  await expect
    .poll(() => page.evaluate(() => Boolean(window.localStorage.getItem("agent-desk-session"))))
    .toBe(true);
}

async function expectWorkbenchRealtimeOnline(page: Page) {
  await expect(page.getByText(/平台实时：在线|Realtime: online/)).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/平台实时：已断开|Realtime: disconnected/)).toHaveCount(0);
}

test.describe("support workbench", () => {
  test("logs in and switches between workbench and dashboard", async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on("pageerror", (error) => {
      runtimeErrors.push(error.stack || error.message);
    });
    page.on("console", (message) => {
      if (message.type() === "error") {
        runtimeErrors.push(message.text());
      }
    });

    await login(page);
    await page.goto(`${baseUrl}/workbench/`);
    await page.waitForLoadState("networkidle");
    await screenshot(page, "03-workbench-initial");
    await expectWorkbenchRealtimeOnline(page);

    await expect(page.getByText(/客服工作台|Support Workbench/).first()).toBeVisible();
    const conversationsEntry = page.getByRole("link", { name: /会话|Conversations/ }).first();
    const ticketsEntry = page.getByRole("link", { name: /工单|Tickets/ }).first();
    await expect(conversationsEntry).toHaveAttribute(
      "href",
      "/workbench/",
    );
    await expect(ticketsEntry).toHaveAttribute(
      "href",
      "/workbench/tickets/",
    );
    await expect(conversationsEntry).toHaveClass(/bg-sidebar-primary/);
    await expect(ticketsEntry).not.toHaveClass(/bg-sidebar-primary/);
    await conversationsEntry.hover();
    await expect(page.getByText(/会话|Conversations/).last()).toBeVisible();
    await screenshot(page, "04-workbench-rail-tooltip");
    await page.getByRole("button", { name: /贝壳AGENT|Agent Desk|Crove Desk/i }).first().hover();
    await expect(page.getByRole("menuitem", { name: /管理后台|Admin Dashboard/ })).toBeVisible();
    await page.waitForTimeout(300);
    await screenshot(page, "05-workbench-switcher-open");

    await page.getByRole("menuitem", { name: /管理后台|Admin Dashboard/ }).click();
    await page.waitForURL(/\/dashboard\/?$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await screenshot(page, "06-dashboard-after-switch");
    await expect(page.getByText(/管理后台|Admin Dashboard/).first()).toBeVisible();

    await page.getByRole("button", { name: /贝壳AGENT|Agent Desk|Crove Desk/i }).first().click();
    await expect(page.getByRole("menuitem", { name: /客服工作台|Support Workbench/ })).toBeVisible();
    await page.waitForTimeout(300);
    await screenshot(page, "07-dashboard-switcher-open");
    await page.getByRole("menuitem", { name: /客服工作台|Support Workbench/ }).click();
    await page.waitForURL(/\/workbench\/?$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await screenshot(page, "08-workbench-after-return");
    await expect(page.getByText(/客服工作台|Support Workbench/).first()).toBeVisible();

    const returnedConversationsEntry = page.getByRole("link", { name: /会话|Conversations/ }).first();
    const returnedTicketsEntry = page.getByRole("link", { name: /工单|Tickets/ }).first();
    await returnedTicketsEntry.click();
    await page.waitForURL(/\/workbench\/tickets\/?$/, { timeout: 15000 });
    await page.waitForLoadState("networkidle");
    await expect(returnedTicketsEntry).toHaveClass(/bg-sidebar-primary/);
    await expect(returnedConversationsEntry).not.toHaveClass(/bg-sidebar-primary/);
    await expectWorkbenchRealtimeOnline(page);
    await page.mouse.move(640, 360);
    await screenshot(page, "09-workbench-tickets-active");

    expect(runtimeErrors).toEqual([]);
  });
});
