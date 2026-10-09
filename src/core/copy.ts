import { kitEnglish, kitPortuguese, type KitWords } from "./kitCopy";
// Shared system words. Product names, nouns and explanations remain caller data.
// Bundles are immutable values, so two callers never change each other's language.
export type Language = "en" | "pt";

const identity = Symbol("Copy");

interface Words {
  readonly kit: KitWords;
  readonly choice: { readonly placeholder: string; readonly cancel: string; readonly hint: string };
  readonly dateTime: {
    readonly set: string;
    readonly clear: string;
    readonly notSet: string;
    readonly openHint: string;
  };
  readonly value: { readonly yes: string; readonly no: string; readonly notSet: string };
  readonly state: {
    readonly loading: string;
    readonly empty: { readonly title: string; readonly body: string };
    readonly error: { readonly title: string; readonly body: string };
    readonly offline: { readonly title: string; readonly body: string };
    readonly success: { readonly title: string; readonly body: string };
    readonly retry: string;
    readonly dismiss: string;
    readonly reconcile: string;
    readonly unknownWrite: string;
    readonly updatedAt: (instant: string) => string;
  };
  readonly issue: { readonly invalid: string; readonly unsupported: string };
  /** What went wrong, in plain words. Nouns and the quoted instant arrive from the
   * catalogue and the reader's clock: no sentence here names a product or a resource. */
  readonly failure: {
    readonly connection: string;
    readonly loadFailed: (plural: string) => string;
    readonly refreshFailed: (instant: string) => string;
    readonly saveFailed: string;
    readonly deleteFailed: (singular: string) => string;
    readonly commandFailed: (title: string) => string;
    readonly uncertain: string;
    readonly signedOut: string;
    readonly excluded: (feature: string) => string;
    readonly noAccess: string;
    readonly gone: string;
    readonly revision: (singular: string) => string;
    readonly backTo: (plural: string) => string;
    readonly update: string;
    readonly loadCatalog: string;
  };
  /** A disclosure control names what it holds, not how it behaves: "Expand" describes
   * the control, "Show loading, empty and unavailable examples" describes the screen. */
  readonly disclosure: {
    readonly reveal: (what: string) => string;
    readonly conceal: (what: string) => string;
  };
  readonly gallery: {
    readonly appearance: string;
    readonly light: string;
    readonly dark: string;
    readonly language: string;
    readonly english: string;
    readonly portuguese: string;
    readonly states: string;
    readonly statesHint: string;
    /** What the page's state disclosure holds, so its control can name it. */
    readonly statesContent: string;
    /** The word the drawn floor plan puts on its threshold, so the entrance reads as one. */
    readonly entrance: string;
    readonly primitives: string;
    readonly locale: string;
    readonly case: string;
    readonly actionReceived: (id: string) => string;
    readonly add: string;
    readonly unavailable: string;
    readonly longTitle: string;
    readonly longBody: string;
    readonly filteredTitle: string;
    readonly filteredBody: string;
    readonly immutable: string;
  };
}

export interface Copy extends Words {
  readonly [identity]: true;
  readonly language: Language;
}

// One answer for "nothing is stored here", written once and named by each group
// that needs it: a date field with no instant and a switch with no answer are the
// same fact about the record, and a person should read the same two words.
const notSetEn = "Not set";
const notSetPt = "Não definido";

const en: Words = {
  kit: kitEnglish,
  choice: { placeholder: "Choose", cancel: "Cancel", hint: "Opens the choices" },
  dateTime: {
    set: "Set",
    clear: "Clear",
    notSet: notSetEn,
    openHint: "Opens the date and time dialogs",
  },
  value: { yes: "Yes", no: "No", notSet: notSetEn },
  state: {
    loading: "Loading",
    empty: { title: "Nothing here yet", body: "What arrives will be listed here." },
    error: { title: "This could not be loaded", body: "Try reading this information again." },
    offline: { title: "You are offline", body: "Reconnect before trying again." },
    success: { title: "Done", body: "Your change was saved." },
    retry: "Retry",
    dismiss: "Dismiss",
    reconcile: "Check the result",
    unknownWrite: "The change may have been saved. Check its result before submitting again.",
    updatedAt: (instant) => `Last updated ${instant}`,
  },
  issue: {
    invalid: "This information is not valid.",
    unsupported: "This format is not supported.",
  },
  failure: {
    connection: "We couldn't connect. Check your connection and try again.",
    loadFailed: (plural) => `We couldn't load ${plural}.`,
    refreshFailed: (instant) => `Couldn't refresh. Showing the last update from ${instant}.`,
    saveFailed: "We couldn't save your changes.",
    deleteFailed: (singular) => `We couldn't delete this ${singular}`,
    commandFailed: (title) => `${title} did not run.`,
    uncertain: "We couldn't confirm whether your changes were saved.",
    signedOut: "Sign in again to continue.",
    excluded: (feature) => `This account's plan does not include ${feature}.`,
    noAccess: "You no longer have access to this item.",
    gone: "This item is no longer available.",
    revision: (singular) => `This ${singular} changed while you were editing.`,
    backTo: (plural) => `Back to ${plural}`,
    update: "Update the app to open this workspace.",
    loadCatalog: "We couldn't open this workspace.",
  },
  disclosure: {
    reveal: (what) => `Show ${what}`,
    conceal: (what) => `Hide ${what}`,
  },
  gallery: {
    appearance: "Appearance",
    light: "Light",
    dark: "Dark",
    language: "Language",
    english: "English",
    portuguese: "Português",
    states: "Rich states",
    statesHint: "How this screen reads while it loads, comes up empty or refuses an action.",
    statesContent: "loading, empty and unavailable examples",
    entrance: "Entrance",
    primitives: "Atoms and molecules",
    locale: "Date and number locale",
    case: "Example",
    actionReceived: (id) => `Action received: ${id}`,
    add: "Add an item",
    unavailable: "Reconnect to add an item.",
    longTitle: "Everything you add will have a place here",
    longBody:
      "When the first item arrives, its details will appear here. You can return at any time to review your information.",
    filteredTitle: "No matching items",
    filteredBody: "Change the filters to see more results.",
    immutable: "This information is no longer available to this account.",
  },
};

