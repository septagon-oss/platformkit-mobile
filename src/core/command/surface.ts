/** surface: what a command says on screen, and what it asks before it runs. */
import { Command, Entry } from "../catalog";
import { EntrySubject } from "../failure";
import { type Copy } from "../copy";
import { entryIcon, type ResourceIcon } from "../pictures";
import { control } from "../internals";
import { commandOf, offered } from "./verbs";
import { humanize, label, nounPhrase, plural } from "../present";
import { type Control, type FormBlock, orderControls } from "../form";

/**
 * What a refusal's sentence names. The nouns are the catalogue's own — never a
 * word written into a failure rule — and `lastSeen` is the reader-formatted
 * instant of the last good read, which a refresh quotes and a first read cannot.
 */
export function failureSubject(entry: Entry, command = "", lastSeen = ""): EntrySubject {
  const named = nounPhrase(entry);
  return {
    singular: named.singular,
    plural: named.plural,
    command,
    lastSeen,
  };
}

/**
 * commandControls is a command's argument as a form: the same controls a field
 * of the entity gets, because a command's argument is described the same way.
 * A command that takes no argument has none, which is what makes it a
 * confirmation rather than a sheet.
 */
export function commandControls(c: Command): readonly Control[] {
  return c.fields
    .filter((f) => f.type !== "picture")
    .map((f) => control(f, f.default ?? "", false));
}

/**
 * commandSections is a command's argument as the one block it is: no identity to
 * lead with, because an argument is not a record's field, and no heading, because
 * a sheet with one group is that group alone. Required first is still worth
 * saying, so the order is the same `orderControls` the entity's own sheet uses.
 */
export function commandSections(c: Command): readonly FormBlock[] {
  return [{ key: "", label: "", controls: orderControls(commandControls(c)) }];
}

/**
 * commandTitle is what a person taps: the summary the API document gives, or
 * the verb spelled as words when it gives none.
 */
export const commandTitle = (c: Command): string => c.hints?.label || c.summary || humanize(c.verb);

/**
 * CommandWording is everything a person is told about one command, in the words
 * this build is allowed to say, assembled once for the dialog, the sheet and the
 * sentence said afterwards.
 *
 * Two rules hold across the five answers. Nothing a person reads is the
 * developer's `description`, which describes a wire member to whoever wrote the
 * server. And a fact already in the title is never repeated under it: where the
 * summary *is* the title the consequence is empty rather than the same sentence
 * twice, which leaves a command nobody described as a bare confirm — an explicit
 * question with an invented sentence about what it does is the worse screen.
 */
export interface CommandWording {
  /** title is the sheet's header and the dialog's question. */
  readonly title: string;
  /** button is the short domain word the answer is made of — never a whole sentence on a button. */
  readonly button: string;
  /** actsOn is the record the command runs on, "" when it runs on the list or the screen the dialog is drawn over. */
  readonly actsOn: string;
  /** consequence is what running it does, "" when the document says nothing. */
  readonly consequence: string;
  /** success is what the record says afterwards. */
  readonly success: string;
}

export function commandWording(c: Command, actsOn: string, copy: Copy): CommandWording {
  const title = commandTitle(c);
  const summary = c.summary ?? "";
  return {
    title,
    button: c.hints?.label ?? humanize(c.verb),
    actsOn,
    consequence: c.hints?.confirmation?.body ?? (summary !== title ? summary : ""),
    success: c.hints?.successMessage ?? copy.kit.commandDone(c.hints?.label ?? humanize(c.verb)),
  };
}

/** commandConfirmation applies the declared destructive/consequence rule shared by row and deck inputs. */
export function commandConfirmation(command: Command, copy: Copy) {
  const wording = commandWording(command, "", copy);
  return {
    ...wording,
    required: command.hints?.destructive === true || wording.consequence !== "",
  };
}

/**
 * RowAction is what one of an entry's rows offers a swipe: the verb, the words the
 * revealed surface and the receipt after it, and whether running it hurts.
 */
export interface RowAction {
  readonly verb: string;
  /** label is the short domain word the surface is built of — never a whole sentence. */
  readonly label: string;
  /** success is the sentence said afterwards, the same one the record would say. */
  readonly success: string;
  /** consequence is what running it does, "" when the document says nothing. */
  readonly consequence: string;
  readonly destructive: boolean;
  /** icon is the entry's own declared picture, worn in the command's tone; absent when the entry declares none this build draws. */
  readonly icon?: ResourceIcon;
}

/**
 * rowAction is the command this entry's rows may be swiped to run, resolved the way
 * a deep link resolves it, or nothing when no row of this entry swipes.
 *
 * It answers to the verb the entry declared, through the same lookup a routed sheet
 * uses, so a swipe and a typed address cannot disagree about which command a verb
 * names. Availability is all the phone is given: the command reached this session's
 * document, is not run by the kernel for its own reasons, and runs on one record.
 * Whether it runs on *this* record is the server's answer to the request, and a
 * refusal is reported there rather than guessed at here.
 */
export function rowAction(e: Entry, copy: Copy): RowAction | undefined {
  const verb = e.hints?.primaryCommand;
  if (verb === undefined) return undefined;
  const c = commandOf(e, verb, "record");
  if (c === undefined || !offered(c)) return undefined;
  const { button, success, consequence } = commandWording(c, "", copy);
  const icon = entryIcon(e);
  return {
    verb,
    label: button,
    success,
    consequence,
    destructive: c.hints?.destructive === true,
    ...(icon === undefined ? {} : { icon }),
  };
}

/** rowSwipeTone is which pair the revealed surface wears: the one that hurts, or the one that acts. */
export const rowSwipeTone = (action: RowAction): "primary" | "destructive" =>
  action.destructive ? "destructive" : "primary";
