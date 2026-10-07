import React from "react";
import { View } from "react-native";
import type { CartModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Button } from "../atoms/Button";
import { Text } from "../atoms/Text";
import { ModelState } from "../molecules/ModelState";
import { QuantityControl } from "../molecules/QuantityControl";
import { DetailRow } from "../molecules/DetailRow";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function Cart({
  model,
  onQuantity,
  onRemove,
  onOpen,
  onCheckout,
  onRefresh,
}: {
  readonly model: CartModel;
  readonly onQuantity: (id: string, value: number) => void;
  readonly onRemove: (id: string) => void;
  readonly onOpen: (id: string) => void;
  readonly onCheckout: (quote: { readonly quoteId: string; readonly revision: string }) => void;
  readonly onRefresh: () => void;
}) {
  const s = useStyles(kitStyles),
    cart = model.cart;
  return (
    <View style={s.stack}>
      <ModelState model={model} onRetry={onRefresh} />
      {cart ? (
        <>
          {/* One thing in the basket is one card: its name with the price of one
              beside it, and beneath that the two acts a line offers — how many,
              and take it away — in one row instead of one row each. */}
          {cart.lines.map((line) => (
            <View key={line.id} style={s.panel}>
              <View style={s.row}>
                <Text role="title" style={s.grow}>
                  {line.title}
                </Text>
                <Text tone="muted">{line.unit}</Text>
              </View>
              {line.optionsText ? (
                <Text role="caption" tone="muted">
                  {line.optionsText}
                </Text>
              ) : null}
              {line.reason ? (
                <Text role="caption" tone="muted">
                  {line.reason}
                </Text>
              ) : null}
              <View style={s.row}>
                <QuantityControl
                  model={line.quantity}
                  onChange={(value) => onQuantity(line.id, value)}
                />
                {line.remove ? (
                  <ActionControl model={line.remove} onAction={() => onRemove(line.id)} />
                ) : null}
              </View>
              {line.open ? (
                <ActionControl model={line.open} onAction={() => onOpen(line.id)} />
              ) : null}
            </View>
          ))}
          <Text>{cart.kindLabel}</Text>
          {/* A subtotal the total repeats says nothing the total has not said, so
              the line appears only when the two differ — a discount, a fee, a tax.
              Adjustments always stand between them as what makes them differ. */}
          {cart.adjustments.length > 0 || cart.subtotal !== cart.total ? (
            <DetailRow term={cart.subtotalLabel} value={cart.subtotal} />
          ) : null}
          {cart.adjustments.map((a) => (
            <DetailRow key={a.id} term={a.label} value={a.text} />
          ))}
          <DetailRow term={cart.totalLabel} value={cart.total} />
          <ActionControl
            model={cart.checkout}
            onAction={() => {
              if (cart.target) onCheckout(cart.target);
            }}
          />
          <Button label={cart.refreshLabel} tone="plain" onPress={onRefresh} />
        </>
      ) : null}
    </View>
  );
}
