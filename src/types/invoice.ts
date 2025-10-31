export type InvoiceItem = {
  id: string;
  description: string;
  unitPrice: number;
  quantity: number;
  taxRate?: number;
};

export type InvoiceStatus = "draft" | "terkirim" | "lunas";

export type Invoice = {
  id: string;
  clientName: string;
  date: string; // ISO date string
  dueDate?: string; // ISO date string
  status?: InvoiceStatus;
  note?: string;
  items: InvoiceItem[];
  total: number;
  customerId?: string;
};