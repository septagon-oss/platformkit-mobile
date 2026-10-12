// useOperation is where a generated read becomes a prop: the pack screen names
// an operation of the pinned document and its input, and gets the validated
// body back — or the refusal, with the row it replaced withdrawn.
//
// Why the name, and not the data, arrives here: the document decides which
// operations exist and which body each answers with, so the moment a screen
// names one, `tsc` decides whether the field it draws is in that body. A pack
// that reads a field the pin lacks never reaches a device.
//
// What is deliberately *not* here: the "re-read when this app wrote to the
// resource" rule and the focus re-read. Those belong to the generated screens
// (`useResourceDetail`, `useActivity`, `useSingleton` own one copy each, and a
// fourth is refused); converting the three into one is its own change, and a
// pack screen that has just run a command re-reads by calling `reload()`.
import { useCallback, useEffect, useRef, useState } from "react";
import { recordSubject } from "../core/derive";
import { useShell } from "../shell";
import { refusalOf, screenCopy } from "./failure";
import type { OperationData, OperationInput, OperationName, ReadState } from "../renderers";

/**
 * Reader is one generated operation as this hook calls it: its generated input
 * in, its validated body out. `api.operations[name]` *is* exactly this function;
 * TypeScript cannot carry the correspondence between a generic key and its
 * value's return type, so the one bridge is stated here rather than at every
 * call site. The name, the input and the body each stay checked against the
 * document, which is the half a screen could otherwise get wrong.
 */
type Reader<K extends OperationName> = (
  input: OperationInput<K>,
) => Promise<{ readonly data: OperationData<K> }>;

export function useOperation<K extends OperationName>(
  name: K,
  input: OperationInput<K> | undefined,
): ReadState<OperationData<K>> {
  const { api } = useShell();
  const [state, setState] = useState<{
    requested: boolean;
    data: OperationData<K> | undefined;
    error: string;
  }>({ requested: false, data: undefined, error: "" });
  const generation = useRef(0);
  // alive is useCommandForm's, for the same two reasons: a refusal that arrives
  // after the screen is gone has nothing to set, and a ref initialised once is
  // initialised once per hook instance, not once per mount.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // The question, not the object: a screen rebuilds `{ path: { id } }` on every
  // render, and a fresh literal is the same question, while a new id is a new
  // one. Asking by identity here is a read per render; asking by content is one
  // read per question.
  const asked = input === undefined ? "" : JSON.stringify([String(name), input]);
  // The input travels by ref, because the effect below is keyed by its content:
  // the two are the same value at the moment the read starts. The store effect
  // is declared first and runs first, on mount and on every render after.
  const pending = useRef<{ name: K; input: OperationInput<K> | undefined }>({ name, input });
  useEffect(() => {
    pending.current = { name, input };
  });

  const load = useCallback(async () => {
    const started = ++generation.current;
    const settle = () => alive.current && generation.current === started;
    const question = pending.current;
    if (question.input === undefined) {
      // Nothing to ask about — a detail screen whose id has not arrived. Asking
      // anyway would be a read of the whole collection dressed up as one row.
      // A read still owed is retired the way a newer question retires it: it
      // belongs to a subject this screen is no longer naming.
      generation.current++;
      setState({ requested: false, data: undefined, error: "" });
      return;
    }
    setState((was) => ({ ...was, requested: true, error: "" }));
    const read = api.operations[question.name] as Reader<K>;
    try {
      const result = await read(question.input);
      if (!settle()) return;
      setState({ requested: false, data: result.data, error: "" });
    } catch (e) {
      if (!settle()) return;
      // A refusal withdraws the row: a stale value under a fresh refusal would
      // read as the server having agreed a thing it refused. A named operation
      // carries no entry to name, so the sentence names the record it read.
      setState({
        requested: false,
        data: undefined,
        error: refusalOf(e, "read", recordSubject, screenCopy()).text,
      });
    }
  }, [api]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load, asked]);

  return { requested: state.requested, data: state.data, error: state.error, reload: load };
}