const pt: Words = {
  kit: kitPortuguese,
  choice: { placeholder: "Escolher", cancel: "Cancelar", hint: "Abre as opções" },
  dateTime: {
    set: "Definir",
    clear: "Limpar",
    notSet: notSetPt,
    openHint: "Abre os seletores de data e hora",
  },
  value: { yes: "Sim", no: "Não", notSet: notSetPt },
  state: {
    loading: "A carregar",
    empty: { title: "Ainda não há nada aqui", body: "O que chegar será apresentado aqui." },
    error: {
      title: "Não foi possível carregar",
      body: "Tente consultar esta informação novamente.",
    },
    offline: { title: "Está sem ligação", body: "Volte a ligar-se antes de tentar novamente." },
    success: { title: "Concluído", body: "A alteração foi guardada." },
    retry: "Tentar novamente",
    dismiss: "Fechar",
    reconcile: "Verificar o resultado",
    unknownWrite:
      "A alteração pode ter sido guardada. Verifique o resultado antes de enviar novamente.",
    updatedAt: (instant) => `Última atualização: ${instant}`,
  },
  issue: { invalid: "Esta informação não é válida.", unsupported: "Este formato não é suportado." },
  failure: {
    connection: "Não foi possível ligar-nos. Verifique a sua ligação e tente novamente.",
    loadFailed: (plural) => `Não foi possível carregar ${plural}.`,
    refreshFailed: (instant) =>
      `Não foi possível atualizar. A mostrar a última atualização de ${instant}.`,
    saveFailed: "Não foi possível guardar as suas alterações.",
    deleteFailed: (singular) => `Não foi possível eliminar ${singular}.`,
    commandFailed: (title) => `${title} não foi executado.`,
    uncertain: "Não foi possível confirmar se as suas alterações foram guardadas.",
    signedOut: "Inicie novamente a sessão para continuar.",
    excluded: (feature) => `O plano desta conta não inclui ${feature}.`,
    noAccess: "Já não tem acesso a este item.",
    gone: "Este item já não está disponível.",
    revision: (singular) => `Este ${singular} mudou enquanto estava a editar.`,
    backTo: (plural) => `Voltar a ${plural}`,
    update: "Atualize a aplicação para abrir esta área de trabalho.",
    loadCatalog: "Não foi possível abrir esta área de trabalho.",
  },
  disclosure: {
    reveal: (what) => `Mostrar ${what}`,
    conceal: (what) => `Ocultar ${what}`,
  },
  gallery: {
    appearance: "Aspeto",
    light: "Claro",
    dark: "Escuro",
    language: "Idioma",
    english: "English",
    portuguese: "Português",
    states: "Estados de conteúdo",
    statesHint: "Como este ecrã se lê enquanto carrega, fica vazio ou recusa uma ação.",
    statesContent: "exemplos de carregamento, vazio e indisponibilidade",
    entrance: "Entrada",
    primitives: "Átomos e moléculas",
    locale: "Formato de datas e números",
    case: "Exemplo",
    actionReceived: (id) => `Ação recebida: ${id}`,
    add: "Adicionar um item",
    unavailable: "Volte a ligar-se para adicionar um item.",
    longTitle: "Tudo o que adicionar terá um lugar aqui",
    longBody:
      "Quando chegar o primeiro item, os seus detalhes serão apresentados aqui. Pode voltar a qualquer momento para consultar a sua informação.",
    filteredTitle: "Nenhum item corresponde",
    filteredBody: "Altere os filtros para ver mais resultados.",
    immutable: "Esta informação já não está disponível para esta conta.",
  },
};

function bundle(language: Language, words: Words): Copy {
  return Object.freeze({
    [identity]: true as const,
    language,
    kit: Object.freeze(words.kit),
    choice: Object.freeze(words.choice),
    dateTime: Object.freeze(words.dateTime),
    value: Object.freeze(words.value),
    state: Object.freeze({
      ...words.state,
      empty: Object.freeze(words.state.empty),
      error: Object.freeze(words.state.error),
      offline: Object.freeze(words.state.offline),
      success: Object.freeze(words.state.success),
    }),
    issue: Object.freeze(words.issue),
    failure: Object.freeze(words.failure),
    disclosure: Object.freeze(words.disclosure),
    gallery: Object.freeze(words.gallery),
  });
}

const copies = Object.freeze({ en: bundle("en", en), pt: bundle("pt", pt) });

/** The closed language argument prevents a component assembling a partial copy table. */
export function deriveCopy(language: Language): Copy {
  if (language !== "en" && language !== "pt") throw new RangeError("unsupported-format: copy");
  return copies[language];
}

/**
 * The phone's own language, from the locale the device reports: the primary
 * subtag decides, so "pt-BR", "pt_PT" and "PT" are Portuguese and anything else
 * reads in English. A locale tag is not a language, so it cannot be handed to
 * `deriveCopy` directly — this is the one place the two are reconciled.
 */
export function copyLanguage(locale: string | undefined): Language {
  return typeof locale === "string" && locale.toLowerCase().startsWith("pt") ? "pt" : "en";
}
