import { generateProIconKsa } from './proIconKsa';

export const invoiceTemplates = {
  pro_icon_ksa: generateProIconKsa,
} as const;

export { generateProIconKsa } from './proIconKsa';
export * from './types';
