import { test, expect } from '@playwright/test';

test.describe('AI Assistant', () => {
  test('should allow chatting with the assistant and receiving an answer', async ({ page }) => {
    // 1. Log in via setup (storage state used) and go to the page containing the assistant
    await page.goto('/?tab=assistant'); 
    
    // Check if the AI view is present
    await expect(page.getByPlaceholder('Задайте вопрос о здоровье...')).toBeVisible({ timeout: 10000 });

    // 2. Type the message
    await page.getByPlaceholder('Задайте вопрос о здоровье...').fill('Привет, сколько калорий я сегодня съел?');
    
    // 3. Submit
    await page.getByRole('button', { name: 'Отправить' }).click();

    // 4. Verify message added to UI
    await expect(page.getByText('Привет, сколько калорий я сегодня съел?').first()).toBeVisible();

    // 5. Wait for the Assistant response. We check that at least one assistant message exists and differs from the welcome message or contains some typical response characters. 
    // The "bg-cloud-light" class indicates an assistant message. We expect the latest one to appear.
    // Instead of waiting for specific text, we can wait for the loading indicator to disappear.
    await expect(page.locator('.animate-bounce').first()).toBeHidden({ timeout: 300000 });

    // Ensure the message list contains a response to our query
    // We get the last assistant message and ensure it has text
    const chatContainer = page.locator('.assistant-content').last();
    await expect(chatContainer).toBeVisible({ timeout: 10000 });
    
    const textContent = await chatContainer.textContent();
    expect(textContent?.length).toBeGreaterThan(10);
  });
});
