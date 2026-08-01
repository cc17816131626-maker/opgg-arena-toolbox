import { expect, test } from "@playwright/test";

test.describe("核心路径冒烟", () => {
  test("首页 → 搜索 → 详情 → 设置", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.getByRole("heading", { name: "全部英雄" })).toBeVisible({ timeout: 30_000 });

    const search = page.getByPlaceholder("搜索英雄名 / 拼音…");
    await search.fill("亚索");
    await page.getByRole("button", { name: /亚索/ }).first().click();
    await expect(page.getByRole("heading", { name: /亚索/ })).toBeVisible();

    await page.getByRole("link", { name: /设置/ }).click();
    await expect(page.getByRole("heading", { name: "设置" })).toBeVisible();
    await expect(page.getByText("数据版本")).toBeVisible();
  });

  test("强度榜与命令面板可打开", async ({ page }) => {
    await page.goto("/#/tier-list");
    await expect(page.getByRole("heading", { name: "英雄强度榜" })).toBeVisible({ timeout: 30_000 });

    await page.goto("/#/");
    await page.keyboard.press(process.platform === "darwin" ? "Meta+KeyK" : "Control+KeyK");
    await expect(page.getByRole("dialog", { name: "搜索英雄" })).toBeVisible();
  });
});
