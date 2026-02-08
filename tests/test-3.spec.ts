import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://mieldocentes.unlam.edu.ar/principal/home/');
  await page.getByRole('textbox', { name: 'Usuario:' }).click();
  await page.getByRole('textbox', { name: 'Usuario:' }).fill('27283004');
  await page.getByRole('textbox', { name: 'Contraseña:' }).click();
  await page.getByRole('textbox', { name: 'Contraseña:' }).fill('primavera0');
  await page.getByRole('textbox', { name: 'Contraseña:' }).press('Enter');
  await page.getByRole('link', { name: 'Tutoría' }).nth(3).click();
  await page.getByRole('link', { name: 'AGUILAR, FLORENCIA MICAELA' }).click();
  await page.getByRole('link', { name: '[CORREGIR]' }).first().click();
  await page.getByRole('checkbox', { name: 'Notificar al alumno/a por' }).check();
});