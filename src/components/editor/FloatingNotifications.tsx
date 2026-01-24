import type {ObsidianResult} from '../../types';

interface FloatingNotificationsProps {
    // URL Parser state
    parsedUrlInfo: {url: string; cursorPos: number} | null;
    onParseUrl: () => void;
    onDismissUrlParser: () => void;

    // Obsidian toast state
    obsidianToast: ObsidianResult | null;
    onToastClick: () => void;
}

export function FloatingNotifications({
    parsedUrlInfo,
    onParseUrl,
    onDismissUrlParser,
    obsidianToast,
    onToastClick,
}: FloatingNotificationsProps) {
    return (
        <>
            {/* URL Parser Floating Button */}
            {parsedUrlInfo && (
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
                    <button
                        onClick={onParseUrl}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/95 rounded-lg shadow-lg border border-blue-500/50 hover:bg-blue-600 transition-colors text-white"
                    >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        <span className="text-sm font-medium">Parse URL</span>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDismissUrlParser();
                            }}
                            className="ml-1 w-5 h-5 flex items-center justify-center rounded-full hover:bg-white/20 transition-colors"
                        >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </button>
                </div>
            )}

            {/* Obsidian Toast Notification */}
            {obsidianToast && (
                <div
                    onClick={onToastClick}
                    className="absolute bottom-20 left-1/2 -translate-x-1/2 z-50 cursor-pointer animate-slide-up"
                >
                    <div className="flex items-center gap-3 px-4 py-3 bg-violet-600/95 rounded-lg shadow-lg border border-violet-500/50 hover:bg-violet-600 transition-colors">
                        <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                        </svg>
                        <div className="text-white">
                            <p className="text-sm font-medium">Saved to Obsidian</p>
                            <p className="text-xs opacity-80">Click to open "{obsidianToast.note_name}"</p>
                        </div>
                        <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                        </svg>
                    </div>
                </div>
            )}
        </>
    );
}
