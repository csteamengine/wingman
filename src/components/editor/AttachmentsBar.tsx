import type {EditorImage} from '../../stores/editorStore';

interface AttachmentsBarProps {
    images: EditorImage[];
    removeImage: (id: number) => void;
    hasContent: boolean;
}

export function AttachmentsBar({images, removeImage, hasContent}: AttachmentsBarProps) {
    if (images.length === 0) return null;

    return (
        <div className="px-4 py-2 border-t border-[var(--ui-border)]">
            <div className="flex gap-2 flex-wrap">
                {images.map((attachment) => (
                    <div
                        key={attachment.id}
                        className="relative w-16 h-16 rounded-md overflow-hidden bg-[var(--ui-surface)] border border-[var(--ui-border)] group cursor-default"
                    >
                        {attachment.type === 'image' ? (
                            <img
                                src={attachment.data}
                                alt={attachment.name || `Attachment ${attachment.id}`}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div
                                className="w-full h-full flex items-center justify-center"
                                title={attachment.name || 'File attachment'}
                            >
                                {attachment.type === 'text' ? (
                                    // Text file icon
                                    <svg className="w-5 h-5 text-[var(--ui-text-muted)]" fill="none"
                                         stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                                    </svg>
                                ) : (
                                    // Generic file icon
                                    <svg className="w-5 h-5 text-[var(--ui-text-muted)]" fill="none"
                                         stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
                                    </svg>
                                )}
                            </div>
                        )}
                        <button
                            onClick={() => removeImage(attachment.id)}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                            title="Remove"
                        >
                            ×
                        </button>
                        <span
                            className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 truncate">
                            #{attachment.id}
                        </span>
                    </div>
                ))}
            </div>
            {/* Info notice when both text and files present */}
            {hasContent && (
                <div
                    className="mt-2 flex items-start gap-1.5 text-[10px] text-[var(--ui-text-muted)] opacity-70">
                    <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor"
                         viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold">
                        Most apps will paste either files or text, not both. Try Ctrl+V for files, Cmd+V for text.
                    </span>
                </div>
            )}
        </div>
    );
}
