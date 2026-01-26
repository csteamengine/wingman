import { useRef, useEffect, memo } from 'react';
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { MergeView } from '@codemirror/merge';
import { oneDark } from '@codemirror/theme-one-dark';

// Colorblind-friendly theme for diff view
const colorblindDiffTheme = EditorView.theme({
  '.cm-deletedChunk': {
    backgroundColor: 'rgba(251, 146, 60, 0.15) !important',
  },
  '.cm-insertedChunk': {
    backgroundColor: 'rgba(59, 130, 246, 0.15) !important',
  },
  '.cm-deletedText': {
    backgroundColor: 'rgba(251, 146, 60, 0.3) !important',
    textDecoration: 'line-through !important',
    textDecorationColor: 'rgba(251, 146, 60, 0.6) !important',
  },
  '.cm-insertedText': {
    backgroundColor: 'rgba(59, 130, 246, 0.3) !important',
    textDecoration: 'underline !important',
    textDecorationColor: 'rgba(59, 130, 246, 0.6) !important',
  },
  '.cm-merge-a .cm-changedLine': {
    backgroundColor: 'rgba(251, 146, 60, 0.1) !important',
  },
  '.cm-merge-b .cm-changedLine': {
    backgroundColor: 'rgba(59, 130, 246, 0.1) !important',
  },
  '.cm-merge-a .cm-changedText': {
    textDecoration: 'underline !important',
    textDecorationColor: 'rgba(251, 146, 60, 0.6) !important',
  },
  '.cm-merge-b .cm-changedText': {
    textDecoration: 'underline !important',
    textDecorationColor: 'rgba(59, 130, 246, 0.6) !important',
  },
});

interface DiffViewProps {
  originalText: string;
  transformedText: string;
  colorblindMode?: boolean;
}

function DiffViewComponent({ originalText, transformedText, colorblindMode = false }: DiffViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mergeViewRef = useRef<MergeView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any existing merge view
    if (mergeViewRef.current) {
      mergeViewRef.current.destroy();
    }

    // Base extensions for both editors
    const baseExtensions = [
      lineNumbers(),
      highlightActiveLine(),
      syntaxHighlighting(defaultHighlightStyle),
      oneDark,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true),
    ];

    // Add colorblind theme if enabled
    const extensions = colorblindMode
      ? [...baseExtensions, colorblindDiffTheme]
      : baseExtensions;

    // Create the merge view
    const mergeView = new MergeView({
      a: {
        doc: originalText,
        extensions,
      },
      b: {
        doc: transformedText,
        extensions,
      },
      parent: containerRef.current,
      orientation: 'a-b',
      revertControls: 'b-to-a',
      highlightChanges: true,
      gutter: true,
    });

    mergeViewRef.current = mergeView;

    // Cleanup on unmount
    return () => {
      if (mergeViewRef.current) {
        mergeViewRef.current.destroy();
        mergeViewRef.current = null;
      }
    };
  }, [originalText, transformedText, colorblindMode]);

  return (
    <div className="diff-view-codemirror">
      <div className="diff-panes-header">
        <div className="diff-pane-header">
          <span className="diff-pane-title">Original</span>
        </div>
        <div className="diff-pane-header">
          <span className="diff-pane-title">Transformed</span>
        </div>
      </div>
      <div ref={containerRef} className="diff-container" />
    </div>
  );
}

export const DiffView = memo(DiffViewComponent);
