import {
  calculateQuoteTotals,
  lineTotalCents,
  parseMoneyToCents,
  parseQuantityToMilli,
  formatMoney,
  formatQuantity,
  type LineForTotals,
} from "../src/lib/crm/money";

let failures = 0;
function eq(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) console.log(`  ok  ${label}`);
  else { failures++; console.log(`FAIL  ${label}\n      expected ${e}\n      got      ${a}`); }
}

const QC = {
  id: "qc", label: "GST + QST (Quebec)",
  components: [
    { name: "GST", rate: 50_000 },
    { name: "QST", rate: 99_750 },
  ],
};
const EXEMPT = { id: "exempt", label: "No tax", components: [] };

const line = (over: Partial<LineForTotals>): LineForTotals => ({
  quantityMilli: 1000, unitPriceCents: 0, taxable: true, optional: false, selected: false, ...over,
});

console.log("— line totals —");
eq(lineTotalCents({ quantityMilli: 3333, unitPriceCents: 1000 }), 3333, "3.333 x $10.00 rounds per line to $33.33");
eq(lineTotalCents({ quantityMilli: 500, unitPriceCents: 8000 }), 4000, "0.5 x $80 = $40");
eq(lineTotalCents({ quantityMilli: 1500, unitPriceCents: 33 }), 50, "1.5 x $0.33 = 49.5c rounds to 50c");

console.log("— quebec tax —");
let t = calculateQuoteTotals([line({ unitPriceCents: 100_000 })], QC);
eq(t.taxes, [{ name: "GST", cents: 5000 }, { name: "QST", cents: 9975 }], "$1000: GST $50, QST $99.75 (not compounded)");
eq(t.totalCents, 114_975, "$1000 -> $1,149.75 total");

console.log("— known Quebec reference: $100 -> $114.98 (govt example) —");
t = calculateQuoteTotals([line({ unitPriceCents: 10_000 })], QC);
eq(t.taxes[0].cents, 500, "GST $5.00");
eq(t.taxes[1].cents, 998, "QST 997.5c rounds to $9.98");
eq(t.totalCents, 11_498, "total $114.98");

console.log("— discounts —");
t = calculateQuoteTotals([line({ unitPriceCents: 20_000 })], QC, { kind: "percent", value: 100_000 });
eq(t.discountCents, 2000, "10% of $200 is $20");
eq(t.adjustedTaxableCents, 18_000, "tax base reduced before tax");
t = calculateQuoteTotals([line({ unitPriceCents: 10_000 })], QC, { kind: "amount", value: 50_000 });
eq(t.discountCents, 10_000, "discount larger than subtotal clamps");
eq(t.totalCents, 0, "clamped discount cannot go negative");
t = calculateQuoteTotals(
  [line({ unitPriceCents: 10_000, taxable: false }), line({ unitPriceCents: 10_000 })],
  QC, { kind: "amount", value: 15_000 });
eq(t.adjustedNonTaxableCents, 0, "discount eats non-taxable first");
eq(t.adjustedTaxableCents, 5_000, "remainder hits taxable");

console.log("— optional lines —");
t = calculateQuoteTotals([line({ unitPriceCents: 10_000, optional: true, selected: false })], QC);
eq(t.totalCents, 0, "unticked optional counts nothing");
t = calculateQuoteTotals([line({ unitPriceCents: 10_000, optional: true, selected: true })], QC);
eq(t.subtotalCents, 10_000, "ticked optional counts");

console.log("— negative line (discount-line idiom) —");
t = calculateQuoteTotals([line({ unitPriceCents: 50_000 }), line({ unitPriceCents: -5_000 })], QC);
eq(t.taxableSubtotalCents, 45_000, "negative line reduces its subtotal");

console.log("— zero-component rate —");
t = calculateQuoteTotals([line({ unitPriceCents: 10_000 })], EXEMPT);
eq(t.totalTaxCents, 0, "exempt rate charges nothing");
eq(t.totalCents, 10_000, "total is bare subtotal");

console.log("— deposit —");
t = calculateQuoteTotals([line({ unitPriceCents: 100_000 })], QC, { kind: "none", value: 0 }, { kind: "percent", value: 500_000 });
eq(t.depositCents, 57_488, "50% deposit on $1,149.75 rounds to $574.88");
eq(t.balanceCents, 57_487, "balance is the remainder, sum reconciles");

console.log("— parsing —");
eq(parseMoneyToCents("$1,234.56"), 123456, "$1,234.56");
eq(parseMoneyToCents("1 234,56 $"), 123456, "french 1 234,56 $");
eq(parseMoneyToCents("1,5"), 150, "lone comma short decimals");
eq(parseMoneyToCents("1,500"), 150000, "lone comma as thousands");
eq(parseMoneyToCents("2 500 $"), 250000, "space thousands");
eq(parseMoneyToCents("1.234,56"), 123456, "european dot-thousands");
eq(parseMoneyToCents("-50"), -5000, "negative");
eq(parseMoneyToCents("(50)"), -5000, "accounting parens negative");
eq(parseMoneyToCents(""), null, "blank is null");
eq(parseMoneyToCents("abc"), null, "garbage is null");
eq(parseMoneyToCents("12."), 1200, "trailing dot");
eq(parseQuantityToMilli("12.375"), 12375, "3dp quantity survives");
eq(parseQuantityToMilli("0,5"), 500, "french quantity");

console.log("— formatting —");
eq(formatMoney(123456, "en"), "$1,234.56", "en format");
eq(formatQuantity(12375), "12.375", "quantity trims");
eq(formatQuantity(12000), "12", "whole quantity");
console.log("fr format sample:", formatMoney(123456, "fr"));

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
