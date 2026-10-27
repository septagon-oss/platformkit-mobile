/**
 * derive.ts is the compatibility window, not the derivation layer: the rules live
 * behind the five doors below, and this barrel publishes what it always did so an
 * existing import keeps answering while its owner repoints at the door its rule
 * belongs to.
 *
 * @deprecated import the door the rule belongs to — `core/list` for which fields a
 * page draws, `core/record` for what one record shows, `core/form` for what a person
 * types and what the phone sends, `core/command` for what a person may do and where
 * the request goes, `core/present` for how a value, a word, a tone and a state read.
 * The kit surfaces named below keep their own module path: a door does not swallow a
 * cart, a chart or a calendar, and the gallery fixtures are the kit's own, carried by
 * no door.
 */

// The doors. One rule, one door: no name is reachable through two of them.
export * from "./list";
export * from "./record";
export * from "./form";
export * from "./command";
export * from "./present";

// The specialist kit models that sit beside the doors. Each file is the door to one
// surface, and a screen that wants one imports it by name instead of receiving the
// rest of the kit with it. The surfaces a door also publishes (collections and
// catalogList through list, surfaces, audit and catalogActivity through record,
// stepper and slots through form, failure through command, pictures, illustrations,
// copy, presentation and feedback through present) reach the barrel through that door
// alone, so no name arrives twice.
export * from "./calendar";
export * from "./commerce";
export * from "./pricing";
export * from "./map";
export * from "./media";
export * from "./charts";
export * from "./summary";
export * from "./table";

// The kit models' validation kernel, published under the name the barrel always used
// for it: `ActionModel` is a drawn action, which left the simple name for the field
// editor in core/form.
export type { Content, ContentModel, Page, Status, ActionModel } from "./shared";

// The gallery fixtures: what the kit's own gallery draws, in English and Portuguese.
// No door carries them, and src/ui/gallery.tsx reads them from the module beside this
// comment.
export { stateExamples, type StateExample } from "./stateGallery";
export { kitExamples, kitCaseIds, type KitExamples, type GallerySelection } from "./kitGallery";
export { sceneFor, sceneNames, type Scene } from "./kitScenes";
