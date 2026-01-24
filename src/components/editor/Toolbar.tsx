interface ToolbarProps {
    onTransform: (transform: string) => void;
    onBulletList: () => void;
    onNumberedList: () => void;
}

export function Toolbar({ onTransform, onBulletList, onNumberedList }: ToolbarProps) {
    return (
        <div className="border-b border-[var(--ui-border)] px-2 py-2 overflow-x-auto">
            <div className="flex items-center gap-0.5 min-w-max">
                {/* Text Case Group */}
                <button onClick={() => onTransform('uppercase')} title="UPPERCASE" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 18l4-12h2l4 12"/>
                        <path d="M5 14h6"/>
                        <path d="M18 4v8"/>
                        <path d="M15 7l3-3 3 3"/>
                    </svg>
                </button>
                <button onClick={() => onTransform('lowercase')} title="lowercase" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="7" cy="14" r="4"/>
                        <path d="M11 10v8"/>
                        <path d="M18 12v8"/>
                        <path d="M15 17l3 3 3-3"/>
                    </svg>
                </button>
                <button onClick={() => onTransform('titlecase')} title="Title Case" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 6h14"/>
                        <path d="M12 6v10"/>
                        <path d="M7 20h10"/>
                    </svg>
                </button>
                <button onClick={() => onTransform('sentencecase')} title="Sentence case" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 18l5-14h2l5 14"/>
                        <path d="M7 13h8"/>
                        <circle cx="20" cy="17" r="1.5" fill="currentColor"/>
                    </svg>
                </button>
                <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>

                {/* Text Formatting Group */}
                <button onClick={() => onTransform('trim')} title="Trim Whitespace" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="6" cy="6" r="3"/>
                        <circle cx="6" cy="18" r="3"/>
                        <path d="M8.12 8.12L12 12"/>
                        <path d="M20 4L8.12 15.88"/>
                        <path d="M14.47 14.48L20 20"/>
                        <path d="M8.12 8.12L12 12"/>
                    </svg>
                </button>
                <button onClick={() => onTransform('sort')} title="Sort Lines A→Z" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 6h4"/>
                        <path d="M4 12h7"/>
                        <path d="M4 18h11"/>
                        <path d="M18 6v12"/>
                        <path d="M15 15l3 3 3-3"/>
                    </svg>
                </button>
                <button onClick={() => onTransform('deduplicate')} title="Remove Duplicate Lines" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 8h16"/>
                        <path d="M4 14h16"/>
                        <path d="M3 18l18-12"/>
                    </svg>
                </button>
                <button onClick={() => onTransform('reverse')} title="Reverse Lines" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M8 3l4 4-4 4"/>
                        <path d="M4 7h12"/>
                        <path d="M16 21l-4-4 4-4"/>
                        <path d="M20 17H8"/>
                    </svg>
                </button>
                <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>

                {/* Lists Group */}
                <button onClick={onBulletList} title="Bulleted List" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"/>
                        <line x1="8" y1="12" x2="21" y2="12"/>
                        <line x1="8" y1="18" x2="21" y2="18"/>
                        <line x1="3" y1="6" x2="3.01" y2="6"/>
                        <line x1="3" y1="12" x2="3.01" y2="12"/>
                        <line x1="3" y1="18" x2="3.01" y2="18"/>
                    </svg>
                </button>
                <button onClick={onNumberedList} title="Numbered List" className="toolbar-btn">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="10" y1="6" x2="21" y2="6"/>
                        <line x1="10" y1="12" x2="21" y2="12"/>
                        <line x1="10" y1="18" x2="21" y2="18"/>
                        <path d="M4 6h1v4"/>
                        <path d="M4 10h2"/>
                        <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/>
                    </svg>
                </button>
            </div>
        </div>
    );
}
