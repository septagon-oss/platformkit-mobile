import React from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ActionControl } from "../atoms/ActionControl";
import { MediaHero } from "../molecules/MediaHero";
import { ModelState } from "../molecules/ModelState";
import type { Props } from "./PhotoGallery";
import { useStyles, type Theme } from "../theme";
export function MasonryWall({
  model,
  renderImage,
  onOpen,
  onMore,
  onRetry,
  columns,
}: Props & { readonly columns: 1 | 2 | 3 }) {
  const s = useStyles(styles);
  return (
    <FlashList
      data={model.items}
      keyExtractor={(item) => item.id}
      masonry
      numColumns={columns}
      optimizeItemArrangement={false}
      contentContainerStyle={s.wall}
      renderItem={({ item }) => (
        // A match is named: the wall opens on the picture's own words, with the
        // metadata the item carries beneath them. Cells keep a gutter from one
        // another — two card borders touching read as one card, not two results.
        <View style={s.cell}>
          <MediaHero
            model={{ item, title: item.description, subtitle: undefined, action: undefined }}
            renderImage={renderImage}
            onOpen={onOpen}
            onRetry={onRetry}
          />
        </View>
      )}
      ListHeaderComponent={<ModelState model={model} />}
      ListFooterComponent={
        model.more ? <ActionControl model={model.more} onAction={onMore} /> : null
      }
    />
  );
}

const styles = (t: Theme) => ({
  wall: { padding: t.space.sm },
  cell: { paddingHorizontal: t.space.sm, paddingBottom: t.space.md },
});
