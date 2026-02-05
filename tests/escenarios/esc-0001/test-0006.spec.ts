import { test, chromium } from '@playwright/test';
import { login } from '../../../function/login';
import { getPracticalWork } from '../../../function/action';

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

test('Descargar practicos.', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: storageFile,
    acceptDownloads: true, // 🔴 importante
  });

  const page = await context.newPage();
  await getPracticalWork(page,25, 30, 'test-0006');
});
