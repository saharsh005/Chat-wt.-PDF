import pdfParse from "pdf-parse/lib/pdf-parse.js";

/**
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
export async function loadPDF(buffer) {
  const data = await pdfParse(buffer);
  return data.text;
}
