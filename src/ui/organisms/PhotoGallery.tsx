import React from "react";
import type { MediaModel } from "../../core/derive";
import { ActionControl } from "../atoms/ActionControl";
import { Text } from "../atoms/Text";
import { MediaHero, type ImageRenderer } from "../molecules/MediaHero";
import { ModelState } from "../molecules/ModelState";
import { GroupedListScreen } from "../templates/ListScreen";
export interface Props {
  readonly model: MediaModel;
  readonly renderImage: ImageRenderer;
  readonly onOpen: (id: string) => void;
  readonly onMore: () => void;
  readonly onRetry: (id: string) => void;
}
export function PhotoGallery({ model, renderImage, onOpen, onMore, onRetry }: Props) {
  return (
    <GroupedListScreen
      sections={[{ id: "images", data: model.items }]}
      keyOf={(item) => item.id}
      refreshing={model.refreshing}
      renderHeading={() => (
        <Text role="title" accessibilityRole="header">
          {model.title}
        </Text>
      )}
      render={(item) => (
        <MediaHero
          model={{ item, title: undefined, subtitle: undefined, action: undefined }}
          renderImage={renderImage}
          onOpen={onOpen}
          onRetry={onRetry}
        />
      )}
      header={<ModelState model={model} />}
      footer={model.more ? <ActionControl model={model.more} onAction={onMore} /> : null}
    />
  );
}
