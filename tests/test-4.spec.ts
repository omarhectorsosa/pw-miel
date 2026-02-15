import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://mieldocentes.unlam.edu.ar/principal/home/');
  await page.getByRole('textbox', { name: 'Usuario:' }).click();
  await page.getByRole('textbox', { name: 'Usuario:' }).fill('27283004');
  await page.getByRole('textbox', { name: 'Contraseña:' }).click();
  await page.getByRole('textbox', { name: 'Contraseña:' }).fill('primavera0');
  await page.getByRole('textbox', { name: 'Contraseña:' }).press('Enter');
  await page.goto('https://mieldocentes.unlam.edu.ar/tutoria/alumnos/comision/30101472');
  await page.locator('#fila_93360 > td:nth-child(6) > .botonHabilitarAlumno').click();
  await page.getByRole('textbox', { name: 'Ingrese aquí su mensaje...' }).click();
  await page.getByRole('textbox', { name: 'Ingrese aquí su mensaje...' }).fill('Se deshabilita por entrega de TPs fuera de termino.');
  await page.getByRole('link', { name: 'Aceptar' }).click();
  await page.getByRole('link', { name: 'Aceptar' }).click();
});