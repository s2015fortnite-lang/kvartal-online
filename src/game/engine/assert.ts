export function requireRule(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
export function amount(value: number) { requireRule(Number.isSafeInteger(value) && value >= 0, 'Сумма должна быть целым неотрицательным числом.'); }
