import type { EditorView } from '@codemirror/view';

interface FileDragOverlayProps {
    isDragging: boolean;
}

export function FileDragOverlay({ isDragging }: FileDragOverlayProps) {
    if (!isDragging) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--ui-surface)]/90 border-2 border-dashed border-[var(--ui-accent)] rounded-lg">
            <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-2 text-[var(--ui-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <p className="text-sm text-[var(--ui-text)]">Drop to insert</p>
            </div>
        </div>
    );
}

interface ClipboardDragIndicatorProps {
    isDraggingClipboardItem: boolean;
    hasClipboardDragDrop: boolean;
    cursorPosition: { x: number; y: number } | null;
    editorInsertPosition: number | null;
    editorContainerRef: React.RefObject<HTMLDivElement>;
    viewRef: React.RefObject<EditorView | null>;
}

export function ClipboardDragIndicator({
    isDraggingClipboardItem,
    hasClipboardDragDrop,
    cursorPosition,
    editorInsertPosition,
    editorContainerRef,
    viewRef,
}: ClipboardDragIndicatorProps) {
    if (!isDraggingClipboardItem || !hasClipboardDragDrop || !cursorPosition) return null;

    return (
        <>
            {/* Floating drag badge */}
            <div
                className="fixed z-[100] pointer-events-none"
                style={{
                    left: cursorPosition.x + 16,
                    top: cursorPosition.y + 16,
                }}
            >
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--ui-accent)] text-white text-xs font-medium shadow-lg">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                    </svg>
                    <span>+</span>
                </div>
            </div>
            {/* Insert cursor line - snapped to actual character position */}
            {editorContainerRef.current && viewRef.current && editorInsertPosition !== null && (() => {
                const rect = editorContainerRef.current!.getBoundingClientRect();
                const isOverEditor = (
                    cursorPosition.x >= rect.left &&
                    cursorPosition.x <= rect.right &&
                    cursorPosition.y >= rect.top &&
                    cursorPosition.y <= rect.bottom
                );
                if (!isOverEditor) return null;

                // Get the actual pixel coordinates of the character position
                const coords = viewRef.current!.coordsAtPos(editorInsertPosition);
                if (!coords) return null;

                // Get the line height for proper cursor sizing
                const lineHeight = viewRef.current!.defaultLineHeight;

                return (
                    <div
                        className="fixed z-[100] pointer-events-none"
                        style={{
                            left: coords.left,
                            top: coords.top,
                        }}
                    >
                        <div
                            className="bg-[var(--ui-accent)] animate-pulse"
                            style={{
                                width: '2px',
                                height: `${lineHeight}px`,
                            }}
                        />
                    </div>
                );
            })()}
        </>
    );
}

interface AILoadingOverlayProps {
    isLoading: boolean;
}

export function AILoadingOverlay({ isLoading }: AILoadingOverlayProps) {
    if (!isLoading) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--ui-surface)]/95 backdrop-blur-sm rounded-lg">
            <div className="text-center">
                <svg className="w-10 h-10 mx-auto mb-3 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                </svg>
                <p className="text-sm font-medium text-purple-300">Refining with AI...</p>
                <p className="text-xs text-[var(--ui-text-muted)] mt-1">This may take a moment</p>
            </div>
        </div>
    );
}
