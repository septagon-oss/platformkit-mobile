import { kitEnglish, kitPortuguese, type KitWords } from "./kitCopy";
// Shared system words. Product names, nouns and explanations remain caller data.
// Bundles are immutable values, so two callers never change each other's language.
export type Language = "en" | "pt";

/**
 * withCount fills the count placeholder the table spells as `{n}`. A rule that
 * holds a count says how many and the table says in what order the number sits -
 * every count and distance word in the kit carries the placeholder, in both
 * languages - so no rule composes a sentence out of English fragments.
 */
export const withCount = (words: string, count: number): string =>
  words.replace("{n}", String(count));

const identity = Symbol("Copy");

interface Words {
  readonly review: {
    readonly title: string;
    readonly open: (count: string) => string;
    readonly later: string;
    readonly deferred: (count: string) => string;
    readonly unavailable: string;
    readonly encouraged: string;
    readonly caughtUp: string;
    readonly complete: string;
    readonly changed: string;
    readonly checkFailed: string;
  };
  readonly kit: KitWords;
  /**
   * decide is the vocabulary of a question people answer together: the ask, the ballot's faces,
   * the ranking and the invitation. No word here names a question, an option or a person — the
   * module prints those, and the phone formats them.
   */
  readonly decide: {
    readonly ask: string;
    readonly questionTitle: string;
    readonly option: string;
    readonly optionTitle: string;
    readonly optionAdd: string;
    readonly optionPhoto: string;
    readonly optionPhotoCamera: string;
    readonly optionPhotoLibrary: string;
    readonly photoRefused: string;
    readonly moveUp: string;
    readonly moveDown: string;
    readonly remove: string;
    readonly voted: (who: string) => string;
    readonly noVotersYet: string;
    readonly inbox: string;
    readonly results: string;
    readonly winner: string;
    readonly tied: string;
    readonly votes: (count: string) => string;
    readonly skipped: (count: string) => string;
    readonly matched: string;
    readonly seeResults: string;
    readonly vote: string;
    readonly close: string;
    readonly closeConsequence: string;
    readonly closed: string;
    readonly closedAt: (instant: string) => string;
    readonly invite: string;
    readonly inviteIssue: string;
    readonly inviteLink: string;
    readonly inviteQr: string;
    readonly inviteExpires: (instant: string) => string;
    readonly inviteRevoke: string;
    readonly inviteRevoked: string;
    readonly participants: string;
    readonly participantAdd: string;
  };
  /**
   * outfit is the vocabulary of a look the module composed: the door to the next window of
   * suggestions and the door back to it. No word here names a garment, a season or a colour — the
   * module prints those, and the phone repeats them.
   */
  readonly outfit: { readonly anotherIdea: string; readonly moreIdeas: string };
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
    /** held is a write on this phone that has not reached the server. */
    readonly held: { readonly title: string; readonly body: string };
    /** holding is what the screen that made a write says when the write stayed: it names the act and where to find the write, in the section's own words. */
    readonly holding: (where: string) => string;
    /** refused is a held write the server answered 4xx to; its own words come from the record. */
    readonly refused: { readonly title: string; readonly body: string };
    /** discard throws the person's own work away, which is not what `dismiss` says. */
    readonly discard: string;
    /** signOutHeld is the question every way out of a sign-in asks while this phone still holds writes; signing out discards them. */
    readonly signOutHeld: (owed: number) => string;
    /** keep is the answer that stops at the way out: the person stays signed in and the writes stay here. */
    readonly keep: string;
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
    /** The noun a refusal names when the call addressed no catalogue entry: a named
     * operation reads a record, the catalogue load opens a workspace. A person reads
     * these words, so the table holds them; a Portuguese phone reads Portuguese. */
    readonly thisRecord: string;
    readonly thisWorkspace: string;
    /** The four refusals of a verb the resource does not mount. The door for such a verb is never drawn, so these are for a sheet a link or a stale notification opened. */
    readonly cannotCreateHere: string;
    readonly cannotEditHere: string;
    readonly cannotDeleteHere: string;
    readonly notAvailableHere: string;
    /** entryMissing is a route whose entry this installation's catalogue does not carry. */
    readonly entryMissing: (path: string) => string;
    /** commandNotRun is what the question that throws away a command's arguments says about the command itself: it has not run, so nothing happened. */
    readonly commandNotRun: (title: string) => string;
    /** signInElsewhere is the way out when the saved server, not the person, is what is wrong. */
    readonly signInElsewhere: string;
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
  review: {
    title: "Review",
    open: (count) => `Review ${count}`,
    later: "Review later",
    deferred: (count) => `${count} left for later`,
    unavailable: "No review actions are available.",
    encouraged: "Nice — 5 reviewed.",
    caughtUp: "All caught up",
    complete: "Review complete",
    changed: "The queue changed. Reviewing the items loaded.",
    checkFailed: "Couldn't check the queue. Try again.",
  },
  kit: kitEnglish,
  decide: {
    ask: "Ask a question",
    questionTitle: "Question",
    option: "Option",
    optionTitle: "Option title",
    optionAdd: "Add an option",
    optionPhoto: "Add a photo",
    optionPhotoCamera: "Take a photo",
    optionPhotoLibrary: "Choose a photo",
    photoRefused: "This phone would not let a photo be taken. The option is kept without one.",
    moveUp: "Move up",
    moveDown: "Move down",
    remove: "Remove",
    voted: (who) => `${who} have voted`,
    noVotersYet: "Nobody has voted yet.",
    inbox: "Options to decide",
    results: "Results",
    winner: "Winning",
    tied: "Tied",
    votes: (count) => `${count} votes`,
    skipped: (count) => `${count} skipped`,
    matched: "It's a match!",
    seeResults: "See results",
    vote: "Vote on it",
    close: "Close voting",
    closeConsequence: "Nobody else can vote, and the result stands.",
    closed: "Voting has closed.",
    closedAt: (instant) => `Closed ${instant}`,
    invite: "Invite",
    inviteIssue: "Make an invite link",
    inviteLink: "Invite link",
    inviteQr: "Scan to join",
    inviteExpires: (instant) => `Anyone with this link can join until ${instant}.`,
    inviteRevoke: "Stop the link",
    inviteRevoked: "This link no longer opens the question.",
    participants: "Who can vote",
    participantAdd: "Invite a person",
  },
  outfit: { anotherIdea: "Another idea", moreIdeas: "More ideas" },
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
    held: {
      title: "Held on this phone",
      body: "It will send when this phone reaches the server.",
    },
    holding: (where) => `This phone is holding it. It is listed under ${where} until it sends.`,
    refused: { title: "Not sent", body: "The server refused it." },
    discard: "Discard",
    signOutHeld: (owed) =>
      owed === 1
        ? "1 write has not left this phone. Discard it before signing out?"
        : `${owed} writes have not left this phone. Discard them before signing out?`,
    keep: "Keep on this phone",
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
    deleteFailed: (singular) => `We couldn't delete this ${singular}.`,
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
    thisRecord: "this record",
    thisWorkspace: "this workspace",
    cannotCreateHere: "This record cannot be created here.",
    cannotEditHere: "This record cannot be edited here.",
    cannotDeleteHere: "This record cannot be deleted here.",
    notAvailableHere: "This is not available here.",
    entryMissing: (path) => `${path} is not in this installation.`,
    commandNotRun: (title) => `The ${title} has not run.`,
    signInElsewhere: "Sign in to another server",
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
  review: {
    title: "Rever",
    open: (count) => `Rever ${count}`,
    later: "Rever mais tarde",
    deferred: (count) => `${count} para mais tarde`,
    unavailable: "Não há ações de revisão disponíveis.",
    encouraged: "Boa — 5 itens revistos.",
    caughtUp: "Tudo em dia",
    complete: "Revisão concluída",
    changed: "A fila mudou. A rever os itens carregados.",
    checkFailed: "Não foi possível verificar a fila. Tente novamente.",
  },
  kit: kitPortuguese,
  decide: {
    ask: "Fazer uma pergunta",
    questionTitle: "Pergunta",
    option: "Opção",
    optionTitle: "Título da opção",
    optionAdd: "Adicionar uma opção",
    optionPhoto: "Adicionar uma fotografia",
    optionPhotoCamera: "Tirar uma fotografia",
    optionPhotoLibrary: "Escolher uma fotografia",
    photoRefused: "Este telefone não permitiu tirar uma fotografia. A opção fica sem ela.",
    moveUp: "Subir",
    moveDown: "Descer",
    remove: "Remover",
    voted: (who) => `${who} votaram`,
    noVotersYet: "Ainda ninguém votou.",
    inbox: "Opções para decidir",
    results: "Resultados",
    winner: "À frente",
    tied: "Empatadas",
    votes: (count) => `${count} votos`,
    skipped: (count) => `${count} ignoradas`,
    matched: "É uma escolha comum!",
    seeResults: "Ver resultados",
    vote: "Votar",
    close: "Encerrar a votação",
    closeConsequence: "Ninguém mais poderá votar e o resultado permanece.",
    closed: "A votação terminou.",
    closedAt: (instant) => `Encerrada ${instant}`,
    invite: "Convidar",
    inviteIssue: "Criar um link de convite",
    inviteLink: "Link de convite",
    inviteQr: "Ler para participar",
    inviteExpires: (instant) => `Quem tiver este link pode participar até ${instant}.`,
    inviteRevoke: "Cancelar o link",
    inviteRevoked: "Este link já não abre a pergunta.",
    participants: "Quem pode votar",
    participantAdd: "Convidar uma pessoa",
  },
  outfit: { anotherIdea: "Outra ideia", moreIdeas: "Mais ideias" },
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
    held: {
      title: "Guardado neste telefone",
      body: "Será enviado quando este telefone alcançar o servidor.",
    },
    holding: (where) => `Este telefone está a guardá-lo. Está listado em ${where} até ser enviado.`,
    refused: { title: "Não enviado", body: "O servidor recusou-o." },
    discard: "Descartar",
    signOutHeld: (owed) =>
      owed === 1
        ? "1 gravação ainda não saiu deste telefone. Descartá-la antes de terminar a sessão?"
        : `${owed} gravações ainda não saíram deste telefone. Descartá-las antes de terminar a sessão?`,
    keep: "Manter neste telefone",
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
    thisRecord: "este registo",
    thisWorkspace: "esta área de trabalho",
    cannotCreateHere: "Este registo não pode ser criado aqui.",
    cannotEditHere: "Este registo não pode ser editado aqui.",
    cannotDeleteHere: "Este registo não pode ser eliminado aqui.",
    notAvailableHere: "Isto não está disponível aqui.",
    entryMissing: (path) => `${path} não está nesta instalação.`,
    commandNotRun: (title) => `O ${title} ainda não foi executado.`,
    signInElsewhere: "Iniciar sessão noutro servidor",
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
    decide: Object.freeze(words.decide),
    outfit: Object.freeze(words.outfit),
    review: Object.freeze(words.review),
    choice: Object.freeze(words.choice),
    dateTime: Object.freeze(words.dateTime),
    value: Object.freeze(words.value),
    state: Object.freeze({
      ...words.state,
      empty: Object.freeze(words.state.empty),
      error: Object.freeze(words.state.error),
      offline: Object.freeze(words.state.offline),
      held: Object.freeze(words.state.held),
      refused: Object.freeze(words.state.refused),
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
 * The bundle a locale tag reads in: the words follow the tag, with English behind
 * every other language. This is the whole reconciliation between a locale tag and
 * the two languages the table holds — a tag is not a language, so it cannot be
 * handed to `deriveCopy` directly. Who supplies the tag is the caller's business:
 * a screen asks its phone, a test decides for itself. The core never asks.
 */
export function copyForLocale(locale: string | undefined): Copy {
  return deriveCopy(copyLanguage(locale));
}

/**
 * The language a locale tag reads in: the primary subtag decides, so "pt-BR",
 * "pt_PT" and "PT" are Portuguese and anything else reads in English. A locale tag
 * is not a language, so it cannot be handed to `deriveCopy` directly — this is the
 * one place the two are reconciled.
 */
export function copyLanguage(locale: string | undefined): Language {
  return typeof locale === "string" && locale.toLowerCase().startsWith("pt") ? "pt" : "en";
}
