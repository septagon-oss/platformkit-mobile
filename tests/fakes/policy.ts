// A catalogue document for one invoice resource whose server resolved a policy in
// Portuguese, written independently of the kernel's fixtures. `invoiceDocument`
// returns a fresh document each call so a case may break one member of its block.
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const reading = (over: Json = {}): Json => ({
  format: "",
  missing: "n/d",
  true: "",
  false: "",
  precision: null,
  time: null,
  money: null,
  ...over,
});

const resolvedField = (name: string, label: string, over: Json = {}): Json => ({
  name,
  label,
  help: "",
  section: "",
  onList: true,
  onRecord: true,
  editable: { create: true, update: true },
  control: "text",
  kind: "text",
  reading: reading(),
  options: [],
  reference: null,
  ...over,
});

export const invoiceFields = (): Json[] => [
  { name: "id", type: "uuid", readOnly: true },
  { name: "reference", type: "string" },
  { name: "total", type: "int" },
  { name: "status", type: "string", enum: ["open", "paid", "void"] },
  { name: "memo", type: "text" },
];

export const invoiceBlock = (): Json => ({
  policyVersion: 1,
  language: "pt-PT",
  identity: {
    singular: "Fatura",
    plural: "Faturas",
    description: "",
    emptyDescription: "",
    icon: "",
    group: null,
    order: 0,
  },
  titles: {
    listCandidates: ["reference"],
    recordCandidates: ["reference", "memo"],
    emptyTitle: "Sem título",
    preview: "memo",
    status: "status",
    cover: "",
    thumbnail: "",
    summary: [],
  },
  layout: {
    columns: ["total", "reference", "status"],
    create: ["status", "reference", "total"],
    update: ["reference"],
    overview: [],
    information: [],
    sections: [],
  },
  fields: [
    resolvedField("id", "Identificador"),
    resolvedField("reference", "Referência"),
    resolvedField("total", "Valor", { reading: reading({ precision: 0 }) }),
    resolvedField("status", "Estado", {
      options: [
        { value: "open", label: "Em aberto", tone: "warning", done: false },
        { value: "paid", label: "Liquidada", tone: "success", done: true },
      ],
    }),
    resolvedField("memo", "Nota", { reading: reading({ missing: "sem nota" }) }),
  ],
  list: {
    defaultSort: "-total",
    filters: [],
    sorts: [
      { query: "total", label: "Valor", field: "total", desc: false },
      { query: "-total", label: "Valor", field: "total", desc: true },
      { query: "reference", label: "Referência", field: "reference", desc: false },
    ],
  },
});

export const invoiceDocument = (block: unknown = invoiceBlock()): Json => ({
  catalogVersion: 3,
  resources: [
    {
      module: "billing",
      entity: "invoice",
      path: "/api/v1/billing/invoices",
      writable: true,
      fields: invoiceFields(),
      ...(block === null ? {} : { resolved: block }),
    },
  ],
});
