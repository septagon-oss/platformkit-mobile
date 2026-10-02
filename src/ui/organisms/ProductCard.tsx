import React from "react";
import { View } from "react-native";
import type { ProductCardModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Badge } from "../atoms/Badge";
import { Price } from "../atoms/Price";
import { Text } from "../atoms/Text";
import { ChoiceChips } from "../molecules/ChoiceChips";
import { ModelState } from "../molecules/ModelState";
import { QuantityControl } from "../molecules/QuantityControl";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export function ProductCard({
  model,
  image,
  onOpen,
  onAction,
  onOption,
  onQuantity,
}: {
  readonly model: ProductCardModel;
  readonly image?: React.ReactNode;
  readonly onOpen?: (id: string) => void;
  readonly onAction?: (productId: string, actionId: string) => void;
  readonly onOption?: (groupId: string, choiceId: string | undefined) => void;
  readonly onQuantity?: (value: number) => void;
}) {
  const s = useStyles(kitStyles),
    product = model.product;
  return (
    <View style={s.panel}>
      <ModelState model={model} />
      {product ? (
        <>
          {product.imageId ? (
            <View importantForAccessibility="no-hide-descendants">{image}</View>
          ) : null}
          <Text role="title" accessibilityRole="header">
            {product.title}
          </Text>
          {product.description ? <Text>{product.description}</Text> : null}
          {product.status ? (
            <Badge
              label={product.status.label}
              tone={product.status.tone}
              symbol={product.status.symbol}
            />
          ) : null}
          <Price model={product.price} />
          {product.reason ? <Text>{product.reason}</Text> : null}
          {onOption
            ? product.options.map((group) => (
                <ChoiceChips
                  key={group.id}
                  model={group}
                  onChange={(id) => onOption(group.id, id)}
                />
              ))
            : null}
          {product.quantity && onQuantity ? (
            <QuantityControl model={product.quantity} onChange={onQuantity} />
          ) : null}
          {product.open && onOpen ? (
            <ActionControl model={product.open} onAction={() => onOpen(product.id)} />
          ) : null}
          {product.primary && onAction ? (
            <ActionControl model={product.primary} onAction={(id) => onAction(product.id, id)} />
          ) : null}
        </>
      ) : null}
    </View>
  );
}
