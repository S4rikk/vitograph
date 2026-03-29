import { test as setup, expect } from '@playwright/test';
import * as path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  
  await page.getByPlaceholder('Email address').fill('test1@test.com');
  await page.getByPlaceholder('Password').fill('12332100');
  
  await page.getByRole('button', { name: 'Sign in' }).click();
  
  // Wait for navigation or specific element to ensure authentication is complete
  await page.waitForURL('/');
  
  // Save storage state to a file
  await page.context().storageState({ path: authFile });
});
