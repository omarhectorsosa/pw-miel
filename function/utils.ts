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
  studentName: string,
  entregaIndex: number
): Promise<{ filePath?: string; fileName?: string }> {

    const logFilePath = path.join(rootDir, 'log.txt');
    const courseDir   = path.join(rootDir, course);

    fs.mkdirSync(courseDir, { recursive: true });

    logStudent(logFilePath, studentName, studentId);

    await waitTimeAndLogCustom(page, 'Esperando seccion..', 2);

    const entregas = page.locator('.w3-padding.entrega');

    const is_absence = isAbsence(
        rootDir,
        course,
        studentId
    );

    if (is_absence) {  
      writeLog(
          logFilePath,
          `🚫 El alumno ${studentName} (${studentId}) se inhabilito por ausente en sus entregas anteriores — revisar su estado`
      );

      writeLog(
        logFilePath, 
        'ℹ️  Sin entregas → marcado AUSENTE(0)'
      );
      
      saveAbsence(courseDir, course, studentId, studentName, entregaIndex);
      
      return {};
    }

    const estado = getStudentStatus(
        rootDir,
        course,
        studentId,
        entregaIndex
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
        saveAbsence(courseDir, course, studentId, studentName,entregaIndex);
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
        saveAbsence(courseDir, course, studentId, studentName, entregaIndex);
      }
      return {};
    }
    
     writeLog(
        logFilePath,
        `ℹ️ Se encontro archivo para descargar ${studentName} (${studentId}) — se procede a analizar si existe estado.`
     );

    // Presente confirmado
    if (estado && estado !== '0') {
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
          if (estado === '0') {
            writeLog(
              logFilePath,
              `🔍 ${studentName} (${studentId}) estaba en estado 0 (AUSENTE)`
            );
            writeLog(logFilePath, '♻️  Reemplazando estado 0(AUSENTE) → ENTREGADO(E)');
            replaceAbsencetByDelivery(courseDir, course, studentId, studentName, entregaIndex);
          } else {
            writeLog(
              logFilePath,
              'ℹ️  Entrega con archivo adjunto → marcado ENTREGADO'
            );
            saveDelivery(courseDir, course, studentId, studentName, entregaIndex);
          }
          return { filePath, fileName };
        }

        // ⛔ No se descargó nada → no se marca entregado
        writeLog(
          logFilePath,
          `⚠️  Sin archivo descargado — se mantiene estado ${estado ?? '0'}`
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
  estado: string,
  logFilePath: string,
  message: string,
  entregaIndex: number
): Promise<void> {

  writeLog(
    logFilePath,
    `📝 Corrigiendo a ${studentName} (${studentId}) — estado=${estado}`
  );

  const courseDir = path.join(rootDir.toString(), commissionCode);
  let check = '';

  // 🎯 Selección de estado
  if (estado === '0') {
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
  } else if (Number(estado) < 7 && Number(estado) > 0 ) {
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

  setCheckPractical(courseDir,commissionCode,studentId,studentName, check, entregaIndex);

  if ( estado === '0'  ) {
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
  studentId: string,
  entregaIndex: number
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

  // 🔹 Determinar columna según entrega
  let col = 3;

  switch (entregaIndex) {
    case 1:  col = 3; break;
    case 6:  col = 4; break;
    case 10: col = 5; break;
    case 13: col = 6; break;
    case 15: col = 7; break;
    case 16: col = 8; break;
    default: col = 3;
  }

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(';');

    const course = parts[0];
    const id = parts[1];

    if (course === commissionCode && id === studentId) {
      return parts[col] || null;
    }
  }

  return null;
}

export function getStudentMessage(
  rootDir: string,
  commissionCode: string,
  studentId: string,
  entregaIndex: number
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

  // 🔹 Determinar columna según entrega
  let col = 3;

  switch (entregaIndex) {
    case 1:  col = 3; break;
    case 6:  col = 4; break;
    case 10: col = 5; break;
    case 13: col = 6; break;
    case 15: col = 7; break;
    case 16: col = 8; break;
    default: col = 3;
  }

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(';');

    const course = parts[0];
    const id = parts[1];

    if (course === commissionCode && id === studentId) {

      const status = parts[col];
      const message = parts[9]; // columna mensaje

      // 🔹 Solo devolver mensaje si hay estado en esa entrega
      if (status && status !== '') {
        return message || null;
      }

      return null;
    }
  }

  return null;
}


