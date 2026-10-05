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
  readonly value: { readonly yes: string; readonly no: string };
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

const en: Words = {
  kit: kitEnglish,
  choice: { placeholder: "Choose", cancel: "Cancel", hint: "Opens the choices" },
  dateTime: {
    set: "Set",
    clear: "Clear",
    notSet: "Not set",
    openHint: "Opens the date and time dialogs",
  },
  value: { yes: "Yes", no: "No" },
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
    notSet: "Não definido",
    openHint: "Abre os seletores de data e hora",
  },
  value: { yes: "Sim", no: "Não" },
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
