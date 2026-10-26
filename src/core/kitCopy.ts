// System words shared by the composed kit. Product nouns remain supplied content.

/**
 * englishArticle is the indefinite article a field's own word takes: none before an
 * `s` (a joined list or a plural reads "Enter tags."), `an` before a vowel letter,
 * `a` otherwise. This is English *spelling*, not English morphology — "Status" loses
 * its article and "Data" keeps one — and the limit is written down rather than
 * guessed at by a translator. Portuguese puts its label after a colon, where no
 * article, no agreement and no case rule exists, which is the construction `untitled`
 * already uses.
 */
const englishArticle = (field: string): string => {
  const word = field.trim();
  if (word === "" || /s$/i.test(word)) return "";
  return /^[aeiou]/i.test(word) ? "an " : "a ";
};

/** lowerFirst keeps a word's own letters but not its own capital: an English sentence names the field mid-sentence. */
const lowerFirst = (field: string): string => field.charAt(0).toLowerCase() + field.slice(1);

/**
 * upperFirst keeps a word's own letters and gives it the capital a sentence begins with. The two
 * sentences that use it are made of words somebody else wrote — a noun the catalogue declares, a
 * state word the author chose — so this kit may re-case them and may not translate them.
 */
const upperFirst = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

export const kitEnglish = {
  account: "Account",
  signOut: "Sign out",
  you: "You",
  peopleRemainder: (count: string) => `+${count}`,
  peopleDescription: (name: string, count: string, total: number) =>
    `${name} and ${count} ${total === 1 ? "other" : "others"}`,
  by: "by",
  activityEmpty: "Nothing has happened to this record yet.",
  actions: "Actions",
  clear: "Clear",
  close: "Close",
  open: "Open",
  select: "Select",
  selected: "Selected",
  unavailable: "No longer available. Choose again or refresh.",
  // A catalogue entry may name a screen this build does not hold. The generic
  // screens still draw the record, so this is the app saying it is behind, not a
  // refusal — quiet, one line, and the only thing said about it.
  shellUpdate: "Update the app for this record's full screen.",
  // What the first screen says about the session: the workspace's own name when it answered
  // one and the address the person signed in at until it does, the account under it is the
  // person's own words, and a row that opens nothing is said to be read alone.
  workspace: "Workspace",
  // What the first screen says to the person standing in front of it: three parts of
  // day, and the line that puts a first name after one. Three and not four — "Good
  // night" is a farewell, and a screen that wished a person well at 23:00 would be
  // asking them to leave. An empty name says the greeting alone: the app never
  // invents a name it was not given.
  goodMorning: "Good morning",
  goodAfternoon: "Good afternoon",
  goodEvening: "Good evening",
  greeting: (part: string, name: string) => (name === "" ? part : `${part}, ${name}`),
  // A card's sub-count: the catalogue's own word for what it counts, then the number
  // the server answered for it.
  cardSecondary: (label: string, count: string) => `${label} · ${count}`,
  // The one sentence a card says aloud, which is what lets its sparkline stay
  // decoration rather than a fourteen-point sentence.
  cardAloud: (label: string, value: string, secondary?: string) =>
    secondary === undefined ? `${label}: ${value}.` : `${label}: ${value}. ${secondary}.`,
  // The two blocks under the greeting: what this device opened, and everything the
  // person may reach here.
  recentlyOpened: "Recently opened",
  allResources: "All resources",
  readOnly: "Read only",
  // A record whose schema names nothing to read as its title. The noun arrives
  // from the catalogue, the way `failure.loadFailed` takes one: this is the only
  // sentence the kit writes for a record it cannot name, and it is written once.
  untitled: (singular: string) => `Untitled ${singular}`,
  // A record's own words: the block that holds what the entry filed nowhere, the
  // collapsed section that holds what a record keeps about itself rather than about
  // its subject, and the three parts of the disclosure that opens it. `reveals` is a
  // noun phrase because `disclosure.reveal` builds the sentence around it.
  overview: "Overview",
  recordInformation: "Record information",
  recordInformationHolds: "The record’s identifier and the moments it changed.",
  recordInformationContent: "the identifier and the timestamps",
  // What a trail calls a person whose name the directory does not hold. Never the id:
  // a user id on a screen is a fact about the store, quoted to a person who cannot
  // look anything up with it.
  nameUnavailable: "Name unavailable",
  // What a copy this person keeps says when the record it was taken from has gone. The two
  // sentences are the provider's difference, not the kit's: a look that no longer exists
  // and a shop that is down are one greyed row and two answers, and collapsing them would
  // tell a person to stop wanting something they can still have tomorrow. The heart's own
  // words are never here — the catalogue declares them.
  savedUnavailable: "No longer available.",
  savedTemporary: "Temporarily unavailable.",
  // A delete, asked in the words 0085 sets down: the record by its own name, the
  // warning plain, and an answer that names what it does. "Permanently" is not
  // claimed: a soft-deleting resource is recoverable by an administrator.
  deleteQuestion: (title: string) => `Delete ‘${title}’?`,
  deleteWarning: "You can’t undo this in the app.",
  deleteAction: (singular: string) => `Delete ${singular}`,
  moreOptions: "More options",
  justNow: "Just now",
  // The distances a time is read as, spelled by the kit where the engine has no Intl.RelativeTimeFormat (Hermes on
  // Android). They say what Intl says in each language, so a phone and a test read the same words.
  minuteAgo: "1 minute ago",
  minutesAgo: "{n} minutes ago",
  hourAgo: "1 hour ago",
  hoursAgo: "{n} hours ago",
  yesterday: "yesterday",
  twoDaysAgo: "2 days ago",
  daysAgo: "{n} days ago",
  tomorrow: "tomorrow",
  // The credentials step asks for two things and no longer for a third: the address is its own
  // step now, so this sentence names the email and the password the workspace is signed in with.
  signInIntro: "Enter the email and password you use at this workspace.",
  workspaceAddress: "Workspace address",
  // The step before a password: the phone reads what the workspace says of itself and puts
  // that on screen, so a person aims at a place they recognise rather than an address. The
  // two headings are that step's own — the title names the act and the intro what to type —
  // and `changeWorkspace` is the one way back from the credentials to the address.
  connectTitle: "Connect to your workspace",
  connectIntro: "Enter the address of your workspace.",
  continueLabel: "Continue",
  changeWorkspace: "Change",
  rememberedWorkspaces: "Other workspaces",
  // What a mark is said to be where the mark is the only thing saying which workspace
  // this is: the picture's name is the place's own, never "logo" and never a file name.
  workspaceMark: (name: string) => `${name} mark`,
  allLoaded: "Select loaded items",
  of: "of",
  selection: "Selection",
  filters: "Filters",
  moreFilters: "More filters",
  sort: "Sort",
  // The bar under the header that holds both doors. It is named for itself: the
  // accessible name of a group of controls that repeated one of its own buttons
  // would tell a reader the bar *is* that button.
  listControls: "List controls",
  // A filter group always answers, so the choice that narrows nothing is "All", the
  // reading of the group, and never "Clear", which is what a reset at the group's edge
  // is called (`clear` above stays that word's owner).
  all: "All",
  clearFilters: "Clear filters",
  filtersActive: (count: string) => `Filters · ${count}`,
  // The two doors a list's toolbar holds. `new` is the header's word for a record of
  // no known kind; `newNamed` names the kind the catalogue gave it.
  new: "New",
  newNamed: (singular: string) => `New ${singular}`,
  // The other sheet's title. `new` names a record of no known kind, this names the
  // record a person opened their own sheet to change, in the words the catalogue
  // gave its resource: a header that said `Edit note` while the toolbar under it
  // said `New Note` was spelling one kind of thing two ways.
  editNamed: (singular: string) => `Edit ${singular}`,
  // The three answers an empty list gives, which are three different facts: nothing
  // has arrived yet, nothing arrived that matches, and nothing can arrive yet.
  emptyNone: (plural: string) => `No ${plural} yet`,
  emptyCreate: (singular: string) => `Create a ${singular} to get started.`,
  // The sentence opens with the noun, so it is capitalised here: this kit wrote the
  // fallback plural lower-case and a sentence may not begin with it. A declared name
  // arrives as its author wrote it, and capitalising what is already capitalised does
  // nothing.
  emptyArrive: (plural: string) =>
    `${plural.charAt(0).toUpperCase()}${plural.slice(1)} will appear here when they're available.`,
  noMatching: (plural: string) => `No matching ${plural}`,
  filteredBody: "Try another search or clear your filters.",
  // The direction words a sort sheet says. Which words a field takes is its type's,
  // so a phone never reads "ascending" for a deadline and never reads English at all.
  sortNewest: "Newest first",
  sortOldest: "Oldest first",
  sortAZ: (word: string) => `${word}, A–Z`,
  sortZA: (word: string) => `${word}, Z–A`,
  sortSoon: (word: string) => `${word}, soonest first`,
  sortLate: (word: string) => `${word}, latest first`,
  sortLow: (word: string) => `${word}, low to high`,
  sortHigh: (word: string) => `${word}, high to low`,
  views: "Saved views",
  unsaved: "Unsaved changes",
  expand: "Expand",
  collapse: "Collapse",
  more: "Load more",
  summary: "Summary",
  details: "Full details",
  // The two verbs that end a step someone is inside. A stepper's "Next" moves along
  // stages the person can already see; a card's or a cart's step leads to a screen
  // they cannot, so the word names the place.
  reviewSelection: "Review selection",
  reviewOrder: "Review order",
  activity: "Activity",
  system: "the system",
  unknownActor: "Unknown actor",
  before: "Before",
  after: "After",
  missing: "Not supplied",
  redacted: "Redacted",
  older: "Show older",
  back: "Back",
  next: "Next",
  skip: "Skip",
  finish: "Finish",
  complete: "Complete",
  skipped: "Skipped",
  required: "Required",
  optional: "Optional",
  // The tag box: one word for the act, one sentence to name whose list it is, one
  // to name which chip goes. A list stores its items comma-joined, so the box that
  // writes one item says so when a person types the separator. The field's own word
  // keeps the case its author gave it — one sentence, spelled one way, whether it is
  // the placeholder in the box or the name the box announces.
  addTag: "Add",
  addTagTo: (label: string) => `Add to ${label}`,
  removeTag: (tag: string) => `Remove ${tag}`,
  commaInValue: "Remove the comma from this value.",
  // The two sentences a sheet owes a person whatever the field's author wrote, and
  // the only two the kit writes into a form: a value that is greyed out has to say
  // what changes it, and a box that takes an identifier has to say that nothing
  // picks the record out yet. They live here rather than in the derivation of a
  // control so a Portuguese phone reads Portuguese (`control` hands back the
  // author's line and nothing else), and they are drawn by `ResourceForm`.
  changedByCommand: "Changed by a command of its own, not by this form.",
  identifierOnly: "The identifier of the related record. There is no picker for it yet.",
  // What a value that points at another record says when this phone cannot read
  // the record it points at. Never the stored identifier: "3f2a…" is a fact about
  // the store, and a person cannot look anything up with it. Which of the two
  // words a pointer says is decided by what it points at — a record of the
  // directory of people is *assigned*, anything else is *linked* — and never by
  // whether a read happened to answer, so the word says nothing about a request
  // this person may not have been allowed to make.
  referenceAssigned: "Assigned",
  referenceLinked: "Linked",
  // What a command says it did when the document declared no sentence: the verb
  // or label the person just tapped, in the frame this bundle holds. The label
  // arrives from the served document, so on a Portuguese phone the kernel's
  // Portuguese label enters a Portuguese frame.
  commandDone: (label: string) => `${label} done`,
  saveExit: "Save and exit",
  steps: "Steps",
  validation: "Review the highlighted fields.",
  // What a sheet says when it refuses on submit, in sentences a person can mend by
  // typing. A field is named either here or by the announcement that wraps it
  // (`FormField` reads `label: error` on iOS), which is why the number and the
  // instant name the box rather than repeat its label. The English article rule is
  // spelled once, below.
  fieldRequired: (field: string) => `Enter ${englishArticle(field)}${lowerFirst(field)}.`,
  fieldChoiceRequired: (field: string) => `Choose ${englishArticle(field)}${lowerFirst(field)}.`,
  fieldNumber: "Enter a valid number.",
  fieldTime: "Enter a valid date and time.",
  // What a sheet asks before it throws away what a person wrote, and what a write
  // that landed says. Both outlive their own screen — the question is asked of a
  // dismissal and the sentence is read by the record the write moved to — so both
  // are the kit's words, not a screen's.
  discardChanges: "Discard changes?",
  discardUnsaved: "Your changes haven’t been saved.",
  keepEditing: "Keep editing",
  discard: "Discard",
  created: (singular: string) => `${singular} created`,
  changesSaved: "Changes saved",
  // What a record says the moment its own state crosses into one the entry calls finished, made of
  // the two words that are not this kit's: the entry's singular noun and the author's word for the
  // state it reached. It says nothing about which value that was, because the pill already does.
  finished: (singular: string, state: string) => `${upperFirst(singular)} ${lowerFirst(state)}`,
  available: "Available",
  soldOut: "Sold out",
  full: "Not enough places",
  booked: "Booked",
  closed: "Closed",
  past: "Already started",
  expired: "This availability has expired. Refresh it.",
  unknownCapacity: "Capacity unknown",
  capacity: "Places remaining",
  refresh: "Refresh",
  today: "Today",
  previous: "Previous",
  day: "Day",
  week: "Week",
  agenda: "Agenda",
  allDay: "All day",
  continues: "Continues",
  moreEvents: "More events",
  // Seven days do not fit a phone's column, so the week is drawn sideways. The row
  // says so, because a column that ends mid-Tuesday reads as a broken table rather
  // than as the first part of a week.
  weekSideways: "Swipe sideways for the rest of the week",
  noEvents: "No events",
  estimate: "Estimate",
  price: "Price",
  quantity: "Quantity",
  increase: "Increase",
  decrease: "Decrease",
  remove: "Remove",
  subtotal: "Subtotal",
  adjustments: "Adjustments",
  total: "Total",
  quoteExpired: "Request a fresh quote.",
  receipt: "Receipt",
  quote: "Quote",
  current: "Current plan",
  recommended: "Recommended",
  period: "Billing period",
  included: "Included",
  notIncluded: "Not included",
  unknown: "Unknown",
  map: "Map",
  list: "List",
  legend: "Legend",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  panLeft: "Pan left",
  panRight: "Pan right",
  panUp: "Pan up",
  panDown: "Pan down",
  reset: "Reset",
  unsupportedLocation: "This location is outside the map projection.",
  points: "Locations",
  images: "Images",
  imageUnavailable: "Image unavailable",
  retryImage: "Reload image",
  /** photoCount names how many pictures a record holds: the line above a strip of them, in the reader's own digits. */
  photoCount: (count: string, total: number) => `${count} ${total === 1 ? "photo" : "photos"}`,
  // Which language a record's words actually arrived in: `_i18n` names the language of a
  // translatable field the reader's own had no words for, and the sentence says so rather
  // than letting source-language prose pass for translated. The two languages this kit
  // holds words in are the two it can name.
  shownInLanguage: (language: string) => `Shown in ${language} — not translated yet`,
  languageEnglish: "English",
  languagePortuguese: "Portuguese",
  // What an editing keyboard offers above a rich text body: the marks this phone's reader
  // draws back, and the picture it may point at. Each label is the control's own name.
  formatting: "Formatting",
  bold: "Bold",
  italic: "Italic",
  heading: "Heading",
  bulletList: "List",
  image: "Image",
  noFilesToInsert: "This workspace holds no file to put in the body yet.",
  // Where a picture in a body comes from: the phone's own camera and photo library, or a
  // file this workspace already holds. A picture taken here is stored as a file first, so
  // the body points at a file the server has rather than at a path on this phone.
  imageSource: "Add a picture to the body",
  takePhoto: "Take photo",
  photoLibrary: "Photo library",
  photoNotStored: "This phone could not store the picture, so nothing was put in the body.",
  // A body written in the reader's own language is a translation of the record, and the
  // two are written at different addresses: a save that changed both at once would be half
  // a translation and half an edit, which is why the sheet asks for one at a time.
  mixedLanguageWrite:
    "You changed a translated field and one the record holds in its own language. Save one, then the other.",
  table: "Data table",
  // What a plot says before its numbers: the one observation a person came to
  // read. The axis supplies the rest of the sentence.
  peak: "Peak",
  range: "Range",
  noSamples: "No samples",
  noBaseline: "No baseline",
  unchanged: "Unchanged",
  favorable: "Favourable",
  unfavorable: "Unfavourable",
  step: "Step",
  unmeasured: "No total to measure against",
  left: "left",
  play: "Play",
  pause: "Pause",
  rewind: "Rewind",
  skipAhead: "Skip ahead",
  search: "Search",
  results: "results",
  clearSearch: "Clear search",
  cancelSearch: "Cancel search",
  searching: "Searching",
  navigate: "Navigate",
  cancel: "Cancel",
  dismiss: "Dismiss",
  // The words a specimen is made of. A gallery that said only "Example", "First"
  // and "Second" showed controls and no task, so the kit's specimens speak of one
  // visit to one place: a pass bought, the rooms it opens, when it is used. These
  // are the gallery's own fixture, named in both languages and read through here
  // like every other word: no screen, case or rule branches on them, and no
  // consumer of the kit is named by them.
  specimenPass: "Riverside Gallery annual pass",
  /** specimenGroup names a collection by what it holds. A group that takes the name
   * of one of its own members says the same words twice on the same screen. */
  specimenGroup: "Pass options",
  benefitTours: "Guided tour of the print room",
  variantIndividual: "Individual",
  variantTwoAdults: "Two adults",
  stepDetails: "Your details",
  stepVisit: "Visit time",
  photoPrintRoom: "The print room in morning light",
  photoCourtyard: "The courtyard from the upper landing",
  placePrintRoom: "Print room",
  placeCourtyard: "Courtyard",
  seriesVisitors: "Visitors per hour",
  seriesPassesSold: "Passes sold",
  axisHour: "Hour of day",
  axisVisitors: "Visitors",
  unitVisitors: "visitors",
  unitPasses: "passes",
  axisVariant: "Pass",
  seriesChange: "Change in passes on last week",
  seriesCourtyard: "Visitors in the courtyard",
  meterStorage: "Storage used",
  detailBody: "Admits two adults to the print room and the courtyard. Show it at either entrance.",
  detailAdmission: "Admits",
  detailVisitors: "For",
  queryPrint: "print room",
  nowPlaying: "Now playing",
  periodMonthly: "Monthly",
  periodAnnual: "Annual",
  // An amount owed on a schedule says what it is charged in, or it is not a
  // commitment anyone can check: 12.99 monthly and 12.99 yearly are the same
  // four figures and two different promises.
  unitMonthly: "per month",
  unitYearly: "per year",
  sourceFloorPlan: "Gallery floor plan",
  audioTour: "Audio tour",
  // The second factor. The step belongs to the person who enrolled one: the
  // words say what is owed and what went wrong, and never the arithmetic of
  // why the password was not enough. The server's own sentence about a refused
  // code stays the server's and is quoted as it answers.
  confirmItIsYou: "Confirm it is you",
  codePrompt: "Enter the six-digit code from your authenticator, or one of your recovery codes.",
  code: "Code",
  checkCode: "Check code",
  codeWrong: "That code is not right.",
  checking: "Checking…",
  backToPassword: "Back to the password",
  sessionExpired: "Your sign-in has expired. Sign in again.",
  noScopes: "This account grants nothing this app can open.",
  // A code answers a refusal this phone was given. With no refusal open there is
  // no window anywhere for it to spend, so the phone says so rather than send a
  // code to whichever server the field names now.
  noChallenge: "No code step is open on this phone. Sign in with the password again.",
  // A sign-out always forgets the key here. This is the other half saying it did
  // not happen there: the key still answers for its holder, and the only way out
  // left to a phone that cannot spend it is to stop it where the account lists
  // what holds its keys. It says "device" and not "phone" because the key this
  // sentence is about was read back out of storage, by whichever device did.
  keyNotStopped:
    "This device's key could not be revoked from here; remove it from your account's devices.",
  // Notifications. The phone asks once per session, in its own words, and only ever offers
  // the two answers: the system prompt behind "Turn on" belongs to the platform and is spent
  // whether or not anybody here wanted it spent. The two refusal sentences say what this app
  // could not do and nothing else — a phone nobody can send to keeps every other door.
  pushChannel: "PlatformKit notifications",
  pushInvite: "Get a notification when something changes on a record you follow?",
  pushTurnOn: "Turn on",
  pushNotNow: "Not now",
  pushRefused: "This server could not reach a push service for this device. Nothing else changed.",
  // The row this phone is addressable at belongs to the sign-in that registered it, so it is
  // asked back before the key that reaches it is spent. This is the sentence for the ask that
  // did not answer: the phone forgot the key either way, and the row stays until it is taken.
  pushNotRemoved:
    "This device could not be removed from your notifications. Try signing out again.",
} as const;
// Each word keeps its own shape, widened from the literal it is written as: most
// are strings, and the few that take a noun as data (`untitled`) are functions
// here exactly as they are in the table. A flat `string` for every key would
// force the noun-taking ones back into English.
type KitWord<T> = T extends string ? string : T;
export type KitWords = { readonly [K in keyof typeof kitEnglish]: KitWord<(typeof kitEnglish)[K]> };
export const kitPortuguese: KitWords = {
  account: "Conta",
  signOut: "Terminar sessão",
  you: "Você",
  peopleRemainder: (count: string) => `+${count}`,
  peopleDescription: (name: string, count: string, total: number) =>
    `${name} e mais ${count} ${total === 1 ? "pessoa" : "pessoas"}`,
  by: "por",
  activityEmpty: "Ainda nada aconteceu a este registo.",
  actions: "Ações",
  clear: "Limpar",
  close: "Fechar",
  open: "Abrir",
  select: "Selecionar",
  selected: "Selecionado",
  unavailable: "Já não está disponível. Escolha novamente ou atualize.",
  shellUpdate: "Atualize a aplicação para o ecrã completo deste registo.",
  workspace: "Espaço de trabalho",
  goodMorning: "Bom dia",
  goodAfternoon: "Boa tarde",
  goodEvening: "Boa noite",
  greeting: (part: string, name: string) => (name === "" ? part : `${part}, ${name}`),
  cardSecondary: (label: string, count: string) => `${label} · ${count}`,
  cardAloud: (label: string, value: string, secondary?: string) =>
    secondary === undefined ? `${label}: ${value}.` : `${label}: ${value}. ${secondary}.`,
  recentlyOpened: "Abertos recentemente",
  allResources: "Todos os recursos",
  readOnly: "Apenas leitura",
  untitled: (singular: string) => `${singular} sem título`,
  overview: "Visão geral",
  recordInformation: "Informações do registo",
  recordInformationHolds: "O identificador do registo e os momentos em que mudou.",
  recordInformationContent: "o identificador e as datas",
  nameUnavailable: "Nome indisponível",
  savedUnavailable: "Já não está disponível.",
  savedTemporary: "Temporariamente indisponível.",
  deleteQuestion: (title: string) => `Eliminar ‘${title}’?`,
  deleteWarning: "Não é possível anular esta ação na aplicação.",
  deleteAction: (singular: string) => `Eliminar ${singular}`,
  moreOptions: "Mais opções",
  justNow: "Agora mesmo",
  minuteAgo: "há 1 minuto",
  minutesAgo: "há {n} minutos",
  hourAgo: "há 1 hora",
  hoursAgo: "há {n} horas",
  yesterday: "ontem",
  twoDaysAgo: "anteontem",
  daysAgo: "há {n} dias",
  tomorrow: "amanhã",
  signInIntro: "Introduza o email e a palavra-passe que usa neste espaço de trabalho.",
  workspaceAddress: "Endereço do espaço de trabalho",
  connectTitle: "Ligue-se ao seu espaço de trabalho",
  connectIntro: "Introduza o endereço do seu espaço de trabalho.",
  continueLabel: "Continuar",
  changeWorkspace: "Alterar",
  rememberedWorkspaces: "Outros espaços de trabalho",
  workspaceMark: (name: string) => `Marca de ${name}`,
  allLoaded: "Selecionar itens carregados",
  of: "de",
  selection: "Seleção",
  filters: "Filtros",
  moreFilters: "Mais filtros",
  sort: "Ordenação",
  listControls: "Controles da lista",
  all: "Todos",
  clearFilters: "Limpar filtros",
  filtersActive: (count: string) => `Filtros · ${count}`,
  new: "Novo",
  newNamed: (singular: string) => `Novo ${singular}`,
  editNamed: (singular: string) => `Editar ${singular}`,
  emptyNone: (plural: string) => `Ainda não há ${plural}`,
  emptyCreate: (singular: string) => `Crie um ${singular} para começar.`,
  emptyArrive: (plural: string) => `Os ${plural} aparecem aqui quando estão disponíveis.`,
  noMatching: (plural: string) => `Nenhum ${plural} corresponde`,
  filteredBody: "Experimente outra pesquisa ou limpe os filtros.",
  sortNewest: "Mais recentes primeiro",
  sortOldest: "Mais antigos primeiro",
  sortAZ: (word: string) => `${word}, A–Z`,
  sortZA: (word: string) => `${word}, Z–A`,
  sortSoon: (word: string) => `${word}, mais próximo primeiro`,
  sortLate: (word: string) => `${word}, mais distante primeiro`,
  sortLow: (word: string) => `${word}, crescente`,
  sortHigh: (word: string) => `${word}, decrescente`,
  views: "Vistas guardadas",
  unsaved: "Alterações por guardar",
  expand: "Expandir",
  collapse: "Recolher",
  more: "Carregar mais",
  summary: "Resumo",
  details: "Detalhes completos",
  reviewSelection: "Revisar a seleção",
  reviewOrder: "Revisar o pedido",
  activity: "Atividade",
  system: "O sistema",
  unknownActor: "Autor desconhecido",
  before: "Antes",
  after: "Depois",
  missing: "Não fornecido",
  redacted: "Ocultado",
  older: "Mostrar anteriores",
  back: "Voltar",
  next: "Seguinte",
  skip: "Saltar",
  finish: "Concluir",
  complete: "Concluído",
  skipped: "Saltado",
  required: "Obrigatório",
  optional: "Opcional",
  addTag: "Adicionar",
  addTagTo: (label: string) => `Adicionar a ${label}`,
  removeTag: (tag: string) => `Remover ${tag}`,
  commaInValue: "Remova a vírgula deste valor.",
  changedByCommand: "Alterado por um comando próprio, não por este formulário.",
  identifierOnly: "O identificador do registo relacionado. Ainda não há seletor para ele.",
  referenceAssigned: "Atribuído",
  referenceLinked: "Vinculado",
  commandDone: (label: string) => `${label} concluído`,
  saveExit: "Guardar e sair",
  steps: "Etapas",
  validation: "Reveja os campos assinalados.",
  fieldRequired: (field: string) => `Campo obrigatório: ${field}.`,
  fieldChoiceRequired: (field: string) => `Campo obrigatório: ${field}.`,
  fieldNumber: "Introduza um número válido.",
  fieldTime: "Introduza uma data e hora válidas.",
  discardChanges: "Descartar alterações?",
  discardUnsaved: "As suas alterações não foram guardadas.",
  keepEditing: "Continuar a editar",
  discard: "Descartar",
  created: (singular: string) => `Registo criado: ${singular}`,
  changesSaved: "Alterações guardadas",
  // The colon frame is the one this bundle already uses above: naming the record, then naming the
  // state it reached. A noun-then-participle frame would put grammatical agreement between two
  // served words into this kit's hands, and this kit owns neither word.
  finished: (singular: string, state: string) => `${upperFirst(singular)}: ${lowerFirst(state)}`,
  available: "Disponível",
  soldOut: "Esgotado",
  full: "Lugares insuficientes",
  booked: "Reservado",
  closed: "Fechado",
  past: "Já começou",
  expired: "Esta disponibilidade expirou. Atualize-a.",
  unknownCapacity: "Capacidade desconhecida",
  capacity: "Lugares disponíveis",
  refresh: "Atualizar",
  today: "Hoje",
  previous: "Anterior",
  day: "Dia",
  week: "Semana",
  agenda: "Agenda",
  allDay: "Todo o dia",
  continues: "Continua",
  moreEvents: "Mais eventos",
  weekSideways: "Deslize para o lado para ver o resto da semana",
  noEvents: "Sem eventos",
  estimate: "Estimativa",
  price: "Preço",
  quantity: "Quantidade",
  increase: "Aumentar",
  decrease: "Diminuir",
  remove: "Remover",
  subtotal: "Subtotal",
  adjustments: "Ajustes",
  total: "Total",
  quoteExpired: "Peça uma nova cotação.",
  receipt: "Recibo",
  quote: "Cotação",
  current: "Plano atual",
  recommended: "Recomendado",
  period: "Período de faturação",
  included: "Incluído",
  notIncluded: "Não incluído",
  unknown: "Desconhecido",
  map: "Mapa",
  list: "Lista",
  legend: "Legenda",
  zoomIn: "Ampliar",
  zoomOut: "Reduzir",
  panLeft: "Mover para a esquerda",
  panRight: "Mover para a direita",
  panUp: "Mover para cima",
  panDown: "Mover para baixo",
  reset: "Repor",
  unsupportedLocation: "Esta localização está fora da projeção do mapa.",
  points: "Localizações",
  images: "Imagens",
  imageUnavailable: "Imagem indisponível",
  retryImage: "Recarregar imagem",
  photoCount: (count: string, total: number) => `${count} ${total === 1 ? "foto" : "fotos"}`,
  shownInLanguage: (language: string) => `Mostrado em ${language} — ainda não traduzido`,
  languageEnglish: "inglês",
  languagePortuguese: "português",
  formatting: "Formatação",
  bold: "Negrito",
  italic: "Itálico",
  heading: "Título",
  bulletList: "Lista",
  image: "Imagem",
  noFilesToInsert: "Este espaço ainda não tem ficheiro para colocar no texto.",
  imageSource: "Adicionar uma imagem ao texto",
  takePhoto: "Tirar foto",
  photoLibrary: "Biblioteca de fotos",
  photoNotStored:
    "Este telefone não conseguiu guardar a imagem, por isso nada foi colocado no texto.",
  mixedLanguageWrite:
    "Alterou um campo traduzido e um que o registo guarda no seu próprio idioma. Guarde um e depois o outro.",
  table: "Tabela de dados",
  peak: "Pico",
  range: "Intervalo",
  noSamples: "Sem amostras",
  noBaseline: "Sem referência",
  unchanged: "Sem alteração",
  favorable: "Favorável",
  unfavorable: "Desfavorável",
  step: "Etapa",
  unmeasured: "Sem total para medir",
  left: "restante",
  play: "Reproduzir",
  pause: "Pausar",
  rewind: "Retroceder",
  skipAhead: "Avançar",
  search: "Pesquisar",
  results: "resultados",
  clearSearch: "Limpar pesquisa",
  cancelSearch: "Cancelar pesquisa",
  searching: "A pesquisar",
  navigate: "Navegar",
  cancel: "Cancelar",
  dismiss: "Dispensar",
  specimenPass: "Passe anual da Galeria do Rio",
  specimenGroup: "Opções de passe",
  benefitTours: "Visita guiada à sala de gravuras",
  variantIndividual: "Individual",
  variantTwoAdults: "Dois adultos",
  stepDetails: "Os seus dados",
  stepVisit: "Hora da visita",
  photoPrintRoom: "A sala de gravuras com a luz da manhã",
  photoCourtyard: "O pátio visto do patamar de cima",
  placePrintRoom: "Sala de gravuras",
  placeCourtyard: "Pátio",
  seriesVisitors: "Visitantes por hora",
  seriesPassesSold: "Passes vendidos",
  axisHour: "Hora do dia",
  axisVisitors: "Visitantes",
  unitVisitors: "visitantes",
  unitPasses: "passes",
  axisVariant: "Passe",
  seriesChange: "Variação de passes face à semana passada",
  seriesCourtyard: "Visitantes no pátio",
  meterStorage: "Armazenamento usado",
  detailBody: "Admite dois adultos à sala de gravuras e ao pátio. Mostre-o em qualquer entrada.",
  detailAdmission: "Admite a",
  detailVisitors: "Para",
  queryPrint: "sala de gravuras",
  nowPlaying: "A tocar",
  periodMonthly: "Mensal",
  periodAnnual: "Anual",
  unitMonthly: "por mês",
  unitYearly: "por ano",
  sourceFloorPlan: "Planta do piso da galeria",
  audioTour: "Audioguia",
  confirmItIsYou: "Confirme que é você",
  codePrompt:
    "Introduza o código de seis dígitos da sua aplicação autenticadora, ou um dos seus códigos de recuperação.",
  code: "Código",
  checkCode: "Verificar código",
  codeWrong: "Esse código não está certo.",
  checking: "A verificar…",
  backToPassword: "Voltar à palavra-passe",
  sessionExpired: "O seu início de sessão expirou. Inicie sessão novamente.",
  noScopes: "Esta conta não concede nada que esta aplicação possa abrir.",
  noChallenge:
    "Nenhuma etapa de código está aberta neste telemóvel. Inicie sessão novamente com a palavra-passe.",
  keyNotStopped:
    "A chave deste dispositivo não pôde ser revogada a partir daqui; remova-a nos dispositivos da sua conta.",
  pushChannel: "Notificações PlatformKit",
  pushInvite: "Quer receber uma notificação quando algo muda num registo que acompanha?",
  pushTurnOn: "Ativar",
  pushNotNow: "Agora não",
  pushRefused:
    "Este servidor não conseguiu contactar um serviço de notificações para este dispositivo. Nada mais mudou.",
  pushNotRemoved:
    "Este dispositivo não pôde ser removido das suas notificações. Tente terminar a sessão novamente.",
};
