const FORMULA_PREFIX = /^[=+\-@]/;

const escapeCell = (value: unknown) => {
  let text = String(value ?? "");
  if (FORMULA_PREFIX.test(text.trim())) text = `'${text}`;
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export function toCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0] ?? {});
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCell(row[header])).join(",")),
  ].join("\n");
}
