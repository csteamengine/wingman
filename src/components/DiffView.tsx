import { useMemo, useRef, useEffect, memo } from 'react';
import { diffLines, diffWords } from 'diff';
import type { Change } from 'diff';

interface DiffViewProps {
  originalText: string;
  transformedText: string;
}

interface DiffLine {
  type: 'unchanged' | 'removed' | 'added';
  lineNumber: { left?: number; right?: number };
  content: string;
  wordChanges?: Change[];
}

function DiffViewComponent({ originalText, transformedText }: DiffViewProps) {
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  // Synchronized scrolling
  useEffect(() => {
    const leftPane = leftPaneRef.current;
    const rightPane = rightPaneRef.current;
    if (!leftPane || !rightPane) return;

    let isScrolling = false;

    const handleScroll = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (isScrolling) return;
      isScrolling = true;
      target.scrollTop = source.scrollTop;
      requestAnimationFrame(() => {
        isScrolling = false;
      });
    };

    const handleLeftScroll = () => handleScroll(leftPane, rightPane);
    const handleRightScroll = () => handleScroll(rightPane, leftPane);

    leftPane.addEventListener('scroll', handleLeftScroll);
    rightPane.addEventListener('scroll', handleRightScroll);

    return () => {
      leftPane.removeEventListener('scroll', handleLeftScroll);
      rightPane.removeEventListener('scroll', handleRightScroll);
    };
  }, []);

  // Calculate diff
  const { leftLines, rightLines } = useMemo(() => {
    const lineDiff = diffLines(originalText, transformedText);
    const left: DiffLine[] = [];
    const right: DiffLine[] = [];
    let leftLineNum = 1;
    let rightLineNum = 1;

    for (let i = 0; i < lineDiff.length; i++) {
      const change = lineDiff[i];
      const lines = change.value.split('\n');
      // Remove last empty element if the string ends with newline
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }

      if (change.added) {
        // Added lines - only appear on right side
        for (const line of lines) {
          // Check if there's a corresponding removed line to compute word diff
          let wordChanges: Change[] | undefined;
          const removedIdx = left.findIndex(
            (l, idx) => l.type === 'removed' && !right[idx]
          );
          if (removedIdx !== -1 && left[removedIdx]) {
            wordChanges = diffWords(left[removedIdx].content, line);
          }

          right.push({
            type: 'added',
            lineNumber: { right: rightLineNum++ },
            content: line,
            wordChanges,
          });
          // Add empty line on left to maintain alignment
          left.push({
            type: 'added',
            lineNumber: {},
            content: '',
          });
        }
      } else if (change.removed) {
        // Removed lines - only appear on left side
        for (const line of lines) {
          left.push({
            type: 'removed',
            lineNumber: { left: leftLineNum++ },
            content: line,
          });
          // Add empty line on right to maintain alignment
          right.push({
            type: 'removed',
            lineNumber: {},
            content: '',
          });
        }
      } else {
        // Unchanged lines - appear on both sides
        for (const line of lines) {
          left.push({
            type: 'unchanged',
            lineNumber: { left: leftLineNum++ },
            content: line,
          });
          right.push({
            type: 'unchanged',
            lineNumber: { right: rightLineNum++ },
            content: line,
          });
        }
      }
    }

    // Now compute word-level diffs for changed pairs
    // Match removed lines with added lines in sequence
    let removedQueue: number[] = [];
    let addedQueue: number[] = [];

    for (let i = 0; i < left.length; i++) {
      if (left[i].type === 'removed' && left[i].content) {
        removedQueue.push(i);
      } else if (right[i].type === 'added' && right[i].content) {
        addedQueue.push(i);
      } else {
        // Process queued pairs
        while (removedQueue.length > 0 && addedQueue.length > 0) {
          const removedIdx = removedQueue.shift()!;
          const addedIdx = addedQueue.shift()!;
          const wordDiff = diffWords(left[removedIdx].content, right[addedIdx].content);
          left[removedIdx].wordChanges = wordDiff;
          right[addedIdx].wordChanges = wordDiff;
        }
        // Clear remaining queues
        removedQueue = [];
        addedQueue = [];
      }
    }

    // Process any remaining pairs
    while (removedQueue.length > 0 && addedQueue.length > 0) {
      const removedIdx = removedQueue.shift()!;
      const addedIdx = addedQueue.shift()!;
      const wordDiff = diffWords(left[removedIdx].content, right[addedIdx].content);
      left[removedIdx].wordChanges = wordDiff;
      right[addedIdx].wordChanges = wordDiff;
    }

    return { leftLines: left, rightLines: right };
  }, [originalText, transformedText]);

  const renderLineContent = (line: DiffLine, side: 'left' | 'right') => {
    if (!line.wordChanges || line.type === 'unchanged') {
      return <span>{line.content || '\u00A0'}</span>;
    }

    return (
      <>
        {line.wordChanges.map((change, idx) => {
          if (change.added && side === 'left') return null;
          if (change.removed && side === 'right') return null;

          if (change.added) {
            return (
              <ins
                key={idx}
                className="diff-word-added no-underline"
                aria-label="Added text"
              >
                {change.value}
              </ins>
            );
          }
          if (change.removed) {
            return (
              <del
                key={idx}
                className="diff-word-removed"
                aria-label="Removed text"
              >
                {change.value}
              </del>
            );
          }
          return <span key={idx}>{change.value}</span>;
        })}
        {line.content === '' && '\u00A0'}
      </>
    );
  };

  const renderLine = (line: DiffLine, index: number, side: 'left' | 'right') => {
    const isRemoved = side === 'left' && line.type === 'removed' && line.content;
    const isAdded = side === 'right' && line.type === 'added' && line.content;
    const isEmpty = (side === 'left' && line.type === 'added') || (side === 'right' && line.type === 'removed');

    let lineClass = 'diff-line';
    if (isRemoved) lineClass += ' diff-line-removed';
    if (isAdded) lineClass += ' diff-line-added';
    if (isEmpty) lineClass += ' diff-line-empty';

    const lineNum = side === 'left' ? line.lineNumber.left : line.lineNumber.right;

    return (
      <div
        key={index}
        className={lineClass}
        role="row"
        aria-label={isRemoved ? 'Removed line' : isAdded ? 'Added line' : undefined}
      >
        <span className="diff-line-number" role="cell">
          {lineNum || ''}
        </span>
        <span className="diff-line-content" role="cell">
          {isEmpty ? '\u00A0' : renderLineContent(line, side)}
        </span>
      </div>
    );
  };

  return (
    <div className="diff-view" role="table" aria-label="Diff comparison">
      <div className="diff-panes">
        {/* Left pane - Original */}
        <div className="diff-pane diff-pane-left">
          <div className="diff-pane-header">
            <span className="diff-pane-title">Original</span>
          </div>
          <div
            ref={leftPaneRef}
            className="diff-pane-content"
            role="rowgroup"
            tabIndex={0}
          >
            {leftLines.map((line, idx) => renderLine(line, idx, 'left'))}
          </div>
        </div>

        {/* Right pane - Transformed */}
        <div className="diff-pane diff-pane-right">
          <div className="diff-pane-header">
            <span className="diff-pane-title">Transformed</span>
          </div>
          <div
            ref={rightPaneRef}
            className="diff-pane-content"
            role="rowgroup"
            tabIndex={0}
          >
            {rightLines.map((line, idx) => renderLine(line, idx, 'right'))}
          </div>
        </div>
      </div>
    </div>
  );
}

export const DiffView = memo(DiffViewComponent);
