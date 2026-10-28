// The wall organism is a virtualised list: on a device it mounts the cells inside the viewport and
// nothing else, so a suite that watches a cell arrive after the first paint, or that mounts the wall
// twice, reads a list that no longer answers. This draws the same page the organism draws — its
// header, its cells, its states, its one foot control — with every cell in the tree, which is what a
// component suite has to see in order to count one. Its props are the organism's, unchanged.
import React, { type ReactNode } from "react";
import { View } from "react-native";
import type { MediaModel } from "../../src/core/media";
import { ActionControl } from "../../src/ui/atoms/ActionControl";
import { MediaHero } from "../../src/ui/molecules/MediaHero";
import { ModelState } from "../../src/ui/molecules/ModelState";
import type { Props } from "../../src/ui/organisms/PhotoGallery";

export function MasonryWall({
  model,
  renderImage,
  onOpen,
  onMore,
  onRetry,
  header,
}: Props & { readonly columns: 1 | 2 | 3; readonly header?: ReactNode }) {
  const page = model as MediaModel;
  return (
    <View>
      {header}
      <ModelState model={page} />
      {page.items.map((item) => (
        <View key={item.id} testID="media-cell">
          <MediaHero
            model={{
              item,
              title: item.description,
              subtitle: undefined,
              action: undefined,
            }}
            renderImage={renderImage}
            onOpen={onOpen}
            onRetry={onRetry}
          />
        </View>
      ))}
      {page.more ? <ActionControl model={page.more} onAction={onMore} /> : null}
    </View>
  );
}
