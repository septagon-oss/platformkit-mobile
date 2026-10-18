import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parseCatalog } from "../src/core/catalog";
import {
  avatar,
  avatarStack,
  avatarTone,
  entryIcon,
  initials,
  listRow,
  personRecord,
  personValue,
  rowMedia,
  thumbnailField,
  visiblePictures,
} from "../src/core/derive";
import { variantWidth } from "../src/core/prose";
import { fileResource } from "../src/effects/files";
import { feedback } from "./fakes/presentation";

const FILE = "0d69a227-b007-43c1-865f-60f6c3b25a61";
const OTHER = "2b146a3d-2cc4-4a6b-b008-227484fb602e";
const source = "/api/v1/file/files/{id}/content";
const golden = () => JSON.parse(readFileSync("testdata/catalog.json", "utf8"));
function pictured() {
  const doc = golden();
  doc.pictures = { source, widths: [320, 640, 1280] };
  doc.resources[0].fields.push(
    { name: "poster", type: "uuid", present: "image" },
    { name: "small", type: "uuid", present: "image" },
  );
  doc.resources[0].presentation = {
    icon: "document",
    coverField: "poster",
    thumbnailField: "small",
  };
  return doc;
}

test("person tones have independent stable vectors and never use danger", () => {
  for (const [id, tone] of [
    ["a", "info"],
    ["b", "ok"],
    ["c", "warning"],
    ["d", "neutral"],
    ["Åsa", "info"],
    ["person-17", "neutral"],
  ] as const) {
    assert.equal(avatarTone(id), tone);
    assert.equal(avatarTone(id), tone);
  }
  assert.equal(avatarTone(" \t"), "neutral");
  for (let i = 0; i < 10000; i++)
    assert.ok(["info", "ok", "warning", "neutral"].includes(avatarTone(String(i))));
});
test("initials use Unicode code points and never manufacture a name", () => {
  assert.equal(initials("  Ana María Silva \n"), "AS");
  assert.equal(initials("Éva Stone"), "ÉS");
  assert.equal(initials("李"), "李");
  assert.equal(initials("𐐀na Zee"), "𐐀Z");
  assert.equal(avatar({ id: "b", label: "Name unavailable" }).initials, "");
});
test("groups deduplicate IDs in order and distinguish visible remainder from spoken others", () => {
  const people = ["Ana", "Ben", "Cleo", "Davi", "Éva"].map((name, i) => ({
    id: String(i),
    name,
    label: name,
  }));
  const stack = avatarStack([...people, people[0]!], feedback);
  assert.equal(stack.people.length, 3);
  assert.equal(stack.remainder, "+2");
  assert.equal(stack.description, "Ana and 4 others");
  assert.equal(avatarStack([], feedback).description, "");
  assert.equal(avatarStack(people.slice(0, 1), feedback).description, "Ana");
  assert.equal(avatarStack(people.slice(0, 2), feedback).description, "Ana and 1 other");
});
test("picture templates refuse external origins, encodings and ambiguous substitutions", () => {
  for (const bad of [
    "https://elsewhere.test/{id}",
    "//elsewhere.test/{id}",
    "/api/v1/../{id}",
    "/api/v1/%2e/{id}",
    "/api/v1/{id}?token=x",
    "/api/v1/prefix-{id}",
    "/api/v1/{id}/{id}",
    "/api/v1/{other}",
    "/api/v1/{id}#x",
    "/api/v1/\\/{id}",
  ]) {
    const doc = pictured();
    doc.pictures.source = bad;
    const notices: string[] = [];
    assert.equal(parseCatalog(doc, (at) => notices.push(at)).pictures, undefined, bad);
    assert.deepEqual(notices, ["pictures.source"]);
  }
});
test("defective widths keep the valid original door and never remember a server's width set", () => {
  for (const bad of [[640, 320], [320, 320], [0], [-1], [1.5], "640"]) {
    const doc = pictured();
    doc.pictures.widths = bad;
    assert.deepEqual(parseCatalog(doc).pictures, { source });
  }
  assert.equal(variantWidth(350, 2000, [320, 640, 1280]), 640);
  assert.equal(variantWidth(3000, 4000, [320, 640, 1280]), 1280);
  assert.equal(variantWidth(350, 200, [320, 640]), 0);
  assert.equal(variantWidth(350, 0, [320, 640]), 640);
  assert.equal(variantWidth(350, 2000), 0);
});
test("thumbnail selection falls back from a bad field but never from its empty value", () => {
  const doc = pictured();
  let entry = parseCatalog(doc).resources[0]!;
  assert.equal(thumbnailField(entry)?.name, "small");
  assert.deepEqual(rowMedia(entry, { poster: FILE }, true), { kind: "icon", icon: "document" });
  assert.equal(rowMedia(entry, { small: FILE, poster: OTHER }, true).kind, "picture");
  doc.resources[0].fields.find((f: { name: string }) => f.name === "small").presentation = {
    visibility: "hidden",
  };
  const notices: string[] = [];
  entry = parseCatalog(doc, (at) => notices.push(at)).resources[0]!;
  assert.equal(thumbnailField(entry)?.name, "poster");
  assert.ok(notices.includes("resources[0].presentation.thumbnailField"));
  assert.equal(rowMedia(entry, { poster: "https://elsewhere.test/image" }, true).kind, "icon");
  assert.equal(rowMedia(entry, { poster: FILE }, false).kind, "icon");
  const noIcon = { ...entry, hints: { thumbnailField: "poster" } };
  assert.equal(
    listRow(noIcon, { poster: FILE }, feedback, feedback.copy.kit.untitled).media,
    undefined,
  );
  assert.equal(
    listRow(noIcon, { poster: FILE }, feedback, feedback.copy.kit.untitled, undefined, true, {
      [FILE]: "error",
    }).media,
    undefined,
  );
});
test("portraits follow presentation and visibility rather than a field's name", () => {
  const entry = parseCatalog(pictured()).resources[0]!;
  const person = {
    ...entry,
    fields: [
      { name: "displayName", type: "string" as const },
      { name: "avatar", type: "uuid" as const },
      {
        name: "privatePortrait",
        type: "uuid" as const,
        present: "avatar",
        hints: { visibility: "hidden" as const },
      },
      { name: "portrait", type: "uuid" as const, present: "avatar", hideList: true },
    ],
  };
  const row = {
    id: "ana",
    displayName: "Ana",
    avatar: OTHER,
    privatePortrait: OTHER,
    portrait: FILE,
  };
  assert.equal(personRecord(person, row, "row").portrait, undefined);
  assert.equal(personRecord(person, row, "detail").portrait, FILE);
  const field = {
    name: "authors",
    type: "list" as const,
    elem: "uuid" as const,
    hints: { reference: { resource: "user/user" } },
  };
  const group = personValue(field, ["ana", "ben"], feedback, { "user/user|ana": "Ana" });
  assert.equal(group?.description, "Ana and 1 other");
  assert.equal(group?.people[1]?.initials, "");
  assert.deepEqual(
    visiblePictures(
      entry,
      [
        { id: "one", small: FILE },
        { id: "two", small: FILE },
      ],
      {},
      "row",
      feedback,
    ),
    [FILE],
  );
});
test("compact bytes require a bearer, stay on the selected server and scope only public versioned caching", () => {
  const catalog = parseCatalog(pictured());
  const input = {
    server: "https://workspace.test/",
    userId: "person-a",
    entry: undefined,
    id: FILE,
    version: "content-v3",
    width: 640,
    attempt: 0,
    key: { id: "key-a", token: "a-secret" },
    pictures: catalog.pictures,
    generation: "session-1",
    public: true,
  };
  const resource = fileResource(input)!;
  assert.equal(resource.uri, `https://workspace.test/api/v1/file/files/${FILE}/content?w=640`);
  assert.deepEqual(resource.headers, { Authorization: "Bearer a-secret" });
  assert.equal(resource.cachePolicy, "memory");
  assert.ok(!resource.cacheKey?.includes("a-secret"));
  assert.equal(fileResource({ ...input, key: undefined }), undefined);
  assert.equal(fileResource({ ...input, userId: undefined }), undefined);
  assert.equal(fileResource({ ...input, id: FILE.toUpperCase() }), undefined);
  assert.equal(fileResource({ ...input, public: false })?.cachePolicy, "none");
  assert.equal(fileResource({ ...input, version: "" })?.cachePolicy, "none");
  assert.equal(
    fileResource({ ...input, pictures: undefined, entry: parseCatalog(golden()).resources[0] })
      ?.cachePolicy,
    "none",
  );
  assert.notEqual(fileResource({ ...input, userId: "person-b" })?.cacheKey, resource.cacheKey);
  assert.notEqual(fileResource({ ...input, generation: "session-2" })?.cacheKey, resource.cacheKey);
  assert.notEqual(
    fileResource({ ...input, key: { ...input.key, id: "key-b" } })?.cacheKey,
    resource.cacheKey,
  );
  assert.equal(
    fileResource({ ...input, width: 999 })?.uri,
    `https://workspace.test/api/v1/file/files/${FILE}/content`,
  );
});

