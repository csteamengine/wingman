import { useRef, useEffect, memo } from 'react';
import { EditorView, lineNumbers, highlightActiveLine } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language';
import { MergeView } from '@codemirror/merge';
import { oneDark } from '@codemirror/theme-one-dark';

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

    // Create the merge view
    const mergeView = new MergeView({
      a: {
        doc: originalText,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          syntaxHighlighting(defaultHighlightStyle),
          oneDark,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
      },
      b: {
        doc: transformedText,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          syntaxHighlighting(defaultHighlightStyle),
          oneDark,
          EditorView.editable.of(false),
          EditorState.readOnly.of(true),
        ],
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
  }, [originalText, transformedText]);

  return (
    <div className={`diff-view-codemirror ${colorblindMode ? 'colorblind-mode' : ''}`}>
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
