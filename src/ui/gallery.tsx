// Gallery is every atom and molecule with sample props, in both modes, on one
// screen: the place a person looks at the library rather than at a resource,
// as the web shell's component gallery is. It ships only in builds that ask
// for it (app/gallery.tsx); nothing here names an entity.
import React, { useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import {
  kitCaseIds,
  kitExamples,
  type GallerySelection,
  deriveCopy,
  deriveFeedback,
  humanize,
  stateExamples,
  timeText,
  type Feedback,
  type Language,
  type Presentation,
} from "../core/derive";
import { deriveGalleryPage, pageFamily, type GalleryPageModel } from "../core/galleryPages";
import { Badge } from "./atoms/Badge";
import { Button } from "./atoms/Button";
import { ChoiceRow } from "./atoms/ChoiceRow";
import { DateTimeRow } from "./atoms/DateTimeRow";
import { Icon } from "./atoms/Icon";
import { Notice } from "./atoms/Notice";
import { Spinner } from "./atoms/Spinner";
import { SwitchRow } from "./atoms/SwitchRow";
import { Text } from "./atoms/Text";
import { TextField } from "./atoms/TextField";
import { DetailRow } from "./molecules/DetailRow";
import { FormField } from "./molecules/FormField";
import { LoadMore } from "./molecules/LoadMore";
import { Row } from "./molecules/Row";
import { Section } from "./molecules/Section";
import { ServerField } from "./molecules/ServerField";
import { TagsField } from "./molecules/TagsField";
import { Value } from "./molecules/Value";
import { Screen } from "./templates/Screen";
import { ThemeProvider, useStyles, useTheme, type Theme, type Palette, type Fonts } from "./theme";
import { StateView, type Props as StateViewProps } from "./molecules/StateView";
import type { Mode } from "./tokens";

import { ActionControl } from "./atoms/ActionControl";
import { SelectionControl } from "./atoms/SelectionControl";
import { Price } from "./atoms/Price";
import { ActionBar } from "./molecules/ActionBar";
import { ChoiceChips } from "./molecules/ChoiceChips";
import { DisclosureSection } from "./molecules/DisclosureSection";
import { DayStrip } from "./molecules/DayStrip";
import { QuantityControl } from "./molecules/QuantityControl";
import { ProgressMeter } from "./molecules/ProgressMeter";
import { TabBar } from "./molecules/TabBar";
import { SearchField } from "./molecules/SearchField";
import { MiniPlayer } from "./molecules/MiniPlayer";
import { ConfirmDialog } from "./molecules/ConfirmDialog";
import { SlotOption } from "./molecules/SlotOption";
import { MapLegend } from "./molecules/MapLegend";
import { MediaHero, type ImageRenderer } from "./molecules/MediaHero";
import { ModelState } from "./molecules/ModelState";
import { Sparkline } from "./molecules/Sparkline";
import { StatTile } from "./molecules/StatTile";
import { Activity } from "./organisms/Activity";
import { DataList } from "./organisms/DataList";
import { Stepper } from "./organisms/Stepper";
import { SlotPicker } from "./organisms/SlotPicker";
import { Calendar } from "./organisms/Calendar";
import { WeekCalendar } from "./organisms/WeekCalendar";
import { AgendaList } from "./organisms/AgendaList";
import { ProductCard } from "./organisms/ProductCard";
import { Cart } from "./organisms/Cart";
import { OrderSummary } from "./organisms/OrderSummary";
import { PricingTiers } from "./organisms/PricingTiers";
import { PlanComparison } from "./organisms/PlanComparison";
import { MapWithList } from "./organisms/MapWithList";
import { PhotoGallery } from "./organisms/PhotoGallery";
import { PhotoViewer, type ZoomSlotProps } from "./organisms/PhotoViewer";
import { MasonryWall } from "./organisms/MasonryWall";
import { AreaChart } from "./organisms/AreaChart";
import { BarChart } from "./organisms/BarChart";
import { BuyBar } from "./templates/BuyBar";
import { DetailSheet } from "./templates/DetailSheet";
import { SidePanel } from "./templates/SidePanel";
import { MoreFilters } from "./templates/MoreFilters";
import { SummaryDetail } from "./templates/SummaryDetail";

const choices = [
  { value: "open", label: "Open" },
  { value: "done", label: "Done" },
];

interface Props {
  readonly presentation: Presentation;
  readonly palette?: Readonly<Record<Mode, Palette>>;
  readonly fonts?: Fonts;
  readonly initialCaseId?: string;
  readonly initialMode?: Mode;
  /** page shows one screen-shaped composition instead of the pickers; the index screen keeps the audit of every case. */
  readonly page?: string;
  /** Screen composition can supply its native announcement adapter. */
  readonly renderImage?: ImageRenderer;
  readonly renderZoom?: (props: ZoomSlotProps) => React.ReactNode;
  readonly renderState?: (props: StateViewProps) => React.ReactNode;
}

const stateView = (props: StateViewProps) => <StateView {...props} />;

export function Gallery({
  presentation,
  palette,
  fonts,
  initialCaseId = "primitives/default",
  initialMode = "light",
  page,
  renderState = stateView,
  renderImage,
  renderZoom,
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [language, setLanguage] = useState<Language>();
  const [locale, setLocale] = useState<string>();
  const [caseId, setCaseId] = useState(initialCaseId);
  const [action, setAction] = useState("");
  const copy = language ? deriveCopy(language) : presentation.copy;
  const shown = { ...presentation, copy, locale: locale ?? presentation.locale };
  const cases = stateExamples(shown);
  const example = cases.ok ? cases.value.find((item) => item.id === caseId) : undefined;
  const words = copy.gallery;
  const feedback = deriveFeedback(copy, shown.motion, shown);
  if (page !== undefined) {
    const derived = deriveGalleryPage(page, shown);
    return (
      <ThemeProvider
        mode={initialMode}
        {...(palette ? { palette } : {})}
        {...(fonts ? { fonts } : {})}
      >
        <Screen testID={derived.ok ? derived.value.testID : "gallery-page:invalid"}>
          {derived.ok ? (
            <Page
              model={derived.value}
              presentation={shown}
              {...(renderImage ? { renderImage } : {})}
              {...(renderZoom ? { renderZoom } : {})}
            />
          ) : (
            <Notice text={derived.issues[0]!.message} announcement="urgent" />
          )}
        </Screen>
      </ThemeProvider>
    );
  }
  return (
    <ThemeProvider mode={mode} {...(palette ? { palette } : {})} {...(fonts ? { fonts } : {})}>
      <Screen
        form
        testID="gallery"
        scroll={
          !/^(data-list|photo-gallery|masonry-wall|agenda-list|calendar|map-with-list)\//.test(
            caseId,
          )
        }
      >
        <Section title={words.appearance}>
          <ChoiceRow
            copy={copy.choice}
            label={words.appearance}
            value={mode}
            options={[
              { value: "light", label: words.light },
              { value: "dark", label: words.dark },
            ]}
            onChange={(value) => setMode(value === "dark" ? "dark" : "light")}
            testID="gallery-mode"
          />
          <ChoiceRow
            copy={copy.choice}
            label={words.language}
            value={copy.language}
            options={[
              { value: "en", label: words.english },
              { value: "pt", label: words.portuguese },
            ]}
            onChange={(value) => setLanguage(value === "pt" ? "pt" : "en")}
            testID="gallery-language"
          />
          <ChoiceRow
            copy={copy.choice}
            label={words.locale}
            value={shown.locale}
            options={[...new Set([presentation.locale, "en-GB", "pt-PT", "pt-BR"])].map(
              (value) => ({ value, label: value }),
            )}
            onChange={setLocale}
            testID="gallery-locale"
          />
          <ChoiceRow
            copy={copy.choice}
            label={words.case}
            value={caseId}
            options={[
              { value: "primitives/default", label: words.primitives },
              ...kitCaseIds.map((id) => ({ value: id, label: id })),
              ...(cases.ok ? cases.value.map(({ id }) => ({ value: id, label: id })) : []),
            ]}
            onChange={(id) => {
              setCaseId(id);
              setAction("");
            }}
            testID="gallery-case"
          />
        </Section>
        {!cases.ok ? (
          <Notice text={cases.issues[0]!.message} announcement="urgent" />
        ) : caseId === "primitives/default" ? (
          <Samples feedback={feedback} initialDate={new Date(presentation.now)} />
        ) : (kitCaseIds as readonly string[]).includes(caseId) ? (
          <View style={{ flex: 1 }} testID="gallery-kit">
            <KitSamples
              key={caseId}
              presentation={shown}
              caseId={caseId}
              onAction={setAction}
              {...(renderImage ? { renderImage } : {})}
              {...(renderZoom ? { renderZoom } : {})}
            />
            <Text accessibilityLiveRegion="polite" testID="gallery-kit-action">
              {action ? words.actionReceived(action) : ""}
            </Text>
          </View>
        ) : example ? (
          <Section title={words.states}>
            {example.renderer === "spinner" ? (
              <Spinner
                label={example.model.loadingLabel}
                motion={example.model.motion}
                testID="gallery-spinner"
              />
            ) : (
              renderState({ model: example.model, onAction: setAction, testID: "gallery-state" })
            )}
            <Text accessibilityLiveRegion="polite" testID="gallery-action">
              {action ? words.actionReceived(action) : ""}
            </Text>
          </Section>
        ) : (
          <Notice text={copy.issue.invalid} announcement="urgent" />
        )}
      </Screen>
    </ThemeProvider>
  );
}

/**
 * Page is one gallery page: a display line naming what the screen is, the lead
 * specimen that carries it, then the page's other cases, one section each under
 * the family that owns them. No case id, no picker, no caption — a page has to
 * read as the screen it stands for, which is what the review looks at.
 */
function Page({
  model,
  presentation,
  renderImage,
  renderZoom,
}: {
  readonly model: GalleryPageModel;
  readonly presentation: Presentation;
  readonly renderImage?: ImageRenderer;
  readonly renderZoom?: (props: ZoomSlotProps) => React.ReactNode;
}) {
  const s = useStyles(pageStyles);
  const t = useTheme();
  const viewport = useWindowDimensions();
  const [action, setAction] = useState("");
  // Phone components are drawn at a phone's width wherever they are looked at:
  // on a monitor the page keeps that column and centres it, rather than
  // stretching one specimen across the desk and leaving the rest of the screen
  // to empty interiors.
  const column =
    viewport.width > t.extent.pageColumn + 2 * t.space.xl
      ? { alignSelf: "center" as const, width: t.extent.pageColumn }
      : undefined;
  const rest = model.cases.filter((id) => id !== model.lead);
  // One section per family, in the order the page names them: a page reads as
  // the screen it stands for, not as a list of specimen ids.
  const groups: { readonly family: string; readonly cases: string[] }[] = [];
  for (const caseId of rest) {
    const family = humanize(pageFamily(caseId));
    const group = groups.find((entry) => entry.family === family);
    if (group) group.cases.push(caseId);
    else groups.push({ family, cases: [caseId] });
  }
  return (
    <View style={[s.page, column]}>
      <Text role="display">{model.title}</Text>
      <View style={s.lead}>
        <KitSamples
          key={model.lead}
          presentation={presentation}
          caseId={model.lead}
          onAction={setAction}
          {...(renderImage ? { renderImage } : {})}
          {...(renderZoom ? { renderZoom } : {})}
        />
      </View>
      {groups.map((group) => (
        <Section key={group.family} title={group.family}>
          {group.cases.map((caseId) => (
            <KitSamples
              key={caseId}
              presentation={presentation}
              caseId={caseId}
              onAction={setAction}
              {...(renderImage ? { renderImage } : {})}
              {...(renderZoom ? { renderZoom } : {})}
            />
          ))}
        </Section>
      ))}
      <Text accessibilityLiveRegion="polite" testID="gallery-page-action">
        {action ? presentation.copy.gallery.actionReceived(action) : ""}
      </Text>
    </View>
  );
}

function Samples({
  feedback,
  initialDate,
}: {
  readonly feedback: Feedback;
  readonly initialDate: Date;
}) {
  const s = useStyles(styles);
  const [on, setOn] = useState(true);
  const [choice, setChoice] = useState("open");
  const [at, setAt] = useState<Date | undefined>(new Date("2026-01-31T09:00:00Z"));
  const [tags, setTags] = useState("alpha, beta");
  const [server, setServer] = useState("https://acme.example.com");
  const [words, setWords] = useState("");
  const none = () => undefined;
  return (
    <>
      <Section title="Text">
        <View style={s.stack}>
          <Text role="display">Display, the serif</Text>
          <Text role="title" weight="semibold">
            Title
          </Text>
          <Text>Body, the system face</Text>
          <Text role="label" tone="muted">
            Label, muted
          </Text>
          <Text role="caption" uppercase tone="muted">
            Caption, uppercase
          </Text>
          <Text role="mono">3f2a9c…-mono</Text>
          <Text tone="accent">Accent</Text>
          <Text tone="danger">Danger</Text>
        </View>
      </Section>

      <Section title="Buttons">
        <View style={s.wrap}>
          <Button label="Primary" onPress={none} />
          <Button label="Secondary" onPress={none} tone="secondary" />
          <Button label="Delete" onPress={none} tone="destructive" icon="trash" />
          <Button label="Plain" onPress={none} tone="plain" />
          <Button label="Busy" onPress={none} busy />
          <Button label="Off" onPress={none} disabled />
          <Button label="Save" onPress={none} placement="header" />
        </View>
      </Section>

      <Section title="Badges and icons">
        <View style={s.wrap}>
          <Badge label="Ok" tone="ok" />
          <Badge label="Warning" tone="warning" />
          <Badge label="Danger" tone="danger" />
          <Badge label="Info" tone="info" />
          <Badge label="Neutral" />
        </View>
        <View style={s.wrap}>
          {(["add", "chevron", "edit", "trash", "more", "person", "server", "sort"] as const).map(
            (n) => (
              <Icon key={n} name={n} label={n} />
            ),
          )}
        </View>
      </Section>

      <Section title="Fields">
        <FormField label="Words" required help="Some help under the field.">
          <TextField
            value={words}
            onChangeText={setWords}
            placeholder="Type here"
            accessibilityLabel="Words"
          />
        </FormField>
        <FormField label="Refused" error="is required">
          <TextField value="" onChangeText={none} invalid accessibilityLabel="Refused" />
        </FormField>
        <FormField label="Notes">
          <TextField kind="textarea" value="" onChangeText={none} accessibilityLabel="Notes" />
        </FormField>
        <FormField label="Amount">
          <TextField kind="number" value="1,5" onChangeText={none} accessibilityLabel="Amount" />
        </FormField>
        <FormField label="Identifier" help="The identifier of the related record.">
          <TextField
            kind="mono"
            value="3f2a9c1e"
            onChangeText={none}
            accessibilityLabel="Identifier"
          />
        </FormField>
        <FormField label="Pinned" bare>
          <SwitchRow label="Pinned" value={on} onValueChange={setOn} help="A yes or a no." />
        </FormField>
        <FormField label="Status" bare>
          <ChoiceRow
            copy={feedback.copy.choice}
            label="Status"
            value={choice}
            options={choices}
            onChange={setChoice}
          />
        </FormField>
        <FormField label="Due" bare>
          <DateTimeRow
            copy={feedback.copy.dateTime}
            initialValue={initialDate}
            timeZone={feedback.timeZone}
            label="Due"
            value={at}
            onChange={setAt}
            text={(value) => timeText(value, feedback)}
          />
        </FormField>
        <FormField label="Tags" help="Comma separated.">
          <TagsField label="Tags" value={tags} onChange={setTags} />
        </FormField>
        <ServerField value={server} onChange={setServer} />
      </Section>

      <Section title="Rows" footer="A footer says something about the group.">
        <Row title="A row that opens" cells={["Status: Open", "Rank: 2"]} onPress={none} />
        <Row title="A row that does not" cells={["Read only"]} />
        <Row title="Delete" tone="destructive" onPress={none} />
      </Section>

      <Section title="Details">
        <DetailRow term="Title" value="A note" />
        <DetailRow
          term="Id"
          value="3f2a9c1e-1b2c-4d5e-8f90-123456789abc"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "id", type: "uuid" }}
              value="3f2a9c1e-1b2c-4d5e-8f90-123456789abc"
            />
          }
        />
        <DetailRow
          term="Status"
          value="Open"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "status", type: "string", enum: ["open", "done"] }}
              value="open"
            />
          }
        />
        <DetailRow
          term="Pinned"
          value="Yes"
          shown={
            <Value presentation={feedback} field={{ name: "pinned", type: "bool" }} value={true} />
          }
        />
        <DetailRow
          term="Due at"
          value="Jan 31, 2026, 09:00 AM UTC"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "dueAt", type: "time" }}
              value="2026-01-31T09:00:00Z"
            />
          }
        />
        <DetailRow
          term="Tags"
          value="alpha, beta"
          shown={
            <Value
              presentation={feedback}
              field={{ name: "tags", type: "list", elem: "string" }}
              value={["alpha", "beta"]}
            />
          }
        />
        <DetailRow term="Body" value="—" />
      </Section>

      <LoadMore feedback={feedback} remaining={12} busy={false} onPress={none} />
    </>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    fixture: {
      flex: 1,
      gap: t.space.xs,
      padding: t.space.lg,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.color.surfaceMuted,
      // A media slot is the one place a page shows a picture the kit does not
      // own. Without its edge the slot is a patch of the page's own colour and
      // the screen reads as a picture that failed to load rather than as the
      // slot it is, so the outline that says "this edge means something" is
      // drawn here too.
      borderWidth: 1,
      borderColor: t.state.outline,
      borderRadius: t.radius.md,
    },
    artwork: {
      width: t.extent.player,
      height: t.extent.player,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: t.radius.md,
      backgroundColor: t.color.surfaceMuted,
    },
    stack: { gap: t.space.xs, paddingVertical: t.space.sm },
    wrap: { flexDirection: "row", flexWrap: "wrap", gap: t.space.sm, paddingVertical: t.space.sm },
  });

