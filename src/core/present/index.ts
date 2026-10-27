/**
 * core/present is the door a page enters to ask how a value, a word, a tone and a state
 * read. It re-exports the formatting mechanism in ../presentation, which is a locale,
 * a zone and an instant in, text out. A consumer imports this path and nothing under it.
 */
export * from "./media";
export * from "./people";
export * from "./present";
export * from "./tones";
export * from "./words";
export * from "../presentation";
export * from "../feedback";
export * from "../copy";
export * from "../pictures";
export * from "../illustrations";
