import { test, chromium } from '@playwright/test';
import { login } from '../../../function/login';
import { setAbisenceInTeam } from '../../../function/action';

test.setTimeout(1000000);

const storageFile = './tests/storage/auth.json';

test('Login', async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await login(page);
  await context.storageState({ path: storageFile });

  await browser.close();
});

test('Marcar ausente en comisión TEAM.', async ({ browser }) => {
  const context = await browser.newContext({
    storageState: storageFile,
  });

  const page = await context.newPage();
  await setAbisenceInTeam(page, 45, 50,'test-0010');

});