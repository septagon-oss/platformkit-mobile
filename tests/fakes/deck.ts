import { readFileSync } from "node:fs";
import { parseCatalog } from "../../src/core/catalog";

export function deckDocument() {
  const doc = JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
  const entry = doc.resources[0];
  entry.commands = [
    { verb: "accept", summary: "Accept", presentation: { label: "Accept" } },
    {
      verb: "archive",
      summary: "Archive",
      presentation: {
        label: "Archive",
        destructive: true,
        confirmation: { body: "Archive this item?" },
      },
    },
  ];
  entry.presentation = {
    primaryField: "title",
    statusField: "status",
    sortable: ["title"],
    deck: {
      queue: ["status:open"],
      order: "title",
      directions: {
        left: { command: "archive", label: "Archive", tone: "danger", icon: "box" },
        down: { skip: true },
        right: { command: "accept", label: "Accept", tone: "success", icon: "task" },
      },
    },
  };
  return doc;
}
export const deckEntryFixture = () => parseCatalog(deckDocument()).resources[0]!;
export const deckRows = [
  { id: "A", title: "Apple", status: "open", rank: 4 },
  { id: "B", title: "Birch", status: "open", rank: 8 },
  { id: "C", title: "Cedar", status: "open", rank: 12 },
];
