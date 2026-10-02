import { deriveCopy } from "./copy";
import { deriveChoices, type ChoiceGroup } from "./collections";
import { deriveState, type Action, type StateInput } from "./feedback";
import { instantValue, type Presentation } from "./presentation";
import {
  action,
  build,
  content,
  issue,
  status,
  type Content,
  type Status,
  type Validation,
} from "./shared";
export interface Currency {
  readonly code: string;
  readonly fractionDigits: number;
}
export interface Money {
  readonly minor: string;
  readonly currency: Currency;
}
export const MIN_MONEY = -9223372036854775808n,
  MAX_MONEY = 9223372036854775807n;
export function currency(value: Currency, v: Validation, path: string) {
  v.need(/^[A-Z]{3}$/.test(value.code), `${path}.code`);
  v.need(
    Number.isInteger(value.fractionDigits) &&
      value.fractionDigits >= 0 &&
      value.fractionDigits <= 4,
    `${path}.fractionDigits`,
    "unsupported-format",
  );
}
export function money(value: Money, v: Validation, path: string, expected?: Currency): bigint {
  currency(value.currency, v, `${path}.currency`);
  v.need(/^(0|-?[1-9]\d*)$/.test(value.minor), `${path}.minor`);
  const amount = BigInt(value.minor);
  inRange(amount, v, path);
  if (expected)
    v.need(
      value.currency.code === expected.code &&
        value.currency.fractionDigits === expected.fractionDigits,
      `${path}.currency`,
    );
  return amount;
}
export function inRange(value: bigint, v: Validation, path: string) {
  v.need(value >= MIN_MONEY && value <= MAX_MONEY, path);
}
/** Only the small fractional remainder is converted to Number, never the amount. */
export function moneyText(value: Money, p: Presentation): string {
  const digits = value.currency.fractionDigits,
    amount = BigInt(value.minor),
    magnitude = amount < 0n ? -amount : amount,
    factor = 10n ** BigInt(digits);
  const formatter = new Intl.NumberFormat(p.locale, {
    style: "currency",
    currency: value.currency.code,
    currencyDisplay: "code",
    currencySign: "standard",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  const whole = new Intl.NumberFormat(p.locale, { maximumFractionDigits: 0 }).format(
    magnitude / factor,
  );
  const fraction = new Intl.NumberFormat(p.locale, {
    useGrouping: false,
    minimumIntegerDigits: Math.max(1, digits),
    maximumFractionDigits: 0,
  }).format(Number(magnitude % factor));
  let wrote = false;
  return formatter
    .formatToParts(amount < 0n ? -1 : 1)
    .map((part) => {
      if (part.type === "integer" || part.type === "group") {
        if (wrote) return "";
        wrote = true;
        return whole;
      }
      if (part.type === "fraction") return fraction;
      return part.value;
    })
    .join("");
}
export interface PriceInput {
  readonly amount: Money;
  readonly compareAt?: Money;
  readonly qualifier?: string;
  readonly kind: "price" | "estimate";
  readonly unitLabel?: string;
}
export function derivePrice(input: PriceInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const amount = money(input.amount, v, "amount");
    if (input.compareAt)
      v.need(money(input.compareAt, v, "compareAt", input.amount.currency) >= amount, "compareAt");
    v.need(input.kind === "price" || input.kind === "estimate", "kind");
    const text = moneyText(input.amount, p);
    return {
      text,
      compareAt: input.compareAt ? moneyText(input.compareAt, p) : undefined,
      label: input.kind === "estimate" ? p.copy.kit.estimate : p.copy.kit.price,
      qualifier: input.qualifier,
      unitLabel: input.unitLabel,
      accessibleLabel: [
        input.kind === "estimate" ? p.copy.kit.estimate : undefined,
        text,
        input.unitLabel,
        input.qualifier,
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}
export type PriceModel = Extract<ReturnType<typeof derivePrice>, { ok: true }>["value"];
export interface QuantityInput {
  readonly value: number;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly state: "ready" | "disabled" | "busy";
  readonly reason?: string;
  readonly label: string;
}
export function deriveQuantity(input: QuantityInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.text(input.label, "label");
    v.need(
      [input.value, input.min, input.max, input.step].every(Number.isSafeInteger) &&
        input.min >= 1 &&
        input.max >= input.min &&
        input.step >= 1,
      "bounds",
    );
    v.need(["ready", "disabled", "busy"].includes(input.state), "state");
    if (input.state === "disabled") v.text(input.reason, "reason");
    const valid =
      input.value >= input.min &&
      input.value <= input.max &&
      (input.value - input.min) % input.step === 0;
    const ready = valid && input.state === "ready";
    return {
      ...input,
      valid,
      issue: valid ? undefined : issue(p, "value", "validation"),
      decrease:
        ready && input.value - input.step >= input.min ? input.value - input.step : undefined,
      increase:
        ready && input.value + input.step <= input.max ? input.value + input.step : undefined,
      decreaseLabel: `${p.copy.kit.decrease}: ${input.label}`,
      increaseLabel: `${p.copy.kit.increase}: ${input.label}`,
      text: new Intl.NumberFormat(p.locale).format(input.value),
    };
  });
}
export type QuantityModel = Extract<ReturnType<typeof deriveQuantity>, { ok: true }>["value"];
export interface Adjustment {
  readonly id: string;
  readonly label: string;
  readonly amount: Money;
}
export interface TotalsInput {
  readonly currency: Currency;
  readonly lines: readonly {
    readonly id: string;
    readonly unitPrice: Money;
    readonly quantity: number;
  }[];
  readonly adjustments: readonly Adjustment[];
}
const arithmeticPresentation: Presentation = {
  copy: deriveCopy("en"),
  locale: "en-GB",
  timeZone: "UTC",
  weekStartsOn: 1,
  now: "2000-01-01T00:00:00Z",
  motion: "reduced",
};
export function cartTotals(input: TotalsInput) {
  return build(arithmeticPresentation, (v: Validation) => {
    currency(input.currency, v, "currency");
    v.ids(input.lines, "lines");
    v.ids(input.adjustments, "adjustments");
    const asMoney = (n: bigint): Money => ({ minor: n.toString(), currency: input.currency });
    const lines = input.lines.map((line, i) => {
      const unit = money(line.unitPrice, v, `lines.${i}.unitPrice`, input.currency);
      v.need(unit >= 0n, `lines.${i}.unitPrice`);
      v.need(Number.isSafeInteger(line.quantity) && line.quantity > 0, `lines.${i}.quantity`);
      const amount = unit * BigInt(line.quantity);
      inRange(amount, v, `lines.${i}.total`);
      return { id: line.id, amount: asMoney(amount) };
    });
    const subtotal = lines.reduce((sum, line) => sum + BigInt(line.amount.minor), 0n);
    inRange(subtotal, v, "subtotal");
    const adjusted = input.adjustments.reduce((sum, a, i) => {
      v.text(a.label, `adjustments.${i}.label`);
      return sum + money(a.amount, v, `adjustments.${i}.amount`, input.currency);
    }, 0n);
    const total = subtotal + adjusted;
    inRange(total, v, "total");
    v.need(total >= 0n, "total");
    return { lines, subtotal: asMoney(subtotal), total: asMoney(total) };
  });
}
export interface Product {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly price: PriceInput;
  readonly status?: Status;
  readonly availability: "available" | "sold-out" | "unavailable";
  readonly reason?: string;
  readonly imageId?: string;
  readonly open?: Action;
  readonly primary?: Action;
}
export interface ProductCardInput {
  readonly content: Content<{
    readonly product: Product;
    readonly options: readonly ChoiceGroup[];
    readonly quantity?: QuantityInput;
  }>;
}
export function deriveProductCard(input: ProductCardInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    if (input.content.phase !== "ready") return { ...base, product: undefined };
    const { product, options, quantity } = input.content.value;
    v.text(product.id, "product.id");
    v.text(product.title, "product.title");
    status(product.status, v, "product.status");
    v.need(
      ["available", "sold-out", "unavailable"].includes(product.availability),
      "product.availability",
    );
    v.ids(options, "options");
    const groups = options.map((o) => v.take(deriveChoices(o, p))),
      amount = v.take(derivePrice(product.price, p)),
      count = quantity ? v.take(deriveQuantity(quantity, p)) : undefined;
    const reason =
      product.availability !== "available"
        ? (product.reason ?? p.copy.kit.unavailable)
        : !base.writable || groups.some((g) => !g.satisfied) || (count && !count.valid)
          ? p.copy.kit.unavailable
          : undefined;
    return {
      ...base,
      product: {
        ...product,
        price: amount,
        options: groups,
        quantity: count,
        reason,
        open: product.open ? action(product.open, v, "product.open") : undefined,
        primary: product.primary
          ? action(product.primary, v, "product.primary", reason)
          : undefined,
      },
    };
  });
}
export type ProductCardModel = Extract<ReturnType<typeof deriveProductCard>, { ok: true }>["value"];
export interface CartLine {
  readonly id: string;
  readonly productId: string;
  readonly title: string;
  readonly optionsText?: string;
  readonly unitPrice: Money;
  readonly quantity: QuantityInput;
  readonly availability: Product["availability"];
  readonly reason?: string;
  readonly remove?: Action;
  readonly open?: Action;
}
export interface Quote {
  readonly id: string;
  readonly revision: string;
  readonly expiresAt: string;
  readonly total: Money;
}
export interface CartInput {
  readonly content: Content<readonly CartLine[]>;
  readonly currency: Currency;
  readonly adjustments: readonly Adjustment[];
  readonly quote?: Quote;
  readonly checkout: Action;
}
function quoteValid(quote: Quote | undefined, total: Money, v: Validation): boolean {
  if (!quote) return false;
  v.text(quote.id, "quote.id");
  v.text(quote.revision, "quote.revision");
  v.need(
    money(quote.total, v, "quote.total", total.currency) === BigInt(total.minor),
    "quote.total",
  );
  const expires = instantValue(quote.expiresAt);
  v.need(expires, "quote.expiresAt");
  return instantValue(v.p.now)! < expires;
}
function localizedTotals(input: TotalsInput, p: Presentation, v: Validation) {
  const result = cartTotals(input);
  if (!result.ok)
    return v.take<Extract<ReturnType<typeof cartTotals>, { ok: true }>["value"]>({
      ok: false,
      issues: result.issues.map((i) => ({
        ...i,
        message: i.code === "unsupported-format" ? p.copy.issue.unsupported : p.copy.issue.invalid,
      })),
    });
  return result.value;
}
export function deriveCart(input: CartInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    currency(input.currency, v, "currency");
    if (input.content.phase !== "ready") return { ...base, cart: undefined };
    const lines = input.content.value.map((line, i) => {
      v.text(line.productId, `lines.${i}.productId`);
      v.text(line.title, `lines.${i}.title`);
      v.need(
        ["available", "sold-out", "unavailable"].includes(line.availability),
        `lines.${i}.availability`,
      );
      return {
        ...line,
        quantity: v.take(deriveQuantity(line.quantity, p)),
        unit: moneyText(
          {
            ...line.unitPrice,
            minor: money(line.unitPrice, v, `lines.${i}.unitPrice`, input.currency).toString(),
          },
          p,
        ),
        remove: line.remove
          ? action(
              line.remove,
              v,
              `lines.${i}.remove`,
              base.writable ? undefined : p.copy.kit.unavailable,
            )
          : undefined,
        open: line.open ? action(line.open, v, `lines.${i}.open`) : undefined,
      };
    });
    const totals = localizedTotals(
      {
        currency: input.currency,
        lines: input.content.value.map((l) => ({
          id: l.id,
          unitPrice: l.unitPrice,
          quantity: l.quantity.value,
        })),
        adjustments: input.adjustments,
      },
      p,
      v,
    );
    const fresh = quoteValid(input.quote, totals.total, v);
    const eligible =
      fresh &&
      lines.length > 0 &&
      base.writable &&
      lines.every(
        (l) => l.availability === "available" && l.quantity.valid && l.quantity.state === "ready",
      );
    return {
      ...base,
      cart: {
        lines,
        subtotal: moneyText(totals.subtotal, p),
        total: moneyText(totals.total, p),
        adjustments: input.adjustments.map((a) => ({
          id: a.id,
          label: a.label,
          text: moneyText(a.amount, p),
        })),
        kindLabel: input.quote ? p.copy.kit.quote : p.copy.kit.estimate,
        subtotalLabel: p.copy.kit.subtotal,
        totalLabel: p.copy.kit.total,
        checkout: action(
          input.checkout,
          v,
          "checkout",
          eligible ? undefined : p.copy.kit.quoteExpired,
        ),
        target:
          eligible && input.quote
            ? { quoteId: input.quote.id, revision: input.quote.revision }
            : undefined,
        refreshLabel: p.copy.kit.refresh,
      },
    };
  });
}
export type CartModel = Extract<ReturnType<typeof deriveCart>, { ok: true }>["value"];
export interface SummaryInput {
  readonly lines: readonly {
    readonly id: string;
    readonly label: string;
    readonly amount: Money;
  }[];
  readonly adjustments: readonly Adjustment[];
  readonly currency: Currency;
  readonly quote?: Quote;
  readonly kind: "estimate" | "quote" | "receipt";
}
export function deriveSummary(input: SummaryInput, p: Presentation) {
  return build(p, (v: Validation) => {
    v.need(["estimate", "quote", "receipt"].includes(input.kind), "kind");
    v.need(input.kind !== "quote" || input.quote, "quote");
    const totals = localizedTotals(
      {
        currency: input.currency,
        lines: input.lines.map((l) => ({ id: l.id, unitPrice: l.amount, quantity: 1 })),
        adjustments: input.adjustments,
      },
      p,
      v,
    );
    const fresh = quoteValid(input.quote, totals.total, v);
    input.lines.forEach((l, i) => v.text(l.label, `lines.${i}.label`));
    return {
      title: p.copy.kit[input.kind],
      lines: [...input.lines, ...input.adjustments].map((l) => ({
        id: l.id,
        label: l.label,
        text: moneyText(l.amount, p),
      })),
      subtotal: moneyText(totals.subtotal, p),
      total: moneyText(totals.total, p),
      subtotalLabel: p.copy.kit.subtotal,
      totalLabel: p.copy.kit.total,
      issue: input.kind === "quote" && !fresh ? issue(p, "quote", "unavailable") : undefined,
    };
  });
}
export type SummaryModel = Extract<ReturnType<typeof deriveSummary>, { ok: true }>["value"];
export function deriveBuyBar(
  input: {
    readonly price: PriceInput;
    readonly action: Action;
    readonly quantity?: number;
    readonly notice?: StateInput;
  },
  p: Presentation,
) {
  return build(p, (v: Validation) => {
    if (input.quantity !== undefined)
      v.need(Number.isSafeInteger(input.quantity) && input.quantity > 0, "quantity");
    return {
      price: v.take(derivePrice(input.price, p)),
      bar: { label: p.copy.kit.actions, actions: [action(input.action, v, "action")] },
      quantity:
        input.quantity === undefined ? undefined : `${p.copy.kit.quantity}: ${input.quantity}`,
      notice: input.notice ? v.take(deriveState(input.notice, p)) : undefined,
    };
  });
}
export type BuyBarModel = Extract<ReturnType<typeof deriveBuyBar>, { ok: true }>["value"];
