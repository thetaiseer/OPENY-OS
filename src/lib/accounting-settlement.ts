import { ACCOUNTING_COLLECTORS } from '@/lib/docs-types';

const EPS = 0.005;

export type AccountingSettlementInput = {
  entries: { amount: number; collector: string | null }[];
  expenses: { amount: number; paid_by_partner: string | null }[];
};

export type AccountingSettlementResult = {
  partners: readonly [string, string];
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  partnerShare: number;
  collectedBy: Record<string, number>;
  expensesPaidBy: Record<string, number>;
  netInHand: Record<string, number>;
  /** partnerShare - netInHand (negative ⇒ partner should pay out) */
  adjustment: Record<string, number>;
  debtor: string | null;
  creditor: string | null;
  settlementAmount: number;
  /** e.g. "Taiseer Mahmoud owes Ahmed Mansour" */
  settlementLine: string;
};

function roundMoney(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function matchPartner(raw: string | null, partners: readonly [string, string]): string {
  const t = (raw ?? '').trim();
  if (t === partners[0] || t === partners[1]) return t;
  if (t.toLowerCase().includes('taiseer')) return partners[0];
  if (t.toLowerCase().includes('ahmed')) return partners[1];
  return partners[0];
}

/**
 * Total Revenue − Expenses = Net Profit. Net Profit / 2 = each partner’s share.
 * Net in hand for a partner = revenue they collected − expenses they paid.
 * Adjustment = partnerShare − netInHand. Negative adjustment ⇒ that partner owes the other.
 */
export function computeAccountingSettlement(
  input: AccountingSettlementInput,
  partners: readonly [string, string] = [ACCOUNTING_COLLECTORS[0], ACCOUNTING_COLLECTORS[1]],
): AccountingSettlementResult {
  const [p0, p1] = partners;
  const totalRevenue = roundMoney(
    input.entries.reduce((s, e) => s + (Number.isFinite(e.amount) ? e.amount : 0), 0),
  );
  const totalExpenses = roundMoney(
    input.expenses.reduce((s, e) => s + (Number.isFinite(e.amount) ? e.amount : 0), 0),
  );
  const netProfit = roundMoney(totalRevenue - totalExpenses);
  const partnerShare = roundMoney(netProfit / 2);

  const collectedBy: Record<string, number> = { [p0]: 0, [p1]: 0 };
  for (const e of input.entries) {
    const who = matchPartner(e.collector, partners);
    collectedBy[who] = roundMoney((collectedBy[who] ?? 0) + (e.amount || 0));
  }

  const expensesPaidBy: Record<string, number> = { [p0]: 0, [p1]: 0 };
  for (const x of input.expenses) {
    const payer = matchPartner(x.paid_by_partner ?? p1, partners);
    expensesPaidBy[payer] = roundMoney((expensesPaidBy[payer] ?? 0) + (x.amount || 0));
  }

  const netInHand: Record<string, number> = {
    [p0]: roundMoney(collectedBy[p0] - expensesPaidBy[p0]),
    [p1]: roundMoney(collectedBy[p1] - expensesPaidBy[p1]),
  };

  const adjustment: Record<string, number> = {
    [p0]: roundMoney(partnerShare - netInHand[p0]),
    [p1]: roundMoney(partnerShare - netInHand[p1]),
  };

  let debtor: string | null = null;
  let creditor: string | null = null;
  let settlementAmount = 0;

  if (adjustment[p0] < -EPS) {
    debtor = p0;
    creditor = p1;
    settlementAmount = roundMoney(Math.abs(adjustment[p0]));
  } else if (adjustment[p1] < -EPS) {
    debtor = p1;
    creditor = p0;
    settlementAmount = roundMoney(Math.abs(adjustment[p1]));
  }

  const settlementLine = debtor
    ? `${debtor} owes ${creditor}: ${settlementAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : 'Partners are balanced (no net transfer).';

  return {
    partners,
    totalRevenue,
    totalExpenses,
    netProfit,
    partnerShare,
    collectedBy,
    expensesPaidBy,
    netInHand,
    adjustment,
    debtor,
    creditor,
    settlementAmount,
    settlementLine,
  };
}
