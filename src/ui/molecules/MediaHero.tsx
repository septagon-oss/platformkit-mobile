import React from "react";
import { View } from "react-native";
import type { ImageSlotProps, MediaHeroModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Skeleton } from "../atoms/Skeleton";
import { Text } from "../atoms/Text";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
export type ImageRenderer = (props: ImageSlotProps) => React.ReactNode;
export function MediaHero({
  model,
  renderImage,
  renderFrame,
  onOpen,
  onAction,
  onRetry,
  fit = "cover",
}: {
  readonly model: MediaHeroModel;
  readonly renderImage: ImageRenderer;
  readonly renderFrame?: (frame: React.ReactNode) => React.ReactNode;
  readonly onOpen?: (id: string) => void;
  readonly onAction?: (id: string) => void;
  readonly onRetry?: (id: string) => void;
  readonly fit?: "cover" | "contain";
}) {
  const s = useStyles(kitStyles),
    item = model.item;
  const frame = (
    <View style={[s.image, { aspectRatio: item.aspectRatio }]}>
      {item.state === "ready" || item.state === "loading" ? (
        <View
          style={[s.imageFill, item.state === "loading" && s.concealed]}
          accessibilityElementsHidden={item.state === "loading"}
          importantForAccessibility={item.state === "loading" ? "no-hide-descendants" : "auto"}
        >
          {renderImage({
            id: item.id,
            description: item.description,
            decorative: item.decorative,
            fit,
            aspectRatio: item.aspectRatio,
          })}
        </View>
      ) : null}
      {item.state === "loading" ? (
        <Skeleton label={item.loadingLabel} motion={item.motion} variant="media" />
      ) : item.reason ? (
        <Notice text={item.reason} announcement="polite" />
      ) : null}
    </View>
  );
  return (
    <View style={[s.stack, renderFrame && s.grow]}>
      {renderFrame ? renderFrame(frame) : frame}
      {model.title ? <Text role="title">{model.title}</Text> : null}
      {model.subtitle ? <Text>{model.subtitle}</Text> : null}
      {item.caption ? <Text>{item.caption}</Text> : null}
      {item.canOpen && onOpen ? (
        <Button label={item.description} tone="plain" onPress={() => onOpen(item.id)} />
      ) : null}
      {item.canRetry && onRetry ? (
        <Button label={item.retryLabel} tone="plain" onPress={() => onRetry(item.id)} />
      ) : null}
      {model.action && onAction ? <ActionControl model={model.action} onAction={onAction} /> : null}
    </View>
  );
}