test("the public served capture retains the picture door, cover, assignee and author contracts", async () => {
  const { createHash } = await import("node:crypto");
  const { createApi } = await import("../src/effects/api");
  const bytes = readFileSync("testdata/catalog.pictures.json");
  const receipt = JSON.parse(readFileSync("testdata/catalog.pictures.source.json", "utf8"));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), receipt.sha256);
  assert.equal(receipt.upstream.commit, "42d4b8e8c21d4b7a512d2437c20ee5c729dbecc0");
  const doc = JSON.parse(bytes.toString("utf8"));
  const notices: string[] = [];
  const catalog = parseCatalog(doc, (at) => notices.push(at));
  assert.deepEqual(notices, ["resources[3].presentation.icon"]);
  assert.deepEqual(catalog.pictures, {
    source: "/api/v1/file/files/{id}/content",
    widths: [480, 960, 1440, 1920],
  });
  const content = catalog.resources.find((e) => e.module === "content" && e.entity === "content")!;
  assert.equal(thumbnailField(content)?.name, "coverImageId");
  assert.equal(
    content.fields.find((f) => f.name === "author")?.hints?.reference?.resource,
    "user/user",
  );
  const task = catalog.resources.find((e) => e.module === "task" && e.entity === "task")!;
  assert.equal(
    task.fields.find((f) => f.name === "assigneeId")?.hints?.reference?.resource,
    "user/user",
  );
  const api = createApi(
    "https://fixture.test",
    async () => new Response(bytes, { headers: { "Content-Type": "application/json" } }),
  );
  assert.equal((await api.operations.appResources({})).data.catalogVersion, 2);
});

