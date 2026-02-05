import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://mieldocentes.unlam.edu.ar/principal/home/');
  await page.getByRole('textbox', { name: 'Usuario:' }).click();
  await page.getByRole('textbox', { name: 'Usuario:' }).fill('27283004');
  await page.getByRole('textbox', { name: 'Contraseña:' }).click();
  await page.getByRole('textbox', { name: 'Contraseña:' }).fill('primavera0');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.getByRole('link', { name: 'Tutoría' }).nth(2).click();
  await page.getByRole('link', { name: 'GALLEGO, RODRIGO NAHUEL' }).click();
  await page.getByRole('link', { name: '[CORREGIR]' }).first().click();
  await page.getByLabel('Estado:').selectOption('3');
  await page.getByRole('textbox', { name: 'Calificación (opcional):' }).click();
  await page.getByRole('link', { name: 'Enviar corrección' }).click();
  await page.getByRole('link', { name: 'Enviar corrección' }).click();
});