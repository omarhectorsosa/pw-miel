import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/* ==================================================
   Descarga principal
===================================================== */

export async function downloadAndSave(
  page: Page,
  rootDir: string,
  course: string,
  studentId: string,
  studentName: string
): Promise<{ filePath?: string; fileName?: string }> {

    const logFilePath = path.join(rootDir, 'log.txt');
    const courseDir   = path.join(rootDir, course);

    fs.mkdirSync(courseDir, { recursive: true });

    logStudent(logFilePath, studentName, studentId);

    await waitTimeAndLogCustom(page, 'Esperando seccion..', 2);

    const entregas = page.locator('.w3-padding.entrega');

    const estado = getStudentStatus(
        rootDir,
        course,
        studentId
    );

    if (await entregas.count() === 0) {  
      writeLog(
          logFilePath,
          `❌  No se encontro ninguna seccion de descarga ${studentName} (${studentId}) — revisar su perfil`
      );
      if (estado) {
        writeLog(
          logFilePath,
          `🔍 ${studentName} (${studentId}) ya se encuentra registrado en estado ${estado}  — se omite`
        );
      } else {
        writeLog(logFilePath, 'ℹ️  Sin entregas → marcado AUSENTE');
        writeAbsent(courseDir, course, studentId, studentName);
      }
      return {};
    }

    await waitTimeAndLogCustom(page, 'Esperando link descargar..', 2);
    const archivoLink = entregas.first().locator('a.link');

    if (await archivoLink.count() === 0) {
      writeLog(
          logFilePath,
          `ℹ❌  No se encontro ningun archivo para descargar ${studentName} (${studentId}) — revisar su perfil`
      );
      if (estado) {
        writeLog(
          logFilePath,
          `🔍 ${studentName} (${studentId}) ya se encuentra registrado en estado ${estado}  — se omite`
        );
      } else {
        writeLog(logFilePath, 'ℹ️  Entrega sin archivo adjunto → marcado AUSENTE');
        writeAbsent(courseDir, course, studentId, studentName);
      }
      return {};
    }
    
     writeLog(
        logFilePath,
        `ℹ️ Se encontro archivo para descargar ${studentName} (${studentId}) — se procede a analizar si existe estado.`
     );

    // Presente confirmado
    if (estado && estado !== 'A') {
        writeLog(
          logFilePath,
          `🔍 ${studentName} (${studentId}) ya se encuentra registrado en estado ${estado}  — se omite`
        );
        return {};
    } else {
        const targetDir = path.join(courseDir, studentName);
        fs.mkdirSync(targetDir, { recursive: true });

        let descargaOK = false;
        let fileName = '';
        let filePath = '';

        try {
          writeLog(logFilePath, '⬇️  Descargando archivo…');

          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 10000 }),
            archivoLink.click(),
          ]);

          fileName = download.suggestedFilename();
          filePath = path.join(targetDir, fileName);

          await download.saveAs(filePath);

          descargaOK = true;
          writeLog(logFilePath, `✅ Descarga OK — ${fileName}`);

        } catch (error) {
          writeLog(
            logFilePath,
            `❌ Error en descarga — ${studentName} (${studentId})`
          );
        }

        if (descargaOK) {
          if (estado === 'A') {
            writeLog(
              logFilePath,
              `🔍 ${studentName} (${studentId}) estaba en estado A`
            );
            writeLog(logFilePath, '♻️  Reemplazando estado A → ENTREGADO');
            replaceAbsentWithPresent(courseDir, course, studentId, studentName);
          } else {
            writeLog(
              logFilePath,
              'ℹ️  Entrega con archivo adjunto → marcado ENTREGADO'
            );
            writePresent(courseDir, course, studentId, studentName);
          }
          return { filePath, fileName };
        }

        // ⛔ No se descargó nada → no se marca entregado
        writeLog(
          logFilePath,
          `⚠️  Sin archivo descargado — se mantiene estado ${estado ?? 'A'}`
        );

        return {};

    }    
}

/* ==================================================
   Correccion principal
===================================================== */

