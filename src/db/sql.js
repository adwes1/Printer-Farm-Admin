export function quoteSql(value) {
  if (value === null || value === undefined) {
    return "NULL";
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function numberSql(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? String(Math.max(0, number)) : "0";
}

export function parsePositiveId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}
