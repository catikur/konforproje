export function toDate(value: string | Date): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}