export async function seeAndCorrect(
  page: Page,
  rootDir: String,
  commissionCode: string,
  studentId: string,
  studentName: string,
  entregaIndex: number,
  estado: string,
  logFilePath: string,
  origin: string,
  message: string
): Promise<void> {

  writeLog(
    logFilePath,
    `📝 Corrigiendo a ${studentName} (${studentId}) — estado=${estado}`
  );

  const courseDir = path.join(rootDir.toString(), commissionCode);
  let check = '';

  // 🎯 Selección de estado
  if (estado === 'A') {
    // Estados en pausa  
    // Temporal cambiar el dia de la fecha
    await page.getByLabel('Estado:').selectOption('10');
    writeLog(logFilePath, '🚫 Marcado como SIN CORREGIR — se omite');
    writeLog(logFilePath, `✉️ ${message}`);
    check = 'AUSENTE';
  } else if (estado === 'E' ) {
    await page.getByLabel('Estado:').selectOption('3');
    writeLog(logFilePath, '⚠️ Dejar en entregado');
    check = '';  
  //Corregir con mensajes 
  } else if (Number(estado) >= 7) {
    await page.getByLabel('Estado:').selectOption('1');
    writeLog(logFilePath, '✅ Marcado como APROBADO');
    check = 'APROBADO';  
  } else if (Number(estado) < 7) {
    await page.getByLabel('Estado:').selectOption('4');
    await page.getByRole('textbox', { name: 'Observaciones (opcional):' }).fill(message);  
    writeLog(logFilePath, '⚠️ Marcado como REENTREGAR');
    writeLog(logFilePath, `✉️ ${message}`);

    check = 'REENTREGADO';  
  } else {  
    writeLog(
      logFilePath,
      `⚠️ Estado ${estado} no procesado — sin cambios`
    );
    await page.goBack();
    return;
  }

  setCheckPractical(courseDir,commissionCode,studentId,studentName, check);

  if ( estado === 'A'  ) {
    // Descomentar para informar de su estado actual
    await page.getByRole('textbox', { name: 'Observaciones (opcional):' }).fill(message);  
    await page.getByRole('link', { name: 'Enviar corrección' }).click();
    writeLog(logFilePath, '🚫 Corrección NO enviada (informar por ausente se paso fecha limite)');
  } else {
    await page.getByRole('link', { name: 'Enviar corrección' }).click();
    writeLog(logFilePath, `📤 Corrección enviada ${check}`);
  }

  //await waitTimeAndLogCustom(page, `Fin de corrección`,5);
  await page.goBack();
}

/* ==================================================
   Utilidades generales
===================================================== */

export async function waitTimeAndLogCustom(
  page: Page,
  message: string,
  time: number
): Promise<void> {
  console.log(`${message} ${time} segundos`);
  await new Promise(resolve => setTimeout(resolve, time * 1000));
}

export function getDateFolder(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    now.getFullYear().toString() +
    pad(now.getMonth() + 1) +
    pad(now.getDate())
  );
}

export function getStudentStatus(
  rootDir: string,
  commissionCode: string,
  studentId: string
): string | null {

  const statusFilePath = path.join(
    rootDir,
    commissionCode,
    'estado.csv'
  );

  if (!fs.existsSync(statusFilePath)) {
    return null;
  }

  const lines = fs.readFileSync(statusFilePath, 'utf8').split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const [course, id, , status] = line.split(';');

    if (course === commissionCode && id === studentId) {
      return status; // "7" o "A"
    }
  }

  return null;
}

export function getStudentMessage(
  rootDir: string,
  commissionCode: string,
  studentId: string
): string | null {

  const statusFilePath = path.join(
    rootDir,
    commissionCode,
    'estado.csv'
  );

  if (!fs.existsSync(statusFilePath)) {
    return null;
  }

  const lines = fs.readFileSync(statusFilePath, 'utf8').split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const [course, id, , status, message] = line.split(';');

    if (course === commissionCode && id === studentId) {
      return message; // "" o "Mensaje"
    }
  }

  return null;
}


/* ==================================================
   Escritura de resultados
===================================================== */

function ensureHeader(filePath: string) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    fs.writeFileSync(filePath, 'curso;clave;nombre;nota;mensaje;check\n');
  }
}

function writeAbsent(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string
) {
  const filePath = path.join(courseDir, `estado.csv`);
  ensureHeader(filePath);

  const line = `${course};${studentId};${studentName};A;;;`;
  fs.appendFileSync(filePath, line + '\n');

  updateTotals(courseDir);
}


