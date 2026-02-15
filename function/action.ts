import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { downloadAndSave, seeAndCorrect, getStudentStatus,getStudentMessage, getDateFolder, writeLog, waitTimeAndLogCustom, logRunStart, logRunEnd } from './utils';

export async function getPracticalWork(
  page: Page, 
  start_index: number, 
  end_index: number,
  origin: String 
): Promise<void> {

  const data = JSON.parse(
    fs.readFileSync('./data/students.json', 'utf8')
  );

  // 📁 Carpeta raíz de la corrida
  const dateFolder = getDateFolder();

  const entregaKey = `E${dateFolder}`;
  const entregaRaw = process.env[entregaKey]; // "1,INTERNET"

  if (!entregaRaw) {
    throw new Error(`❌ Error ${origin}: No existe la variable de entorno ${entregaKey}`);
  }

  let entregaIndexRaw;
  let entregaTematica;

  if (entregaRaw) {
    [entregaIndexRaw, entregaTematica] = entregaRaw.split(',');
  }

  const entregaIndex = Number(entregaIndexRaw);

  if (Number.isNaN(entregaIndex)) {
    throw new Error(`❌ Error ${origin}: El valor de ${entregaKey} no es un número`);
  }

  console.log(`📌 Usando ${entregaKey} = ${entregaIndex}`);

  const rootDir = path.join('./downloads', dateFolder);
  fs.mkdirSync(rootDir, { recursive: true });

  const logFilePath = path.join(rootDir, 'log.txt');
  logRunStart(logFilePath, `${entregaTematica} [${origin}]`);
  
  const studentsByCommission = data.students;

  // 🔁 Comisiones
  for (const commissionCode of Object.keys(studentsByCommission)) {

    writeLog(logFilePath, ` `);
    writeLog(logFilePath, `========================================`);
    writeLog(logFilePath, `📘 Corrigiendo comisión ${commissionCode}`);
    const studentsInCommission = studentsByCommission[commissionCode];

    const studentIds = Object.keys(studentsInCommission)
      .sort((a, b) => {
        const nameA = studentsInCommission[a].name.toUpperCase();
        const nameB = studentsInCommission[b].name.toUpperCase();
        return nameA.localeCompare(nameB, 'es');
      })
      .slice(start_index, end_index);

    console.log ( `Procesando alumnos ${start_index} a ${end_index - 1} (total: ${studentIds.length})`);
    
    writeLog(
      logFilePath,
      `Procesando alumnos ${start_index} a ${end_index - 1} (total: ${studentIds.length})`
    );

    // 🔁 Estudiantes
    for (const studentId of studentIds) {

      const student = studentsInCommission[studentId];
      const nameStudent = student.name;

      try {
        await page.goto(`/tutoria/alumnos/comision/${commissionCode}`);
        
        console.log ( `Comenzando busqueda práctico de ${nameStudent} (${studentId} [${commissionCode}])`);
        writeLog(logFilePath, '');
        writeLog(logFilePath, `Comenzando busqueda práctico de ${nameStudent} (${studentId} [${commissionCode}])`);

        // 🔍 Verificar link del estudiante
        const studentLink = page.getByRole('link', { name: nameStudent });

        if (await studentLink.count() === 0) {
          writeLog(
            logFilePath,
            `❌ Error ${origin}: El estudiante «${nameStudent}» (${studentId}) - [${commissionCode}] no se pudo encontrar en el resumen de los prácticos.`
          );
          continue;
        }

        await studentLink.click();
        
        await waitTimeAndLogCustom(page, 'Esperando corregir..', 5);

        const corregirLink = page.getByRole('link', { name: '[CORREGIR]' });
        const totalCorrecciones = await corregirLink.count();

        if (totalCorrecciones === 0) {
          writeLog(
            logFilePath,
            `❌ Error ${origin}: No se encontró ningún link [CORREGIR] para «${nameStudent}» (${studentId}) en la comisión ${commissionCode}.`
          );
          await page.goBack();
          continue;
        }

        if (entregaIndex >= totalCorrecciones) {
          console.log(
            `❌ Error ${origin}: El índice ${entregaIndex} (${entregaKey}) supera la cantidad de correcciones (${totalCorrecciones}) para «${nameStudent}» (${studentId}).`
          );
          await page.goBack();
          continue;
        }

        // console.log(`📝 Abriendo corrección #${entregaIndex} (${entregaKey})`);

        await corregirLink.nth(entregaIndex).click();
        
        //await waitTimeAndLogCustom(page, 'Esperando descarga...', 2);

        // ⬇️ Descarga
        const { filePath, fileName } = await downloadAndSave(
          page,
          rootDir,
          commissionCode,
          studentId,
          nameStudent,
          entregaIndex
        );

        // ✅ Validaciones si hubo archivo
        if (filePath) {
          expect(fs.existsSync(filePath)).toBeTruthy();
          expect(fs.statSync(filePath).size).toBeGreaterThan(0);
          writeLog(logFilePath, `✔ Validado OK: ${fileName}`);
        }

        await page.goBack();

      } catch (error) {
        writeLog(
          logFilePath,
          `💥 Error inesperado en ${origin} con ${nameStudent} (${studentId}) en comisión ${commissionCode}: ${String(error)}`
        );
      }
    } 
  }

  logRunEnd(logFilePath);
}

