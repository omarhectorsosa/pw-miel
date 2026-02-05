import { Page } from '@playwright/test';

import fs from 'fs';

import { waitTimeAndLogCustom } from './utils';

export async function login(page: Page): Promise<void> {

    /** Crea contxto */
    const userObject = JSON.parse(fs.readFileSync('./data/users.json', 'utf8'));
    const user_name = userObject.users.admin.name;
    const user_password = userObject.users.admin.password;
    
    /** Inicio de navegacion */
    await page.goto(`/`);
    await page.getByRole('textbox', { name: 'Usuario:' }).fill(user_name);
    await page.getByRole('textbox', { name: 'Contraseña:' }).fill(user_password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    /** Fin de navegacion*/
    
    await waitTimeAndLogCustom(page, 'LOGIN: Sesión iniciada correctamente.', 5);
   
}