function writePresent(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string
) {
  const filePath = path.join(courseDir, `estado.csv`);
  ensureHeader(filePath);

  const line = `${course};${studentId};${studentName};E;;;`;
  fs.appendFileSync(filePath, line + '\n');

  updateTotals(courseDir);
}


function replaceAbsentWithPresent(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string
) {
  const filePath = path.join(courseDir, 'estado.csv');
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  const updatedLines = lines.map(line => {
    if (!line.trim()) return line;

    const [c, id, , status, message, check] = line.split(';');

    if (c === course && id === studentId && status === 'A') {
      return `${course};${studentId};${studentName};E;${message};${check};`;
    }

    return line;
  });

  fs.writeFileSync(filePath, updatedLines.join('\n'));
  
  updateTotals(courseDir);
}

function setCheckPractical(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string,
  check: string
) {
  
  
  const filePath = path.join(courseDir, 'estado.csv');

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ estado.csv no existe: ${filePath}`);
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  const updatedLines = lines.map(line => {
    if (!line.trim()) return line;

    const [c, id, , status, message] = line.split(';');
    if (c === course && id === studentId) {
      return `${course};${studentId};${studentName};${status};${message};${check}`;
    }

    return line;
  });
  
  
  fs.writeFileSync(filePath, updatedLines.join('\n'));

  updateTotals(courseDir);
}


function updateTotals(courseDir: string) {

  console.log('Actualizando totales.');

  const estadoPath  = path.join(courseDir, 'estado.csv');
  const totalesPath = path.join(courseDir, 'totales.csv');

  if (!fs.existsSync(estadoPath)) {
    console.log(`No existe el ${estadoPath}`);
    return;
  }  

  const lines = fs
    .readFileSync(estadoPath, 'utf8')
    .split('\n')
    .filter(l => l.trim());

  // ignorar header
  const dataLines = lines.slice(1);
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  let moment = now.getFullYear().toString() + pad(now.getMonth() + 1) + pad(now.getDate()) + now.getHours() + now.getMinutes() + now.getSeconds()
  
  console.log(`Momento ${moment}`);

  let total = 0;
  let totalA = 0;
  let totalE = 0;
  let totalC = 0;
  let totalI = 0;

  for (const line of dataLines) {
    const [, , , status, message, check ] = line.split(';');
    if (!status) continue;

    total++;

    if (status === 'A') totalA++;
    if (status === 'E' || Number(status) > 0) totalE++;
    if (Number(status) > 0) totalC++;
    if (check !== '') totalI++;

  }

  const porcentaje =
    total > 0 ? (((totalE) / total) * 100).toFixed(2) + '%' : '0%';

  const content =
   `campo;valor
Actualización;${moment}   
Total;${total}
Ausentes(A);${totalA}
Entregados(E);${totalE}
Corregidos;${totalC}
Informados;${totalI}
% (E);${porcentaje}
`;

  fs.writeFileSync(totalesPath, content);
}


/* =========================
   Logs de corrida
========================= */

export function writeLog(logFilePath: string, message: string): void {
  const now = new Date().toISOString();
  fs.appendFileSync(logFilePath, `[${now}] ${message}\n`, 'utf8');}

export function logRunStart(
  logFilePath: string,
  entrega: string
) {
  writeLog(logFilePath, '🚀 =======================================================');
  writeLog(logFilePath, `🚀 Inicio de corrida — Entrega: ${entrega}`);
  writeLog(logFilePath, '🚀 =======================================================');
}

export function logCourseStart(
  logFilePath: string,
  course: string,
  from: number,
  to: number,
  total: number
) {
  logCourse(logFilePath, course);
  logStudentsBatch(logFilePath, from, to, total);
}

export function logRunEnd(logFilePath: string) {
  writeLog(logFilePath, '🏁 =============================================================');
  writeLog(logFilePath, '🏁 Fin de corrida');
  writeLog(logFilePath, '🏁 =============================================================');
  writeLog(logFilePath, '');
}

function logSection(log: string, title: string) {
  writeLog(log, `\n${title}`);
}

function logCourse(log: string, course: string) {
  logSection(log, `📘 Curso ${course}`);
}

function logStudentsBatch(
  log: string,
  from: number,
  to: number,
  total: number
) {
  writeLog(log, `👥 Alumnos ${from}–${to} (total: ${total})`);
}

function logStudent(log: string, name: string, id: string) {
  writeLog(log, `👤 ${name} (${id})`);
}



