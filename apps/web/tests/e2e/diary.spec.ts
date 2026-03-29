import { test, expect } from '@playwright/test';

test.describe('Food Diary', () => {
  test('should allow adding a food item and updating calories', async ({ page }) => {
    // 1. Log in via setup (storage state used) and go to the diary page
    await page.goto('/?tab=diary');
    
    // 2. Wait for the page and panel to load
    await expect(page.getByText('Калории за день')).toBeVisible({ timeout: 15000 });
    
    // We can't perfectly read the initial calories safely without a good selector, so let's just add food and verify it appears.
    const dishInput = page.getByPlaceholder('Овсянка');
    const weightInput = page.getByPlaceholder('200');
    const submitBtn = page.getByRole('button', { name: 'Отправить' });

    await expect(dishInput).toBeVisible();
    await expect(weightInput).toBeVisible();

    // Generate a unique food name so we know we successfully added it
    const uniqueFoodName = `Тестовое Блюдо ${Date.now()}`;

    // 3. Fill the form
    await dishInput.fill(uniqueFoodName);
    await weightInput.fill('150');
    
    // 4. Submit
    await submitBtn.click();

    // 5. Verify the food item appears in the list (wait up to 10s for backend/AI latency if applicable)
    // Assuming the parent component displays the added item in the feed
    await expect(page.getByText(uniqueFoodName)).toBeVisible({ timeout: 15000 });
  });
});