function findStudentRecord(
  courseDir: string,
  course: string,
  studentId: string
) {
  const filePath = path.join(courseDir, 'estado.csv');

  if (!fs.existsSync(filePath)) return null;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const cols = line.split(';');
    const [c, id] = cols;

    if (c === course && id === studentId) {
      return {
        index: i,
        lines,
        record: {
          internet: cols[3] || '',
          word: cols[4] || '',
          excel1: cols[5] || '',
          excel2: cols[6] || '',
          excel3: cols[7] || '',
          diseño: cols[8] || '',
          mensaje: cols[9] || '',
          check: cols[10] || ''
        }
      };
    }
  }

  return null;
}

export function isAbsence(
  rootDir: string,
  commissionCode: string,
  studentId: string
): boolean {

  const statusFilePath = path.join(
    rootDir,
    commissionCode,
    'estado.csv'
  );

  if (!fs.existsSync(statusFilePath)) {
    return false;
  }

  const lines = fs.readFileSync(statusFilePath, 'utf8').split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const parts = line.split(';');

    const course = parts[0];
    const id = parts[1];

    if (course === commissionCode && id === studentId) {
      
      // 🔹 columnas donde están las notas (ajustar si cambia el CSV)
      const thematicCols = [3, 4, 5, 6, 7, 8];

      // 🔹 true si tiene al menos un 0
      return thematicCols.some(col => parts[col] === '0');
    }
  }

  return false;
}


/* ==================================================
   Escritura de resultados
===================================================== */

function ensureHeader(filePath: string) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
    fs.writeFileSync(filePath, 'curso;clave;nombre;1;6;mensaje;check\n');
  }
}

function saveAbsence(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string,
  entregaIndex: number
) {
  const filePath = path.join(courseDir, `estado.csv`);
  ensureHeader(filePath);

  const found = findStudentRecord(courseDir, course, studentId);
  const r = found?.record;

  let line = '';

  switch (entregaIndex) {
    case 1:
      line = `${course};${studentId};${studentName};0;;;;;;;;`;
      break;

    case 6:
      line = `${course};${studentId};${studentName};${r?.internet || ''};0;;;;;;;`;
      break;

    case 10:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || ''};0;;;;;;`;
      break;

    case 13:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || ''};${r?.excel2 || ''};0;;;;;`;
      break;

    case 15:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || ''};${r?.excel1 || ''};${r?.excel3 || ''};0;;;;`;
      break;

    case 16:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || ''};${r?.excel1 || ''};${r?.excel2 || ''};${r?.excel3 || ''};0;;;`;
      break;

    default:
      return;
  }

  // 👉 Si existe → reemplazar SIN agregar \n
  if (found) {
    found.lines[found.index] = line;
    fs.writeFileSync(filePath, found.lines.join('\n'));
  } 
  // 👉 Si no existe → append CON \n
  else {
    fs.appendFileSync(filePath, line + '\n');
  }

  updateTotals(courseDir, entregaIndex);
}

