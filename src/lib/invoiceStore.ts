import type { Invoice } from "@/types/invoice";

let invoices: Invoice[] = [];

export function getInvoices() {
  return invoices;
}

export function getInvoice(id: string) {
  return invoices.find((inv) => inv.id === id) || null;
}

export function addInvoice(inv: Invoice) {
  invoices.push(inv);
  return inv;
}

export function updateInvoice(id: string, update: Partial<Invoice>) {
  const idx = invoices.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  invoices[idx] = { ...invoices[idx], ...update };
  return invoices[idx];
}

export function deleteInvoice(id: string) {
  const prevLen = invoices.length;
  invoices = invoices.filter((i) => i.id !== id);
  return invoices.length < prevLen;
}

export function seedInvoices(seed: Invoice[]) {
  invoices = seed;
}