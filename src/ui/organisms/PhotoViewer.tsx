import React from "react";
import { Modal, View } from "react-native";
import type { ViewerModel } from "../../core/derive";
import { Button } from "../atoms/Button";
import { Notice } from "../atoms/Notice";
import { Text } from "../atoms/Text";
import { MediaHero, type ImageRenderer } from "../molecules/MediaHero";
import { kitStyles } from "../layout";
import { useStyles } from "../theme";
import { useCanvas } from "../templates/canvas";
export interface ZoomSlotProps {
  readonly id: string;
  readonly aspectRatio: number;
  readonly motion: ViewerModel["motion"];
  readonly labels: ViewerModel["labels"];
  readonly children: React.ReactNode;
}
export interface Props {
  readonly model: ViewerModel;
  readonly renderImage: ImageRenderer;
  readonly renderZoom: (props: ZoomSlotProps) => React.ReactNode;
  readonly onSelect: (id: string) => void;
  readonly onClose: () => void;
  readonly onRetry: (id: string) => void;
  readonly onPresented?: () => void;
  readonly onClosed?: () => void;
}
export function PhotoViewer({
  model,
  renderImage,
  renderZoom,
  onSelect,
  onClose,
  onRetry,
  onPresented,
  onClosed,
}: Props) {
  const s = useStyles(kitStyles),
    canvas = useCanvas(),
    selected = model.selected;
  return (
    <Modal
      visible={model.open}
      animationType="none"
      onShow={onPresented}
      onDismiss={onClosed}
      onRequestClose={onClose}
    >
      <View style={canvas.page} accessibilityViewIsModal onAccessibilityEscape={onClose}>
        <View style={s.header}>
          <Button label={model.labels.close} tone="plain" onPress={onClose} />
          {model.position ? <Text accessibilityLiveRegion="polite">{model.position}</Text> : null}
        </View>
        {model.selectionIssue ? (
          <Notice text={model.selectionIssue.message} announcement="polite" />
        ) : selected ? (
          <View key={selected.id} style={s.grow}>
            <MediaHero
              model={{
                item: selected,
                title: undefined,
                subtitle: undefined,
                action: undefined,
              }}
              renderImage={renderImage}
              fit="contain"
              onRetry={onRetry}
              renderFrame={(children) =>
                renderZoom({
                  id: selected.id,
                  aspectRatio: selected.aspectRatio,
                  motion: model.motion,
                  labels: model.labels,
                  children,
                })
              }
            />
          </View>
        ) : null}
        <View style={[s.footer, canvas.footer]}>
          <Button
            label={model.labels.previous}
            tone="secondary"
            disabled={!model.previous}
            onPress={() => {
              if (model.previous) onSelect(model.previous);
            }}
          />
          <Button
            label={model.labels.next}
            tone="secondary"
            disabled={!model.next}
            onPress={() => {
              if (model.next) onSelect(model.next);
            }}
          />
        </View>
      </View>
    </Modal>
  );
}