export async function seePracticalWork(
  page: Page,
  start_index: number,
  end_index: number,
  origin: string
): Promise<void> {

  const data = JSON.parse(
    fs.readFileSync('./data/students.json', 'utf8')
  );

  const dateFolder = getDateFolder();
  const entregaKey = `E${dateFolder}`;
  const entregaRaw = process.env[entregaKey];

  if (!entregaRaw) {
    throw new Error(`❌ Error ${origin}: No existe ${entregaKey}`);
  }

  const [entregaIndexRaw, entregaTematica] = entregaRaw.split(',');
  const entregaIndex = Number(entregaIndexRaw);

  if (Number.isNaN(entregaIndex)) {
    throw new Error(`❌ Error ${origin}: ${entregaKey} inválido`);
  }

  const rootDir = path.join('./downloads', dateFolder);
  fs.mkdirSync(rootDir, { recursive: true });

  const logFilePath = path.join(rootDir, 'log.txt');
  logRunStart(logFilePath, `${entregaTematica} [${origin}]`);

  const studentsByCommission = data.students;

  for (const commissionCode of Object.keys(studentsByCommission)) {

    writeLog(logFilePath, ` `);
    writeLog(logFilePath, `========================================`);
    writeLog(logFilePath, `📘 Corrigiendo comisión ${commissionCode}`);

    const studentsInCommission = studentsByCommission[commissionCode];

    const studentIds = Object.keys(studentsInCommission)
      .sort((a, b) =>
        studentsInCommission[a].name.localeCompare(
          studentsInCommission[b].name,
          'es'
        )
      )
      .slice(start_index, end_index);

    writeLog(
      logFilePath,
      `👥 Alumnos ${start_index} a ${end_index - 1} (total: ${studentIds.length})`
    );

    for (const studentId of studentIds) {

      const student = studentsInCommission[studentId];
      const nameStudent = student.name;

      const estado = getStudentStatus(
        rootDir,
        commissionCode,
        studentId,
        entregaIndex
      );

      if (!estado) {
        writeLog(
          logFilePath,
          `⚠️ Sin estado para ${nameStudent} (${studentId}) — se omite`
        );
        continue;
      }

      const message = getStudentMessage(
        rootDir,
        commissionCode,
        studentId,
        entregaIndex
      );

      await page.goto(`/tutoria/alumnos/comision/${commissionCode}`);
      console.log ( `Comenzando corrección práctico de ${nameStudent} (${studentId} [${commissionCode}])`);
      writeLog(logFilePath, '');
      writeLog(logFilePath, `Comenzando corrección práctico de ${nameStudent} (${studentId} [${commissionCode}])`);

      await waitTimeAndLogCustom(page, 'Esperando listado alumno..', 2);

      // 🔍 Verificar link del estudiante
      const studentLink = page.getByRole('link', { name: nameStudent });

      if (await studentLink.count() === 0) {
        writeLog(
          logFilePath,
          `❌ Error ${origin}: El estudiante «${nameStudent}» (${studentId}) - [${commissionCode}] no se pudo encontrar en el resumen de los prácticos.`
        );
        continue;
      }

      await studentLink.click();
      await waitTimeAndLogCustom(page, 'Esperando corregir..', 2);   

      const corregirLink = page.getByRole('link', { name: '[CORREGIR]' });
      const totalCorrecciones = await corregirLink.count();

      if (totalCorrecciones === 0) {
        writeLog(
          logFilePath,
          `❌ Error ${origin}: No se encontró ningún link [CORREGIR] para «${nameStudent}» (${studentId}) en la comisión ${commissionCode}.`
        );
        await page.goBack();
        continue;
      }

      if (entregaIndex >= totalCorrecciones) {
        console.log(
          `❌ Error ${origin}: El índice ${entregaIndex} (${entregaKey}) supera la cantidad de correcciones (${totalCorrecciones}) para «${nameStudent}» (${studentId}).`
        );
        await page.goBack();
        continue;
      }

      // console.log(`📝 Abriendo corrección #${entregaIndex} (${entregaKey})`);
      await corregirLink.nth(entregaIndex).click();

      try {
        await seeAndCorrect(
          page,
          rootDir,
          commissionCode,
          studentId,
          nameStudent,
          estado,
          logFilePath,
          message,
          entregaIndex
        );
      } catch (error) {
        writeLog(
          logFilePath,
          `💥 Error ${origin} con ${nameStudent} (${studentId}): ${String(error)}`
        );
      }
    }
  }

  logRunEnd(logFilePath);
}

