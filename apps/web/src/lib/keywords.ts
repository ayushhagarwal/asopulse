export function parseKeywordInput(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]+/)
        .map((item) => item.trim().toLowerCase())
        .filter((item) => item.length >= 2),
    ),
  ];
}