function saveDelivery(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string,
  entregaIndex: number
) {
  const filePath = path.join(courseDir, `estado.csv`);
  ensureHeader(filePath);

  const found = findStudentRecord(courseDir, course, studentId);
  const r = found?.record;

  let line = '';

  switch (entregaIndex) {
    case 1:
      line = `${course};${studentId};${studentName};E;;;;;;;;`;
      break;

    case 6:
      line = `${course};${studentId};${studentName};${r?.internet || 'E'};E;;;;;;;`;
      break;

    case 10:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || 'E'};E;;;;;;`;
      break;

    case 13:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || ''};${r?.excel2 || 'E'};E;;;;;`;
      break;

    case 15:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || ''};${r?.excel1 || ''};${r?.excel3 || 'E'};E;;;;`;
      break;

    case 16:
      line = `${course};${studentId};${studentName};${r?.internet || ''};${r?.word || ''};${r?.excel1 || ''};${r?.excel2 || ''};${r?.excel3 || 'E'};E;;;`;
      break;

    default:
      return;
  }

  // 👉 reemplazo sin \n
  if (found) {
    found.lines[found.index] = line;
    fs.writeFileSync(filePath, found.lines.join('\n'));
  } 
  // 👉 append con \n
  else {
    fs.appendFileSync(filePath, line + '\n');
  }

  updateTotals(courseDir, entregaIndex);
}

function replaceAbsencetByDelivery(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string,
  entregaIndex: number
) {
  const filePath = path.join(courseDir, 'estado.csv');
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  const updatedLines = lines.map(line => {
    if (!line.trim()) return line;

    const parts = line.split(';');
    const c = parts[0];
    const id = parts[1];

    if (c === course && id === studentId) {

      switch (entregaIndex) {
        case 1:
          if (parts[3] === '0') parts[3] = 'E';
          break;

        case 6:
          if (parts[4] === '0') parts[4] = 'E';
          break;

        case 10:
          if (parts[5] === '0') parts[5] = 'E';
          break;

        case 13:
          if (parts[6] === '0') parts[6] = 'E';
          break;

        case 15:
          if (parts[7] === '0') parts[7] = 'E';
          break;

        case 16:
          if (parts[8] === '0') parts[8] = 'E';
          break;

        default:
          break;
      }

      // reconstruir la línea con el nombre actualizado
      parts[2] = studentName;

      return parts.join(';');
    }

    return line;
  });

  fs.writeFileSync(filePath, updatedLines.join('\n'));

  updateTotals(courseDir, entregaIndex);
}

function setCheckPractical(
  courseDir: string,
  course: string,
  studentId: string,
  studentName: string,
  check: string,
  entregaIndex: number
) {

  const filePath = path.join(courseDir, 'estado.csv');

  if (!fs.existsSync(filePath)) {
    console.warn(`⚠️ estado.csv no existe: ${filePath}`);
    return;
  }

  const lines = fs.readFileSync(filePath, 'utf8').split('\n');

  // 🔹 Determinar columna según entrega
  let col = 3;

  switch (entregaIndex) {
    case 1:  col = 3; break;
    case 6:  col = 4; break;
    case 10: col = 5; break;
    case 13: col = 6; break;
    case 15: col = 7; break;
    case 16: col = 8; break;
    default: col = 3;
  }

  const updatedLines = lines.map(line => {
    if (!line.trim()) return line;

    const parts = line.split(';');

    const c = parts[0];
    const id = parts[1];

    if (c === course && id === studentId) {

      // 🔹 Solo permitir check si existe estado en esa entrega
      const status = parts[col];

      if (status && status !== '') {
        parts[2] = studentName; // actualizar nombre
        parts[10] = check;      // columna check
        return parts.join(';');
      }
    }

    return line;
  });

  fs.writeFileSync(filePath, updatedLines.join('\n'));

  updateTotals(courseDir, entregaIndex);
}

function updateTotals(courseDir: string, entregaIndex: number) {

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

  // 🟢 Mapeo dinámico de columna
  let col = 3; // default internet

  switch (entregaIndex) {
    case 1:  col = 3; break;
    case 6:  col = 4; break;
    case 10: col = 5; break;
    case 13: col = 6; break;
    case 15: col = 7; break;
    case 16: col = 8; break;
  }

  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  const moment =
    now.getFullYear() + '-' +
    pad(now.getMonth() + 1) + '-' +
    pad(now.getDate()) + ' ' +
    pad(now.getHours()) + ':' +
    pad(now.getMinutes()) + ':' +
    pad(now.getSeconds());

  console.log(`Momento ${moment}`);

  let total = 0;
  let totalA = 0;
  let totalE = 0;
  let totalC = 0;
  let totalI = 0;

  for (const line of dataLines) {

    const parts = line.split(';');
    const status = parts[col];
    const check  = parts[10]; // última columna

    if (!status) continue;

    total++;

    // 🟢 AUSENTES
    if (status === 'A' || status === '0') totalA++;

    // 🟢 ENTREGADOS
    if (status === 'E' || Number(status) > 0) totalE++;

    // 🟢 CORREGIDOS (nota)
    if (Number(status) > 0) totalC++;

    // 🟢 INFORMADOS
    if (check && check !== '') totalI++;
  }

  const porcentaje =
    total > 0 ? ((totalE / total) * 100).toFixed(2) + '%' : '0%';

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



