// The Decide pack reads the module's own JSON projections, which the pinned document does not
// print a route for. Each validator is the shape the module answers with, so a body outside it is
// refused at the transport rather than drawn as a row with a missing member.
import { z } from "zod";

/** QuestionWire is a question row: what it is called, whether it still accepts votes, and which revision the next command must expect. */
export const questionWire = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  revision: z.number(),
  creatorId: z.string().optional(),
  allowLinkJoin: z.boolean().optional(),
  closesAt: z.string().nullish(),
  closedAt: z.string().nullish(),
});
export type QuestionWire = z.output<typeof questionWire>;

/** OptionWire is one choice, in the order the question was opened with. */
export const optionWire = z.object({
  id: z.string(),
  title: z.string(),
  imageId: z.string().optional(),
  note: z.string().optional(),
  link: z.string().optional(),
  position: z.number(),
});

/** TallyWire is who voted which way for one option: the ballot counts and the person ids behind them. */
export const tallyWire = z.object({
  option: optionWire,
  score: z.number(),
  counts: z.object({ yes: z.number(), strong: z.number(), no: z.number(), skip: z.number() }),
  voters: z
    .object({
      yes: z.array(z.string()).default([]),
      strong: z.array(z.string()).default([]),
      no: z.array(z.string()).default([]),
      skip: z.array(z.string()).default([]),
    })
    .default({ yes: [], strong: [], no: [], skip: [] }),
  matched: z.boolean().optional(),
});

/** ResultsWire is the ranking as the module ranked it: in score order, with the tally beside each option. */
export const resultsWire = z.object({
  questionId: z.string(),
  questionRevision: z.number(),
  observedAt: z.string(),
  acceptingVotes: z.boolean(),
  options: z.array(tallyWire),
});
export type ResultsWire = z.output<typeof resultsWire>;
export type TallyWire = z.output<typeof tallyWire>;

/** ParticipantWire is one person who may vote. */
export const participantWire = z.object({
  questionId: z.string(),
  personId: z.string(),
  joinedAt: z.string().optional(),
  revision: z.number().optional(),
});
export type ParticipantWire = z.output<typeof participantWire>;

/** InviteWire is a credential to join: the token, and how long it may be spent. */
export const inviteWire = z.object({
  questionRevision: z.number(),
  token: z.string(),
  expiresAt: z.string(),
});
export type InviteWire = z.output<typeof inviteWire>;

/**
 * The answer to `open` is the question that now exists; the module prints no separate receipt, so
 * the pack reads the row back through the same validator a read answers with.
 */
export const openWire = questionWire;
