import React from "react";
import type { SummaryModel } from "../../core/derive";
import { Notice } from "../atoms/Notice";
import { DetailRow } from "../molecules/DetailRow";
import { Section } from "../molecules/Section";
export function OrderSummary({ model }: { readonly model: SummaryModel }) {
  return (
    <Section title={model.title}>
      {model.lines.map((line) => (
        <DetailRow key={line.id} term={line.label} value={line.text} />
      ))}
      <DetailRow term={model.subtotalLabel} value={model.subtotal} />
      <DetailRow term={model.totalLabel} value={model.total} />
      {model.issue ? <Notice text={model.issue.message} announcement="polite" /> : null}
    </Section>
  );
}
