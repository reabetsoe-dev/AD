import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { MembershipForm } from "./membership";

const pageSize: [number, number] = [841.89, 595.28];
const margin = 34;
const rowsPerPage = 14;
const columnWidths = [24, 140, 112, 34, 144, 98, 140, 81.89];
const headings = ["", "LEBITSO", "FANE", "M/F", "Nomoro ea ID Kapa ea IEC", "MOTSE", "Nomoro ea Karete ea botho", "MOHALA"];

function printable(text: string, font: PDFFont) {
  return Array.from(text.normalize("NFC")).map((character) => {
    try { font.encodeText(character); return character; }
    catch { return "?"; }
  }).join("").replace(/[\r\n\t]/g, " ");
}

function linesFor(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let current = "";
  for (const character of printable(text, font)) {
    if (font.widthOfTextAtSize(current + character, size) > width && current) {
      const space = current.lastIndexOf(" ");
      if (space > 0) {
        lines.push(current.slice(0, space));
        current = current.slice(space + 1) + character;
      } else {
        lines.push(current);
        current = character;
      }
    } else current += character;
  }
  if (current) lines.push(current.trim());
  return lines;
}

function cellText(page: PDFPage, text: string, font: PDFFont, x: number, top: number, width: number, height: number, centered = false) {
  let size = centered ? 8 : 9;
  let lines = linesFor(text, font, size, width - 8);
  while (lines.length * (size + 2) > height - 5 && size > 4) {
    size -= 0.25;
    lines = linesFor(text, font, size, width - 8);
  }
  const firstBaseline = top - (height - lines.length * (size + 2)) / 2 - size;
  lines.forEach((line, index) => page.drawText(line, {
    x: centered ? x + (width - font.widthOfTextAtSize(line, size)) / 2 : x + 4,
    y: firstBaseline - index * (size + 2), size, font, color: rgb(0, 0, 0),
  }));
}

export async function membershipPdf(forms: MembershipForm[]) {
  const document = await PDFDocument.create();
  document.setTitle("FOROMO E AMOHELANG BOTHO BA LEKHOTLA");
  document.setAuthor("Alliance of Democrats");
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const titleFont = await document.embedFont(StandardFonts.TimesRomanBold);
  const logo = await document.embedPng(await readFile(join(process.cwd(), "public", "ad-logo.png")));
  const sheets = forms.length ? forms : [{ constituency: "", members: [] }];
  for (const form of sheets) {
    const pageCount = Math.max(1, Math.ceil(form.members.length / rowsPerPage));
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      const page = document.addPage(pageSize);
      const centerText = (text: string, font: PDFFont, size: number, center: number, y: number) => {
        const safe = printable(text, font);
        page.drawText(safe, { x: center - font.widthOfTextAtSize(safe, size) / 2, y, size, font });
      };
      page.drawImage(logo, { x: 195, y: 485, width: 104, height: 69.33 });
      centerText("ALLIANCE OF", regular, 10, 247, 474);
      centerText("DEMOCRATS", bold, 12, 247, 461);
      centerText("Lekhotla la Kopano ea Sechaba", regular, 6, 247, 451);

      page.drawRectangle({ x: 562, y: 464, width: 218, height: 92, borderWidth: 0.7, borderColor: rgb(0, 0, 0) });
      centerText("ALLIANCE OF DEMOCRATS", regular, 12, 671, 540);
      centerText("(AD)", regular, 11, 671, 526);
      centerText("Lekhotla la Kopano ea Sechaba", regular, 9, 671, 511);
      centerText("P.O. Box 16063, Maseru", regular, 10, 671, 487);
      centerText("Tel: +266 2732 0016", regular, 10, 671, 474);

      centerText("FOROMO E AMOHELANG BOTHO BA LEKHOTLA", titleFont, 14, pageSize[0] / 2, 426);
      const headerFields = [
        { label: "Lebatooa", value: form.constituency, x: margin, width: 292 },
        { label: "Lekala", value: form.branch || "", x: 342, width: 190 },
        { label: "Setereke", value: form.district || "", x: 548, width: 260 },
      ];
      for (const field of headerFields) {
        page.drawText(field.label, { x: field.x, y: 404, font: titleFont, size: 10 });
        const labelWidth = titleFont.widthOfTextAtSize(field.label, 10) + 6;
        cellText(page, field.value, regular, field.x + labelWidth, 418, field.width - labelWidth, 19);
        page.drawLine({ start: { x: field.x + labelWidth + 4, y: 400 }, end: { x: field.x + field.width, y: 400 }, thickness: 0.5, dashArray: [1, 2] });
      }

      const tableTop = 387, headerHeight = 29, rowHeight = 22;
      const tableBottom = tableTop - headerHeight - rowsPerPage * rowHeight;
      const tableWidth = columnWidths.reduce((sum, width) => sum + width, 0);
      page.drawRectangle({ x: margin, y: tableBottom, width: tableWidth, height: tableTop - tableBottom, borderColor: rgb(0, 0, 0), borderWidth: 0.65 });
      let x = margin;
      headings.forEach((heading, index) => {
        cellText(page, heading, bold, x, tableTop, columnWidths[index], headerHeight, true);
        x += columnWidths[index];
        if (index < headings.length - 1) page.drawLine({ start: { x, y: tableTop }, end: { x, y: tableBottom }, thickness: 0.5 });
      });
      for (let row = 0; row <= rowsPerPage; row++) {
        const y = tableTop - headerHeight - row * rowHeight;
        page.drawLine({ start: { x: margin, y }, end: { x: margin + tableWidth, y }, thickness: 0.5 });
      }
      form.members.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage).forEach((member, row) => {
        const values = [String(pageIndex * rowsPerPage + row + 1), member.firstName, member.lastName, member.gender || "", member.idNumber || "", member.village || "", member.memberNumber, member.phone || ""];
        let cellX = margin;
        values.forEach((value, index) => {
          cellText(page, value, regular, cellX, tableTop - headerHeight - row * rowHeight, columnWidths[index], rowHeight, index === 0 || index === 3);
          cellX += columnWidths[index];
        });
      });
      if (pageCount > 1) centerText(`${pageIndex + 1} / ${pageCount}`, regular, 8, pageSize[0] / 2, 35);
    }
  }
  return document.save();
}
