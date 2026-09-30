import React from "react";
import { FlashList } from "@shopify/flash-list";
import { ActionControl } from "../atoms/ActionControl";
import { MediaHero } from "../molecules/MediaHero";
import { ModelState } from "../molecules/ModelState";
import type { Props } from "./PhotoGallery";
export function MasonryWall({
  model,
  renderImage,
  onOpen,
  onMore,
  onRetry,
  columns,
}: Props & { readonly columns: 1 | 2 | 3 }) {
  return (
    <FlashList
      data={model.items}
      keyExtractor={(item) => item.id}
      masonry
      numColumns={columns}
      optimizeItemArrangement={false}
      renderItem={({ item }) => (
        <MediaHero
          model={{ item, title: undefined, subtitle: undefined, action: undefined }}
          renderImage={renderImage}
          onOpen={onOpen}
          onRetry={onRetry}
        />
      )}
      ListHeaderComponent={<ModelState model={model} />}
      ListFooterComponent={
        model.more ? <ActionControl model={model.more} onAction={onMore} /> : null
      }
    />
  );
}
