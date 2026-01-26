import {
    CaseUpper,
    CaseLower,
    ALargeSmall,
    CaseSensitive,
    Scissors,
    ArrowDownAZ,
    ListX,
    ArrowUpDown,
    List,
    ListOrdered,
    Form,
    ChevronsDownUp
} from 'lucide-react';

interface ToolbarProps {
    onTransform: (transform: string) => void;
    onBulletList: () => void;
    onNumberedList: () => void;
    onFormat: () => void;
    onMinify: () => void;
}

export function Toolbar({ onTransform, onBulletList, onNumberedList, onFormat, onMinify }: ToolbarProps) {
    return (
        <div className="border-b border-[var(--ui-border)] px-2 py-2 overflow-x-auto">
            <div className="flex items-center gap-0.5 min-w-max">
                {/* Text Case Group */}
                <button onClick={() => onTransform('uppercase')} title="UPPERCASE" className="toolbar-btn">
                    <CaseUpper className="w-5 h-5" />
                </button>
                <button onClick={() => onTransform('lowercase')} title="lowercase" className="toolbar-btn">
                    <CaseLower className="w-5 h-5" />
                </button>
                <button onClick={() => onTransform('titlecase')} title="Title Case" className="toolbar-btn">
                    <ALargeSmall className="w-5 h-5" />
                </button>
                <button onClick={() => onTransform('sentencecase')} title="Sentence case" className="toolbar-btn">
                    <CaseSensitive className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>

                {/* Text Formatting Group */}
                <button onClick={() => onTransform('trim')} title="Trim Whitespace" className="toolbar-btn">
                    <Scissors className="w-5 h-5" />
                </button>
                <button onClick={() => onTransform('sort')} title="Sort Lines A→Z" className="toolbar-btn">
                    <ArrowDownAZ className="w-5 h-5" />
                </button>
                <button onClick={() => onTransform('deduplicate')} title="Remove Duplicate Lines" className="toolbar-btn">
                    <ListX className="w-5 h-5" />
                </button>
                <button onClick={() => onTransform('reverse')} title="Reverse Lines" className="toolbar-btn">
                    <ArrowUpDown className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>

                {/* Lists Group */}
                <button onClick={onBulletList} title="Bulleted List" className="toolbar-btn">
                    <List className="w-5 h-5" />
                </button>
                <button onClick={onNumberedList} title="Numbered List" className="toolbar-btn">
                    <ListOrdered className="w-5 h-5" />
                </button>
                <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>

                {/* Format & Minify Group */}
                <button onClick={onFormat} title="Format Code" className="toolbar-btn">
                    <Form className="w-5 h-5" />
                </button>
                <button onClick={onMinify} title="Minify Code" className="toolbar-btn">
                    <ChevronsDownUp className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
