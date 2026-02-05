import { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/* =========================
   Utilidades generales
========================= */

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

export function writeLog(logFilePath: string, message: string): void {
  const now = new Date().toISOString();
  fs.appendFileSync(logFilePath, `[${now}] ${message}\n`, 'utf8');
}

/* =========================
   Helpers de logging
========================= */

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

/* =========================
   Escritura de resultados
========================= */

function ensureHeader(filePath: string) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    fs.writeFileSync(filePath, 'curso;clave;nombre;nota\n');
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
  const line = `${course};${studentId};${studentName};A;`;
  fs.appendFileSync(filePath, line + '\n');
}

function writePresent(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string
) {
  const filePath = path.join(courseDir, `estado.csv`);
  ensureHeader(filePath);
  const line = `${course};${studentId};${studentName};E;`;
  fs.appendFileSync(filePath, line + '\n');
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

    const [c, id, name, status] = line.split(';');

    if (
      c === course &&
      id === studentId &&
      status === 'A'
    ) {
      return `${course};${studentId};${studentName};E;`;
    }

    return line;
  });

  fs.writeFileSync(filePath, updatedLines.join('\n'));
}

/* =========================
   Descarga principal
========================= */

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

    const entregas = page.locator('.w3-padding.entrega');

    const estado = getStudentStatus(
        rootDir,
        course,
        studentId
    );

    if (await entregas.count() === 0) {  
      if (estado) {
        writeLog(
          logFilePath,
          `🔍 Ya se encuentra registrado en estado ${studentName} (${studentId}) — se omite`
        );
      } else {
        writeLog(logFilePath, 'ℹ️  Sin entregas → marcado AUSENTE');
        writeAbsent(courseDir, course, studentId, studentName);
      }
      return {};
    }

    const archivoLink = entregas.first().locator('a.link');

    if (await archivoLink.count() === 0) {
      if (estado) {
        writeLog(
          logFilePath,
          `🔍 Ya se encuentra registrado en estado ${studentName} (${studentId}) — se omite`
        );
      } else {
        writeLog(logFilePath, 'ℹ️  Entrega sin archivo adjunto → marcado AUSENTE');
        writeAbsent(courseDir, course, studentId, studentName);
      }
      return {};
    }

    // Presente confirmado
    if (estado && estado !== 'A') {
        writeLog(
          logFilePath,
          `🔍 Ya se encuentra registrado en estado ${studentName} (${studentId}) — se omite`
        );
        return {};
    } else {
        if (estado === 'A') {
          writeLog(logFilePath, '♻️  Reemplazando estado A → ENTREGADO');
          replaceAbsentWithPresent(courseDir, course, studentId, studentName);
        } else {
          writeLog(logFilePath, 'ℹ️  Entrega con archivo adjunto → marcado ENTREGADO');
          writePresent(courseDir, course, studentId, studentName);
        }
        
        const targetDir = path.join(courseDir, studentName);
        fs.mkdirSync(targetDir, { recursive: true });

        writeLog(logFilePath, '⬇️  Descargando archivo…');

        const [download] = await Promise.all([
          page.waitForEvent('download', { timeout: 10000 }),
          archivoLink.click(),
        ]);

        const fileName = download.suggestedFilename();
        const filePath = path.join(targetDir, fileName);

        await download.saveAs(filePath);

        writeLog(logFilePath, `✅ Descarga OK — ${fileName}`);

        return { filePath, fileName };
    }    
}

/* =========================
   Correccion principal
========================= */

export async function seeAndCorrect(
  page: Page,
  commissionCode: string,
  studentId: string,
  studentName: string,
  entregaIndex: number,
  estado: string,
  logFilePath: string,
  origin: string
): Promise<void> {

  writeLog(
    logFilePath,
    `📝 Corrigiendo a ${studentName} (${studentId}) — estado=${estado}`
  );

  await page.goto(`/tutoria/alumnos/comision/${commissionCode}`);

  const studentLink = page.getByRole('link', { name: studentName });

  if (await studentLink.count() === 0) {
    writeLog(
      logFilePath,
      `❌ Error ${origin}: No se encontró al alumno ${studentName}`
    );
    return;
  }

  await studentLink.click();
  
  await waitTimeAndLogCustom(page, `Esperando corregir ${studentName}`,2);

  const corregirLinks = page.getByRole('link', { name: '[CORREGIR]' });
  const total = await corregirLinks.count();

  if (total === 0 || entregaIndex >= total) {
    writeLog(
      logFilePath,
      `❌ Error ${origin}: No hay correcciones válidas para ${studentName}`
    );
    await page.goBack();
    return;
  }

  await corregirLinks.nth(entregaIndex).click();

  // 🎯 Selección de estado
  if (estado === 'A') {
    await page.getByLabel('Estado:').selectOption('10');
    writeLog(logFilePath, '🚫 Marcado como AUSENTE');
  } else if (Number(estado) >= 7) {
    await page.getByLabel('Estado:').selectOption('1');
    writeLog(logFilePath, '✅ Marcado como APROBADO');
  } else if (Number(estado) < 7) {
    await page.getByLabel('Estado:').selectOption('2');
    writeLog(logFilePath, '⚠️ Marcado como DESAPROBADO');  
  } else if (estado='E' ) {
    await page.getByLabel('Estado:').selectOption('99');
    writeLog(logFilePath, '⚠️ Dejar en pausa');  
  } else {
    writeLog(
      logFilePath,
      `⚠️ Estado ${estado} no procesado — sin cambios`
    );
    await page.goBack();
    return;
  }

  await page.getByRole('link', { name: 'Enviar corrección' }).click();
  writeLog(logFilePath, '📤 Corrección enviada');

  await page.goBack();
}


/* =========================
   Logs de corrida
========================= */

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


