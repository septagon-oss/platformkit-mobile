import { deriveChoices } from "./collections";
import { derivePrice, type PriceInput } from "./commerce";
import type { Action } from "./feedback";
import type { Presentation } from "./presentation";
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
export interface BillingPeriod {
  readonly id: string;
  readonly label: string;
}
export interface Feature {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}
export type FeatureValue =
  | { readonly kind: "included" | "excluded" | "unknown" }
  | { readonly kind: "text"; readonly text: string };
export interface Plan {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly badge?: Status;
  readonly offers: readonly {
    readonly periodId: string;
    readonly price: PriceInput | { readonly kind: "contact"; readonly label: string };
    readonly action?: Action;
  }[];
  readonly features: Readonly<Record<string, FeatureValue>>;
}
export interface PricingInput {
  readonly content: Content<readonly Plan[]>;
  readonly periods: readonly BillingPeriod[];
  readonly selectedPeriodId: string;
  readonly selectedPlanId?: string;
  readonly currentPlanId?: string;
  readonly features: readonly Feature[];
}
export function derivePricing(input: PricingInput, p: Presentation) {
  return build(p, (v: Validation) => {
    const base = content(input.content, v);
    v.ids(input.periods, "periods");
    v.ids(input.features, "features");
    input.features.forEach((f) => v.text(f.label, "features.label"));
    const periods = v.take(
      deriveChoices(
        {
          id: "period",
          label: p.copy.kit.period,
          choices: input.periods.map((period) => ({ ...period, enabled: true })),
          selectedId: input.selectedPeriodId,
          required: true,
        },
        p,
      ),
    );
    const plans = input.content.phase === "ready" ? input.content.value : [];
    v.ids(plans, "plans");
    const rows = plans.map((plan, i) => {
      v.text(plan.title, `plans.${i}.title`);
      status(plan.badge, v, `plans.${i}.badge`);
      const seen = new Set<string>();
      const offers = plan.offers.map((offer, j) => {
        v.need(
          !seen.has(offer.periodId) && input.periods.some((period) => period.id === offer.periodId),
          `plans.${i}.offers.${j}.periodId`,
        );
        seen.add(offer.periodId);
        if (offer.price.kind === "contact")
          v.text(offer.price.label, `plans.${i}.offers.${j}.price`);
        return {
          periodId: offer.periodId,
          price: offer.price.kind === "contact" ? undefined : v.take(derivePrice(offer.price, p)),
          contact: offer.price.kind === "contact" ? offer.price.label : undefined,
          action: offer.action
            ? action(
                offer.action,
                v,
                `plans.${i}.offers.${j}.action`,
                base.writable ? undefined : p.copy.kit.unavailable,
              )
            : undefined,
        };
      });
      Object.keys(plan.features).forEach((id) =>
        v.need(
          input.features.some((f) => f.id === id),
          `plans.${i}.features.${id}`,
        ),
      );
      const features = input.features.map((f) => {
        const value = plan.features[f.id] ?? { kind: "unknown" };
        v.need(
          ["included", "excluded", "unknown", "text"].includes(value.kind),
          `plans.${i}.features.${f.id}`,
        );
        if (value.kind === "text") v.text(value.text, `plans.${i}.features.${f.id}.text`);
        const text =
          value.kind === "text"
            ? value.text
            : value.kind === "included"
              ? p.copy.kit.included
              : value.kind === "excluded"
                ? p.copy.kit.notIncluded
                : p.copy.kit.unknown;
        return {
          id: f.id,
          label: f.label,
          text,
          accessibleLabel: `${f.label}, ${plan.title}: ${text}`,
        };
      });
      const offer = offers.find((o) => o.periodId === input.selectedPeriodId);
      return {
        id: plan.id,
        title: plan.title,
        description: plan.description,
        badge: plan.badge,
        selected: plan.id === input.selectedPlanId,
        current: plan.id === input.currentPlanId ? p.copy.kit.current : undefined,
        offer,
        enabled: !!offer && !periods.issue,
        reason: offer ? undefined : p.copy.kit.unavailable,
        features,
        selectLabel: `${p.copy.kit.select}: ${plan.title}`,
        target: { planId: plan.id, periodId: input.selectedPeriodId, actionId: offer?.action?.id },
      };
    });
    const model = {
      ...base,
      periods,
      plans: rows,
      selectionIssue:
        input.selectedPlanId && !rows.some((row) => row.selected && row.enabled)
          ? issue(p, "selectedPlanId", "unavailable")
          : undefined,
    };
    return { tiers: model, comparison: model };
  });
}
export type PricingModel = Extract<
  ReturnType<typeof derivePricing>,
  { ok: true }
>["value"]["tiers"];
export type PlanComparisonModel = PricingModel;
