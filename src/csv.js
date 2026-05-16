// Parser de CSV propio (sin dependencias). Soporta campos entre comillas,
// comillas escapadas ("") y separadores de linea CRLF/LF.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const src = String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',' || c === ';') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const LETTERS = ['a', 'b', 'c', 'd', 'e'];

// Convierte las filas del CSV en preguntas listas para insertar.
// Columnas esperadas (encabezado, sin distinguir mayusculas):
//   pregunta | categoria | dificultad | opcion_a..opcion_e | correctas
// "correctas" admite una o varias letras separadas por coma: "A" o "A,C".
function rowsToQuestions(rows) {
  if (rows.length < 2) {
    throw new Error('El archivo no contiene preguntas.');
  }
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);

  const qi = idx('pregunta');
  if (qi === -1) throw new Error('Falta la columna obligatoria "pregunta".');
  const cor = idx('correctas');
  if (cor === -1) throw new Error('Falta la columna obligatoria "correctas".');

  const ci = idx('categoria');
  const di = idx('dificultad');
  const letterCols = {};
  for (const l of LETTERS) {
    const ix = idx('opcion_' + l);
    if (ix !== -1) letterCols[l] = ix;
  }
  if (Object.keys(letterCols).length < 2) {
    throw new Error('Se requieren al menos las columnas "opcion_a" y "opcion_b".');
  }

  const questions = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const cell = (i) => (i != null && i !== -1 && row[i] != null ? String(row[i]).trim() : '');
    const text = cell(qi);
    if (!text) continue;

    const correctLetters = cell(cor)
      .toLowerCase()
      .split(/[,;/|\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!correctLetters.length) {
      throw new Error(`Fila ${r + 1}: falta la respuesta correcta.`);
    }

    const options = [];
    let hasCorrect = false;
    for (const l of LETTERS) {
      if (letterCols[l] == null) continue;
      const optText = cell(letterCols[l]);
      if (!optText) continue;
      const isCorrect = correctLetters.includes(l);
      if (isCorrect) hasCorrect = true;
      options.push({ text: optText, is_correct: isCorrect });
    }
    if (options.length < 2) {
      throw new Error(`Fila ${r + 1}: se requieren al menos 2 opciones con texto.`);
    }
    if (!hasCorrect) {
      throw new Error(`Fila ${r + 1}: la respuesta correcta no coincide con ninguna opcion.`);
    }

    questions.push({
      text,
      category: cell(ci) || null,
      difficulty: cell(di) || null,
      options,
    });
  }
  if (!questions.length) {
    throw new Error('No se encontraron preguntas validas en el archivo.');
  }
  return questions;
}

module.exports = { parseCSV, rowsToQuestions };