test("failed or unsupported memory purges do not reject session cleanup", async () => {
  const { clearImageMemory } = await import("../src/effects/native-images");
  await assert.doesNotReject(clearImageMemory(async () => false));
  await assert.doesNotReject(
    clearImageMemory(async () => {
      throw new Error("Unavailable native cache");
    }),
  );
});

test("a directory row carries its own stable avatar while ordinary resources keep media tiles", async () => {
  const user = {
    ...parseCatalog(pictured()).resources[0]!,
    module: "user",
    entity: "user",
    fields: [
      { name: "id", type: "uuid" as const },
      { name: "displayName", type: "string" as const },
      { name: "portraitFile", type: "uuid" as const, present: "avatar" },
    ],
  };
  const row = listRow(
    user,
    { id: "a", displayName: "Ana Stone", portraitFile: FILE },
    feedback,
    feedback.copy.kit.untitled,
    undefined,
    true,
  );
  assert.equal(row.title, "Ana Stone");
  assert.equal(row.avatar?.initials, "AS");
  assert.equal(row.avatar?.tone, "info");
  assert.equal(row.avatar?.image?.slot.id, FILE);
  assert.equal(row.media, undefined);
});

test("image reads exclude hidden group discs, collapsed facts and unrelated activity people", async () => {
  const { eventPictures } = await import("../src/core/derive");
  const pictures = [
    FILE,
    OTHER,
    "3b73f940-6cf7-473e-bc07-c0f939411eef",
    "446062ee-90ee-4d29-b933-9809bda0eac6",
  ];
  const people = Object.fromEntries(
    pictures.map((portrait, i) => [
      `user/user|${i}`,
      { id: String(i), resource: "user/user", label: `Person ${i}`, portrait },
    ]),
  );
  const entry = parseCatalog(pictured()).resources[0]!;
  const field = {
    name: "authors",
    type: "list" as const,
    elem: "uuid" as const,
    hints: { reference: { resource: "user/user" } },
  };
  const group = {
    ...entry,
    hints: { summaryFields: ["authors"] },
    fields: [...entry.fields, field],
  };
  const row = { id: "group", title: "The authors", authors: ["0", "1", "2", "3"] };
  assert.deepEqual(visiblePictures(group, [row], people, "row", feedback), pictures.slice(0, 3));
  const detail = {
    ...group,
    fields: [
      ...entry.fields,
      { ...field, hints: { ...field.hints, visibility: "detail" as const } },
    ],
  };
  assert.deepEqual(visiblePictures(detail, [row], people, "detail", feedback, false), []);
  assert.deepEqual(
    visiblePictures(detail, [row], people, "detail", feedback, true),
    pictures.slice(0, 3),
  );
  const trail = {
    events: [
      { id: "event", name: "task.assigned", occurredAt: "2026-01-10T12:00:00Z", actor: "0" },
    ],
    people: { "0": people["user/user|0"]!, "3": people["user/user|3"]! },
    names: {},
    loading: false,
    error: "",
    more: false,
    loadingMore: false,
  };
  assert.deepEqual(eventPictures(trail), [FILE]);
  assert.deepEqual(eventPictures({ ...trail, excluded: true }), []);
});

test("the icon an entry declared is answered once, whichever surface asks", () => {
  const entry = parseCatalog(pictured()).resources[0]!;
  assert.equal(entryIcon(entry), "document");
  assert.deepEqual(rowMedia(entry, {}, false), { kind: "icon", icon: "document" });
  const doc = pictured();
  doc.resources[0].presentation = { icon: "rocket", coverField: "poster" };
  const notices: string[] = [];
  const odd = parseCatalog(doc, (at) => notices.push(at)).resources[0]!;
  assert.equal(entryIcon(odd), undefined, "a word outside the set draws nothing, here or on a row");
  assert.ok(notices.includes("resources[0].presentation.icon"));
  assert.equal(rowMedia(odd, {}, false).kind, "none");
});
