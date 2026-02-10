import { useRef, useEffect } from "react";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { oneDark } from "@codemirror/theme-one-dark";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: "markdown" | "json" | "text";
  readOnly?: boolean;
  className?: string;
  minHeight?: string;
}

const appTheme = EditorView.theme({
  "&": {
    backgroundColor: "rgb(15 23 42)", // slate-900
    fontSize: "13px",
  },
  ".cm-gutters": {
    backgroundColor: "rgb(30 41 59)", // slate-800
    borderRight: "1px solid rgb(51 65 85)", // slate-700
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgb(51 65 85)", // slate-700
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(51, 65, 85, 0.4)",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-scroller": {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  },
});

function languageExtension(lang?: "markdown" | "json" | "text") {
  if (lang === "json") return json();
  if (lang === "markdown") return markdown();
  return [];
}

export function languageFromFilename(name: string): "markdown" | "json" | "text" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".json") || lower.endsWith(".json5")) return "json";
  return "text";
}

export function CodeEditor({
  value,
  onChange,
  language = "text",
  readOnly = false,
  className = "",
  minHeight = "200px",
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const readOnlyComp = useRef(new Compartment());
  const languageComp = useRef(new Compartment());
  const isInternalChange = useRef(false);

  // Guard: ensure value is always a string for CodeMirror
  const safeValue = typeof value === "string" ? value : String(value ?? "");

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChange) {
        isInternalChange.current = true;
        onChange(update.state.doc.toString());
      }
    });

    const minHeightTheme = EditorView.theme({
      ".cm-editor": { minHeight },
      ".cm-scroller": { minHeight },
    });

    const state = EditorState.create({
      doc: safeValue,
      extensions: [
        basicSetup,
        keymap.of([indentWithTab]),
        oneDark,
        appTheme,
        minHeightTheme,
        readOnlyComp.current.of(EditorState.readOnly.of(readOnly)),
        languageComp.current.of(languageExtension(language)),
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount/unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync readOnly
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyComp.current.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }, [readOnly]);

  // Sync language
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: languageComp.current.reconfigure(languageExtension(language)),
    });
  }, [language]);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    if (isInternalChange.current) {
      isInternalChange.current = false;
      return;
    }

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== safeValue) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: safeValue,
        },
      });
    }
  }, [safeValue]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto rounded-md border border-slate-700 ${className}`}
    />
  );
}
