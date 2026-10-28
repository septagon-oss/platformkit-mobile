import React, { type ReactNode } from "react";
import { View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { ActionControl } from "../atoms/ActionControl";
import { MediaHero } from "../molecules/MediaHero";
import { ModelState } from "../molecules/ModelState";
import type { Props } from "./PhotoGallery";
import { useStyles, type Theme } from "../theme";
/**
 * MasonryWall is a wall of named pictures: two columns of cells, the states of the page it was
 * given, and the one foot control that asks for more of them. `header` is what a screen shows above
 * the cells inside this scroll view — the wall owns the only scroll view a page may have, so a
 * screen that has anything to say above the wall says it here rather than nesting a second page.
 */
export function MasonryWall({
  model,
  renderImage,
  onOpen,
  onMore,
  onRetry,
  columns,
  header,
}: Props & { readonly columns: 1 | 2 | 3; readonly header?: ReactNode }) {
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
      ListHeaderComponent={
        <>
          {header}
          <ModelState model={model} />
        </>
      }
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