function KitSamples({
  presentation,
  caseId,
  onAction,
  renderImage,
  renderZoom,
}: {
  readonly presentation: Presentation;
  readonly caseId: string;
  readonly onAction: (id: string) => void;
  readonly renderImage?: ImageRenderer;
  readonly renderZoom?: (props: ZoomSlotProps) => React.ReactNode;
}) {
  const [held, setHeld] = useState<GallerySelection>({});
  // A dialog is met by doing something, so the specimen offers the verb first.
  const [asked, setAsked] = useState(false);
  const result = kitExamples(presentation, caseId, held),
    s = useStyles(styles);
  if (!result.ok) return <Notice text={result.issues[0]!.message} announcement="urgent" />;
  const k = result.value,
    c = presentation.copy.kit,
    family = caseId.split("/")[0];
  const action = (id: string) => onAction(id),
    specimen = presentation.copy.gallery,
    send = (value: unknown) => onAction(JSON.stringify(value));
  const image: ImageRenderer =
    renderImage ??
    ((props) => (
      <View style={s.fixture} accessible={!props.decorative} accessibilityLabel={props.description}>
        <Text>{props.description}</Text>
      </View>
    ));
  const zoom =
    renderZoom ??
    ((props: ZoomSlotProps) => (
      <View>
        {props.children}
        <Notice text={presentation.copy.issue.unsupported} announcement="polite" />
      </View>
    ));
  const choice = (id: string | undefined) => {
    setHeld({ ...held, ...(id ? { choice: id } : { choice: undefined }) });
    send(id);
  };
  const quantity = (value: number) => {
    setHeld({ ...held, quantity: value });
    send(value);
  };
  const close = () => {
    setHeld({ ...held, open: false });
    action("close");
  };
  const details = <Text>{presentation.copy.gallery.longBody}</Text>;
  const pricing = {
    onPeriod: action,
    onSelect: action,
    onAction: send,
    onRetry: () => action("retry"),
  };
  switch (family) {
    case "action-control":
      return <ActionControl model={k.actions.actions[0]!} onAction={action} />;
    case "selection-control":
      return <SelectionControl model={k.selection} onChange={send} />;
    case "choice-chips":
      return <ChoiceChips model={k.choices} onChange={choice} />;
    case "action-bar":
      return <ActionBar model={k.actions} onAction={action} />;
    case "model-state":
      return <ModelState model={k.list} />;
    case "data-list":
      return (
        <DataList
          model={k.list}
          onOpen={action}
          onRowAction={send}
          onSelection={(ids) => {
            setHeld({ ...held, selectedIds: ids });
            send(ids);
          }}
          onCollapse={send}
          onBulkAction={send}
        />
      );
    case "detail-sheet":
      return caseId.endsWith("busy") ? (
        <SidePanel mode="docked" model={k.surface} onAction={action} onRequestClose={close}>
          {details}
        </SidePanel>
      ) : (
        <DetailSheet model={k.surface} onAction={action} onRequestClose={close}>
          {details}
        </DetailSheet>
      );
    case "side-panel":
      return (
        <SidePanel mode="docked" model={k.surface} onAction={action} onRequestClose={close}>
          {details}
        </SidePanel>
      );
    case "disclosure-section":
      return (
        <DisclosureSection
          model={k.disclosure}
          onExpanded={(expanded) => setHeld({ ...held, expanded })}
        >
          {details}
        </DisclosureSection>
      );
    case "more-filters":
      return (
        <MoreFilters
          model={k.surface}
          filters={[k.choices]}
          onRequestClose={close}
          onChange={(_, id) => choice(id)}
        />
      );
    case "summary-detail":
      return (
        <SummaryDetail
          model={k.disclosure}
          onExpanded={(expanded) => setHeld({ ...held, expanded })}
        >
          {details}
        </SummaryDetail>
      );
    case "activity":
      return <Activity model={k.activity} onExpand={send} onOpen={action} />;
    case "stepper":
      return (
        <Stepper
          model={k.stepper}
          onNext={() => action("next")}
          onBack={() => action("back")}
          onGo={action}
          onSkip={() => action("skip")}
          onFinish={() => action("finish")}
          onSaveAndExit={() => action("save-exit")}
          onReconcile={() => action("reconcile")}
        >
          {details}
        </Stepper>
      );
    case "slot-option":
      return k.slots.slots[0] ? (
        <SlotOption model={k.slots.slots[0]} onSelect={(id) => setHeld({ ...held, slot: id })} />
      ) : null;
    case "slot-picker":
      return (
        <SlotPicker
          model={k.slots}
          onDate={action}
          onSelect={(value) => {
            setHeld({ ...held, slot: value.slotId });
            send(value);
          }}
          onClear={() => setHeld({ ...held, slot: undefined })}
          onRefresh={() => action("refresh")}
        />
      );
    case "day-strip":
      return (
        <DayStrip
          model={k.calendar.strip}
          onDate={action}
          onPrevious={() => action("previous")}
          onNext={() => action("next")}
          onToday={() => action("today")}
        />
      );
    case "week-calendar":
      return (
        <WeekCalendar
          model={k.calendar.week}
          onDate={action}
          onEvent={action}
          onMoreEvents={send}
        />
      );
    case "agenda-list":
      return <AgendaList model={k.calendar.agenda} onEvent={action} />;
    case "calendar":
      return (
        <Calendar
          model={k.calendar.calendar}
          onDate={action}
          onEvent={action}
          onMoreEvents={send}
          onRefresh={() => action("refresh")}
          onMore={() => action("more")}
          onView={action}
          onNavigate={send}
        />
      );
    case "price":
      return <Price model={k.price} />;
    case "quantity-control":
      return <QuantityControl model={k.quantity} onChange={quantity} />;
    case "product-card":
      return (
        <ProductCard
          model={k.product}
          onOpen={action}
          onAction={send}
          onOption={(_, id) => choice(id)}
          onQuantity={quantity}
        />
      );
    case "buy-bar":
      return <BuyBar model={k.buy} onAction={action} />;
    case "cart":
      return (
        <Cart
          model={k.cart}
          onQuantity={(_, value) => quantity(value)}
          onRemove={action}
          onOpen={action}
          onCheckout={send}
          onRefresh={() => action("refresh")}
        />
      );
    case "order-summary":
      return <OrderSummary model={k.summary} />;
    case "pricing-tiers":
      return <PricingTiers model={k.pricing.tiers} {...pricing} />;
    case "plan-comparison":
      return <PlanComparison model={k.pricing.comparison} {...pricing} />;
    case "map-legend":
      return <MapLegend model={k.map.legend} />;
    case "map-with-list":
      return (
        <MapWithList
          model={k.map.map}
          renderMap={() => null}
          renderDetail={(id) => (
            <Section title={c.details}>
              <Text>{id}</Text>
            </Section>
          )}
          onMode={action}
          onSelect={(id) => {
            setHeld({ ...held, point: id });
            action(id);
          }}
          onRevealPoints={send}
          onClearSelection={() => setHeld({ ...held, point: undefined })}
          onViewport={send}
          onAction={send}
          onRetry={() => action("retry")}
        />
      );
    case "media-hero":
      return (
        <MediaHero
          model={k.hero}
          renderImage={image}
          onOpen={action}
          onAction={action}
          onRetry={action}
        />
      );
    case "photo-gallery":
      return (
        <PhotoGallery
          model={k.media}
          renderImage={image}
          onOpen={action}
          onMore={() => action("more")}
          onRetry={action}
        />
      );
    case "photo-viewer":
      return (
        <PhotoViewer
          model={k.viewer}
          renderImage={image}
          renderZoom={zoom}
          onSelect={(id) => setHeld({ ...held, media: id })}
          onClose={close}
          onRetry={action}
        />
      );
    case "masonry-wall":
      return (
        <MasonryWall
          model={k.media}
          columns={2}
          renderImage={image}
          onOpen={action}
          onMore={() => action("more")}
          onRetry={action}
        />
      );
    case "sparkline":
      return <Sparkline model={k.spark} />;
    case "area-chart":
      return (
        <AreaChart
          model={k.chart}
          onRange={action}
          onPoint={send}
          onClearPoint={() => action("clear")}
          onRetry={() => action("retry")}
        />
      );
    case "bar-chart":
      return (
        <BarChart
          model={k.bars}
          onCategory={action}
          onRange={action}
          onRetry={() => action("retry")}
        />
      );
    case "stat-tile":
      return <StatTile model={k.stat} />;
    case "progress-meter":
      return (
        <ProgressMeter
          model={k.meter}
          marks={caseId.endsWith("/steps")}
          tone={caseId.endsWith("/unmeasured") ? "warning" : "accent"}
          testID="gallery-meter"
        />
      );
    case "tab-bar":
      return (
        <TabBar
          model={k.tabs}
          icons={["person", "add", "more", "server", "sort"]}
          onSelect={(id) => {
            setHeld({ ...held, choice: id });
            action(id);
          }}
          testID="gallery-tabs"
        />
      );
    case "search-field":
      return (
        <SearchField
          model={k.search}
          onChangeText={(value) => send({ query: value })}
          onSubmit={() => action("search")}
          onClear={() => {
            setHeld({ ...held, choice: undefined });
            action("clear");
          }}
          testID="gallery-search"
        />
      );
    case "mini-player":
      return (
        <MiniPlayer
          model={k.playback}
          title={specimen.case}
          subtitle={c.details}
          artwork={
            <View
              style={s.artwork}
              accessible
              accessibilityLabel={specimen.case}
              testID="gallery-player-art"
            >
              <Text>{specimen.case}</Text>
            </View>
          }
          playing={caseId.endsWith("/track")}
          controls={{ back: true, forward: true }}
          collapsed={caseId.endsWith("/live")}
          onIntent={send}
          testID="gallery-player"
        />
      );
    case "confirm-dialog":
      return (
        <View style={s.stack}>
          <Button
            label={caseId.endsWith("/keep") ? c.close : c.remove}
            tone={caseId.endsWith("/keep") ? "secondary" : "destructive"}
            {...(caseId.endsWith("/keep") ? {} : { icon: "trash" as const })}
            onPress={() => {
              setAsked(true);
              action("ask");
            }}
            testID="gallery-confirm-open"
          />
          <ConfirmDialog
            open={asked}
            title={caseId.endsWith("/keep") ? c.close : c.remove}
            body={specimen.longBody}
            reason={c.unsaved}
            confirm={caseId.endsWith("/keep") ? c.close : c.remove}
            cancel={c.cancel}
            tone={caseId.endsWith("/keep") ? "primary" : "destructive"}
            motion={presentation.motion}
            onConfirm={() => {
              setAsked(false);
              action("confirm");
            }}
            onCancel={() => {
              setAsked(false);
              action("cancel");
            }}
            testID="gallery-confirm"
          />
        </View>
      );
    default:
      return null;
  }
}

const pageStyles = (t: Theme) =>
  StyleSheet.create({
    page: { gap: t.space.md, paddingTop: t.space.sm },
    lead: { gap: t.space.sm },
  });
