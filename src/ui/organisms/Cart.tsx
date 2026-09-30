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
          {cart.lines.map((line) => (
            <View key={line.id} style={s.panel}>
              <Text role="title">{line.title}</Text>
              {line.optionsText ? <Text>{line.optionsText}</Text> : null}
              <Text>{line.unit}</Text>
              {line.reason ? <Text>{line.reason}</Text> : null}
              <QuantityControl
                model={line.quantity}
                onChange={(value) => onQuantity(line.id, value)}
              />
              {line.open ? (
                <ActionControl model={line.open} onAction={() => onOpen(line.id)} />
              ) : null}
              {line.remove ? (
                <ActionControl model={line.remove} onAction={() => onRemove(line.id)} />
              ) : null}
            </View>
          ))}
          <Text>{cart.kindLabel}</Text>
          <DetailRow term={cart.subtotalLabel} value={cart.subtotal} />
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
