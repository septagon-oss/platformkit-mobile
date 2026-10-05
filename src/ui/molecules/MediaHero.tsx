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
  // An image that never arrived is a sentence, not a hole shaped like an image:
  // the cover's aspect ratio is the space a picture would have taken, and a
  // failed specimen that reserves it reads as a page still waiting.
  const drawn = item.state === "ready" || item.state === "loading";
  // Whether this hero says the picture's name itself, in a line under the frame.
  // A control that takes the picture's words as its own label writes them too: the
  // name is then on the screen once, and the frame has nothing left to add.
  const named =
    Boolean(model.title || model.subtitle || item.caption) || (item.canOpen && Boolean(onOpen));
  const frame = (
    <View style={[s.image, drawn ? { aspectRatio: item.aspectRatio } : s.imageVoid]}>
      {drawn ? (
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
            ...(item.scene ? { scene: item.scene } : {}),
            // The name is written once: by this surface when it draws a line of
            // its own, and by the frame when the hero has no line to carry it.
            caption: named ? false : true,
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