export async function setAbisenceInTeam(
  page: Page,
  start_index: number,
  end_index: number,
  origin: string
): Promise<void> {

  const data = JSON.parse(
    fs.readFileSync('./data/team.json', 'utf8')
  );

  const dateFolder = getDateFolder();
  const entregaKey = `E${dateFolder}`;
  const entregaRaw = process.env[entregaKey];

  if (!entregaRaw) {
    throw new Error(`❌ Error ${origin}: No existe ${entregaKey}`);
  }

  const [entregaIndexRaw, entregaTematica] = entregaRaw.split(',');
  const entregaIndex = Number(entregaIndexRaw);

  if (Number.isNaN(entregaIndex)) {
    throw new Error(`❌ Error ${origin}: ${entregaKey} inválido`);
  }

  const rootDir = path.join('./downloads', dateFolder);
  fs.mkdirSync(rootDir, { recursive: true });

  const logFilePath = path.join(rootDir, 'log.txt');
  logRunStart(logFilePath, `${entregaTematica} [${origin}]`);

  const studentsByCommission = data.students;
  
  // await waitTimeAndLogCustom(page, `Inicio inhabilitación`,5);

  for (const commissionCode of Object.keys(studentsByCommission)) {

    writeLog(logFilePath, ` `);
    writeLog(logFilePath, `========================================`);
    writeLog(logFilePath, `📘 Inhabilitando en comisión ${commissionCode}`);

    const studentsInCommission = studentsByCommission[commissionCode];

    const studentIds = Object.keys(studentsInCommission)
      .sort((a, b) =>
        studentsInCommission[a].name.localeCompare(
          studentsInCommission[b].name,
          'es'
        )
      )
      .slice(start_index, end_index);

    writeLog(
      logFilePath,
      `👥 Alumnos ${start_index} a ${end_index - 1} (total: ${studentIds.length})`
    );

    for (const studentId of studentIds) {

        const student = studentsInCommission[studentId];
        const nameStudent = student.name;

        const estado = getStudentStatus(
          rootDir,
          commissionCode,
          studentId,
          entregaIndex
        );

        if (!estado) {
          writeLog(
            logFilePath,
            `⚠️ Sin estado para ${nameStudent} (${studentId}) — se omite`
          );
          continue;
        }

        if (estado === '0') {
              await page.goto(`/tutoria/alumnos/comision/${commissionCode}`);

              // 🔍 Verificar link del estudiante
              const row = page.locator('tr', {
                  has: page.locator('a.link', { hasText: nameStudent })
              });

              if (await row.count() === 0) {
                writeLog(
                  logFilePath,
                  `❌ El estudiante «${nameStudent}» (${studentId}) - [${commissionCode}] no se pudo encontrar en el resumen de los prácticos.`
                );
              }

              await row.locator('.botonHabilitarAlumno').click();

             // Verificar si aparece el textbox
              const messageBox = page.getByRole('textbox', {
                name: 'Ingrese aquí su mensaje...'
              });

              if (await messageBox.count() === 0) {
                writeLog(
                  logFilePath,
                  `❌ No se pudo mostrar el cuadro de mensaje para «${nameStudent}» (${studentId}) - [${commissionCode}]. Se cancela la operación.`
                );
                await page.getByRole('link', { name: 'Cancelar' }).click();
              } else {
                await messageBox.fill(
                  'Se deshabilita por entrega de TPs fuera de termino.'
                );
                await page.getByRole('link', { name: 'Aceptar' }).click();
                writeLog(logFilePath, `⚠️  Alumno ${nameStudent} INHABILITADO`);
              }   
              await waitTimeAndLogCustom(page, `Fin de inhabilitación`,5);
        } else {
          writeLog(
            logFilePath,
            `ℹ️  El estudiante «${nameStudent}» (${studentId}) - [${commissionCode}] no se inhabilita,  estado=${estado}.`
          );          
        }  
    }    
  }

}      



