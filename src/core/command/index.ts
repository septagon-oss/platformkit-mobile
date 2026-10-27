/**
 * core/command is the door a page enters to ask what a person may do here and where the
 * request goes; the failure the server answered arrives through the same door. A
 * consumer imports this path and nothing under it.
 */
export * from "./surface";
export * from "./verbs";
export * from "../failure";
