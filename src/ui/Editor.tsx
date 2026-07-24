// Uncontrolled CodeMirror 6 wrapper: the EditorView lives in a ref; the page
// reads code on demand via the handle. Recreated per lesson (key on lessonId).
import { useEffect, useImperativeHandle, useRef } from "preact/hooks";
import { forwardRef } from "preact/compat";
import { EditorState, Prec } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  bracketMatching,
  indentOnInput,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import { python } from "@codemirror/lang-python";
import { chordBinding } from "./keys";

// Theme-aware syntax colors: values resolve through the CSS variables in
// tokens.css, so light and dark both stay readable from one definition.
const softHighlight = HighlightStyle.define([
  {
    tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword],
    color: "var(--code-keyword)",
  },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--code-string)" },
  {
    tag: [tags.comment, tags.lineComment],
    color: "var(--code-comment)",
    fontStyle: "italic",
  },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--code-number)" },
  {
    tag: [tags.function(tags.variableName), tags.function(tags.propertyName)],
    color: "var(--code-func)",
  },
  { tag: [tags.operator, tags.punctuation], color: "var(--code-op)" },
]);

export interface EditorHandle {
  getValue: () => string;
  setValue: (code: string) => void;
}

interface Props {
  initial: string;
  onDocChanged?: (code: string) => void;
  /** Chords fired from inside the editor; the page owns the disabled checks. */
  onRun?: () => void;
  onSubmit?: () => void;
  onFormat?: () => void;
}

export const Editor = forwardRef<EditorHandle, Props>(function Editor(
  props,
  ref,
) {
  const { initial, onDocChanged } = props;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The extension list below is built ONCE (empty deps), so a callback read
  // from the closure would be frozen at first render. Every keypress reads
  // through this ref instead, which each render refreshes.
  const latest = useRef(props);
  latest.current = props;

  useEffect(() => {
    const state = EditorState.create({
      doc: initial,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        highlightActiveLine(),
        syntaxHighlighting(softHighlight),
        // python() already registers the completion sources (doc-local names,
        // scope-aware, plus keywords and builtins); this supplies the UI they
        // feed. Member access like `np.` needs a live interpreter and is out
        // of scope here.
        autocompletion(),
        closeBrackets(),
        python(),
        // Prec.high is load-bearing: defaultKeymap already binds Mod-Enter to
        // insertBlankLine, so at normal precedence the run chord would lose
        // and quietly insert a line instead.
        Prec.high(
          keymap.of([
            // Each chord is consumed even while its action is unavailable
            // (busy, or Python still loading — the page passes undefined
            // then). Returning false instead would hand Mod-Enter to
            // defaultKeymap's insertBlankLine, so pressing Run mid-run would
            // silently edit the code rather than doing nothing like the
            // disabled button.
            {
              key: chordBinding("run")!,
              run: () => {
                latest.current.onRun?.();
                return true;
              },
            },
            {
              key: chordBinding("submit")!,
              run: () => {
                latest.current.onSubmit?.();
                return true;
              },
            },
            {
              key: chordBinding("format")!,
              run: () => {
                latest.current.onFormat?.();
                return true;
              },
            },
          ]),
        ),
        // Ordered as CodeMirror's own basicSetup does. The completion commands
        // return false when no popup is open, so plain Enter still inserts a
        // newline; only the accept case takes it.
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...historyKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        EditorView.updateListener.of((u) => {
          if (u.docChanged) onDocChanged?.(u.state.doc.toString());
        }),
      ],
    });
    view.current = new EditorView({ state, parent: host.current! });
    return () => view.current?.destroy();
  }, []);

  useImperativeHandle(ref, () => ({
    getValue: () => view.current?.state.doc.toString() ?? "",
    setValue: (code: string) => {
      const v = view.current;
      if (!v) return;
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: code } });
    },
  }));

  return <div class="editor" ref={host} />;
});
