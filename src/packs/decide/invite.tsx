// The invite artefacts: who may vote, and the credential that lets a person in without being
// named. A token is private command output — the module prints it once, on the call that minted
// it — so this block never reads one back: it asks for a link, keeps what that answer said for as
// long as the screen is open, and says plainly when the link is revoked.
//
// The URL is not the pack's to invent. The kernel prints a credential and an expiry, and a host, a
// scheme and a path shape are a product's facts, so the pack is handed `inviteLink` when a product
// builds it. Without that port the block draws no QR and no link, because a picture of a guess is
// worse than no picture.
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { timeText } from "../../core/derive";
import { encodeQr } from "../../core/qr";
import { refusalOf } from "../../screens/failure";
import { useFeedback } from "../../screens/useFeedback";
import { useShell } from "../../shell";
import { Button } from "../../ui/atoms/Button";
import { Notice } from "../../ui/atoms/Notice";
import { Text } from "../../ui/atoms/Text";
import { Section } from "../../ui/molecules/Section";
import { QrCode } from "../../ui/molecules/QrCode";
import { useStyles, type Theme } from "../../ui/theme";
import { inviteWire, participantWire, questionWire, type QuestionWire } from "./wire";
import { z } from "zod";

/** InvitePorts is what a product supplies for invitations to mean anything on this phone. */
export interface InvitePorts {
  /** inviteLink composes the address a person opens; the kernel prints only the credential. */
  readonly link?: (questionId: string, token: string) => string;
  /** inviteUntil says how long a minted credential stays spendable, as an instant after now. */
  readonly until?: (now: Date) => Date;
}

/**
 * InviteBlock is the roster and, when the product supplied a link composer and a lifetime, the
 * credential. The question's revision rides every call: the block re-reads after a write, so a
 * revision nobody observed is never sent twice.
 */
export function InviteBlock({
  questionId,
  question,
  ports = {},
}: {
  readonly questionId: string;
  readonly question: QuestionWire | undefined;
  readonly ports?: InvitePorts;
}) {
  const feedback = useFeedback();
  const copy = feedback.copy.decide;
  const { api } = useShell();
  const s = useStyles(styles);
  const [token, setToken] = useState("");
  const [expires, setExpires] = useState("");
  const [people, setPeople] = useState<readonly string[]>([]);
  const [detail, setDetail] = useState("");
  const [revoked, setRevoked] = useState(false);
  const asked = (failure: unknown) =>
    setDetail(
      refusalOf(
        failure,
        "command",
        {
          singular: copy.questionTitle,
          plural: copy.questionTitle,
          command: copy.invite,
          lastSeen: "",
        },
        feedback.copy,
      ).text,
    );
  const issued = async () => {
    if (question === undefined || ports.until === undefined) return;
    try {
      const invite = await api.request(
        "POST",
        `/api/v1/decide/questions/${encodeURIComponent(questionId)}/issue-invite`,
        (body) => inviteWire.parse(body),
        {
          ifRevision: question.revision,
          expiresAt: ports.until(new Date(feedback.now)).toISOString(),
        },
      );
      setToken(invite.token);
      setExpires(invite.expiresAt);
      setRevoked(false);
      setDetail("");
    } catch (failure) {
      asked(failure);
    }
  };
  const revokedNow = async () => {
    if (question === undefined) return;
    try {
      await api.request(
        "POST",
        `/api/v1/decide/questions/${encodeURIComponent(questionId)}/revoke-invite`,
        (body) => questionWire.parse(body),
        { ifRevision: question.revision },
      );
      setToken("");
      setRevoked(true);
    } catch (failure) {
      asked(failure);
    }
  };
  const roster = async () => {
    try {
      const rows = await api.request(
        "GET",
        `/api/v1/decide/questions/${encodeURIComponent(questionId)}/participants`,
        (body) => z.array(participantWire).parse(body),
      );
      setPeople(rows.map((row) => row.personId));
    } catch (failure) {
      asked(failure);
    }
  };
  const link = token === "" || ports.link === undefined ? "" : ports.link(questionId, token);
  const matrix = link === "" ? undefined : encodeQr(link);
  return (
    <Section title={copy.participants} testID="decide-invite">
      <Button
        testID="decide-invite-roster"
        label={copy.participants}
        placement="inline"
        onPress={() => void roster()}
      />
      {people.map((person) => (
        <Text key={person}>{person}</Text>
      ))}
      {detail ? <Notice announcement="urgent" text={detail} /> : null}
      {revoked ? <Text role="caption">{copy.inviteRevoked}</Text> : null}
      {link === "" ? (
        ports.link === undefined || ports.until === undefined ? null : (
          <Button
            testID="decide-invite-issue"
            label={copy.inviteIssue}
            placement="inline"
            onPress={() => void issued()}
          />
        )
      ) : (
        <View style={s.invite}>
          <Text role="label">{copy.inviteLink}</Text>
          <Text role="mono" selectable>
            {link}
          </Text>
          {expires ? (
            <Text role="caption">{copy.inviteExpires(timeText(new Date(expires), feedback))}</Text>
          ) : null}
          {matrix ? (
            <QrCode matrix={matrix} testID="decide-invite-qr" label={copy.inviteQr} />
          ) : null}
          <Button
            testID="decide-invite-revoke"
            label={copy.inviteRevoke}
            tone="destructive"
            placement="inline"
            onPress={() => void revokedNow()}
          />
        </View>
      )}
    </Section>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    invite: { gap: t.space.xs },
  });
