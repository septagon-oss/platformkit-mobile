// A parity fixture as a catalogue entry whose server resolved a policy. A fixture states only the part of
// the kernel's block its case is about, so the rest is completed with inert values (a field's own name
// as its label, the conventional title fields, an empty sort list); the cases assert only what a fixture states.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** overlay lays what a fixture states over the inert block, elements of a list by position. */
function overlay(base: unknown, over: unknown, fill: (item: Json) => Json): unknown {
  if (Array.isArray(over)) {
    const items = over.map((o, i) => overlay(Array.isArray(base) ? base[i] : undefined, o, fill));
    return items.map((item) => (isObject(item) ? fill(item) : item));
  }
  if (isObject(over)) {
    const out: Json = isObject(base) ? { ...base } : {};
    for (const [k, v] of Object.entries(over)) out[k] = overlay(out[k], v, fill);
    return out;
  }
  return over;
}

const inertField = (name: string): Json => ({
  name,
  label: name,
  help: "",
  section: "",
  onList: true,
  onRecord: true,
  editable: { create: true, update: true },
  control: "text",
  kind: "text",
  reading: {
    format: "",
    missing: "—",
    true: "",
    false: "",
    precision: null,
    time: null,
    money: null,
  },
  options: [],
  reference: null,
});

/** completed fills the members a stated item leaves out, whatever list it sits in. */
function completed(item: Json): Json {
  if ("query" in item)
    return {
      label: String(item.query).replace(/^-/, ""),
      field: String(item.query).replace(/^-/, ""),
      desc: String(item.query).startsWith("-"),
      ...item,
    };
  if ("field" in item) return { label: item.field, kind: "", values: null, ...item };
  if ("value" in item || ("label" in item && !("name" in item)))
    return { value: item.label, label: item.value, tone: "neutral", done: false, ...item };
  return item;
}

export function parityEntry(fixture: { input: Json; expected: Json }): Json {
  const { schema, language, immutable } = fixture.input;
  const names: string[] = schema.fields.map((f: Json) => f.name);
  const writable = schema.fields.filter((f: Json) => !f.readOnly).map((f: Json) => f.name);
  // The kernel names a record by a field called title, name or displayName before any other.
  const named = ["title", "name", "displayName"].filter((n) => names.includes(n));
  const inert: Json = {
    policyVersion: 1,
    language,
    identity: {
      singular: schema.entity,
      plural: `${schema.entity}s`,
      description: "",
      emptyDescription: "",
      icon: "",
      group: null,
      order: 0,
    },
    titles: {
      listCandidates: named,
      recordCandidates: named,
      emptyTitle: "—",
      preview: "",
      status: "",
      cover: "",
      thumbnail: "",
      summary: [],
    },
    layout: {
      columns: names,
      create: writable,
      update: writable,
      overview: [],
      information: [],
      sections: [],
    },
    fields: names.map(inertField),
    list: { defaultSort: "", filters: [], sorts: [] },
  };
  const stated = { ...fixture.expected.resolved };
  delete stated.commands;
  delete stated.deck;
  delete stated.summary;
  const block = overlay(inert, stated, completed) as Json;
  return {
    module: schema.module,
    entity: schema.entity,
    path: schema.path,
    writable: true,
    immutable: immutable ?? [],
    fields: schema.fields.map(({ presentation: _p, ...f }: Json) => f),
    resolved: block,
  };
}
