import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { downloadAndSave, seeAndCorrect, getStudentStatus, getDateFolder, writeLog, waitTimeAndLogCustom, logRunStart, logRunEnd } from './utils';

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

    writeLog(logFilePath, `Procesando comisión ${commissionCode}`);
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
        // await page.getByRole('link', { name: 'Resumen de prácticas' }).click();
        
        console.log ( `Descargando práctico de ${nameStudent} (${studentId} [${commissionCode}])`);
        writeLog(logFilePath, `Descargando práctico de ${nameStudent} (${studentId} [${commissionCode}])`);

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

        const corregirLink = page.getByRole('link', { name: '[CORREGIR]' });
        const totalCorrecciones = await corregirLink.count();

        if (totalCorrecciones === 0) {
          console.log(
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
          nameStudent
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
      const studentName = student.name;

      const estado = getStudentStatus(
        rootDir,
        commissionCode,
        studentId
      );

      if (!estado) {
        writeLog(
          logFilePath,
          `⚠️ Sin estado para ${studentName} (${studentId}) — se omite`
        );
        continue;
      }

      try {
        await seeAndCorrect(
          page,
          commissionCode,
          studentId,
          studentName,
          entregaIndex,
          estado,
          logFilePath,
          origin
        );
      } catch (error) {
        writeLog(
          logFilePath,
          `💥 Error ${origin} con ${studentName} (${studentId}): ${String(error)}`
        );
      }

      await waitTimeAndLogCustom(page, `Corrigiendo alumno ${estado}`,2);

    }
  }

  logRunEnd(logFilePath);
}
