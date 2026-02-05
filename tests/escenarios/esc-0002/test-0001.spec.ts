import { test, chromium } from '@playwright/test';
import { login } from '../../../function/login';
import { seePracticalWork } from '../../../function/action';

test.setTimeout(90000);

const storageFile = './tests/storage/auth.json';

test('Login', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page);
  await context.storageState({ path: storageFile });

  await browser.close();
});

test('Corregir practicos.', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: storageFile,
  });

  const page = await context.newPage();
  await seePracticalWork(page, 0, 5,'test-0001');

});
