import { useState, useCallback, useRef, useEffect } from 'react';
import type { DragEvent } from 'react';
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
    ChevronsDownUp,
    EyeOff,
    CircleCheck,
    GripVertical,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getIconComponent } from '../IconPicker';
import type { CustomTransformation } from '../../types';

const FORMATTABLE_LANGUAGES = new Set([
    'json', 'xml', 'html', 'css', 'react', 'jsx', 'tsx',
    'javascript', 'typescript', 'sql', 'go', 'rust', 'java', 'php',
    'ruby', 'swift', 'kotlin', 'csharp', 'c', 'cpp',
]);

const VALIDATABLE_LANGUAGES = new Set([
    'json', 'xml', 'python', 'html', 'yaml',
]);

// Define all toolbar items
export interface ToolbarItem {
    id: string;
    type: 'button' | 'separator';
    title?: string;
    icon?: LucideIcon;
    action?: string; // For transform actions
    handler?: 'transform' | 'bulletList' | 'numberedList' | 'format' | 'minify' | 'validate' | 'maskSecrets';
    disabledWhen?: 'formatDisabled' | 'validateDisabled';
}

export const TOOLBAR_ITEMS: Record<string, ToolbarItem> = {
    'uppercase': { id: 'uppercase', type: 'button', title: 'UPPERCASE', icon: CaseUpper, action: 'uppercase', handler: 'transform' },
    'lowercase': { id: 'lowercase', type: 'button', title: 'lowercase', icon: CaseLower, action: 'lowercase', handler: 'transform' },
    'titlecase': { id: 'titlecase', type: 'button', title: 'Title Case', icon: ALargeSmall, action: 'titlecase', handler: 'transform' },
    'sentencecase': { id: 'sentencecase', type: 'button', title: 'Sentence case', icon: CaseSensitive, action: 'sentencecase', handler: 'transform' },
    'trim': { id: 'trim', type: 'button', title: 'Trim Whitespace', icon: Scissors, action: 'trim', handler: 'transform' },
    'sort': { id: 'sort', type: 'button', title: 'Sort Lines A→Z', icon: ArrowDownAZ, action: 'sort', handler: 'transform' },
    'deduplicate': { id: 'deduplicate', type: 'button', title: 'Remove Duplicate Lines', icon: ListX, action: 'deduplicate', handler: 'transform' },
    'reverse': { id: 'reverse', type: 'button', title: 'Reverse Lines', icon: ArrowUpDown, action: 'reverse', handler: 'transform' },
    'bulletList': { id: 'bulletList', type: 'button', title: 'Bulleted List', icon: List, handler: 'bulletList' },
    'numberedList': { id: 'numberedList', type: 'button', title: 'Numbered List', icon: ListOrdered, handler: 'numberedList' },
    'format': { id: 'format', type: 'button', title: 'Format Code', icon: Form, handler: 'format', disabledWhen: 'formatDisabled' },
    'minify': { id: 'minify', type: 'button', title: 'Minify Code', icon: ChevronsDownUp, handler: 'minify', disabledWhen: 'formatDisabled' },
    'validate': { id: 'validate', type: 'button', title: 'Validate', icon: CircleCheck, handler: 'validate', disabledWhen: 'validateDisabled' },
    'maskSecrets': { id: 'maskSecrets', type: 'button', title: 'Mask Secrets — redacts API keys, tokens, passwords, JWTs, connection strings, private keys, and hashes', icon: EyeOff, handler: 'maskSecrets' },
    'separator-1': { id: 'separator-1', type: 'separator' },
    'separator-2': { id: 'separator-2', type: 'separator' },
    'separator-3': { id: 'separator-3', type: 'separator' },
};

interface ToolbarProps {
    onTransform: (transform: string) => void;
    onBulletList: () => void;
    onNumberedList: () => void;
    onFormat: () => void;
    onMinify: () => void;
    onValidate: () => void;
    onMaskSecrets: () => void;
    language?: string;
    pinnedTransformations?: CustomTransformation[];
    onPinnedTransform?: (transformation: CustomTransformation) => void;
    toolbarOrder?: string[];
    onToolbarOrderChange?: (newOrder: string[]) => void;
}

type DropIndicator = {
    targetId: string;
    position: 'before' | 'after';
};

export function Toolbar({
    onTransform,
    onBulletList,
    onNumberedList,
    onFormat,
    onMinify,
    onValidate,
    onMaskSecrets,
    language,
    pinnedTransformations,
    onPinnedTransform,
    toolbarOrder,
    onToolbarOrderChange,
}: ToolbarProps) {
    const formatDisabled = !!language && language !== 'plaintext' && !FORMATTABLE_LANGUAGES.has(language);
    const validateDisabled = !language || !VALIDATABLE_LANGUAGES.has(language);

    const [draggedItem, setDraggedItem] = useState<string | null>(null);
    const [dragOverItem, setDragOverItem] = useState<string | null>(null);
    const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(null);
    const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());

    // Use provided order or default
    const order = toolbarOrder || Object.keys(TOOLBAR_ITEMS).filter(id => !id.startsWith('separator'));

    const handleClick = useCallback((item: ToolbarItem) => {
        if (!item.handler) return;

        switch (item.handler) {
            case 'transform':
                if (item.action) onTransform(item.action);
                break;
            case 'bulletList':
                onBulletList();
                break;
            case 'numberedList':
                onNumberedList();
                break;
            case 'format':
                onFormat();
                break;
            case 'minify':
                onMinify();
                break;
            case 'validate':
                onValidate();
                break;
            case 'maskSecrets':
                onMaskSecrets();
                break;
        }
    }, [onTransform, onBulletList, onNumberedList, onFormat, onMinify, onValidate, onMaskSecrets]);

    const isDisabled = useCallback((item: ToolbarItem) => {
        if (item.disabledWhen === 'formatDisabled') return formatDisabled;
        if (item.disabledWhen === 'validateDisabled') return validateDisabled;
        return false;
    }, [formatDisabled, validateDisabled]);

    const handleMouseDragStart = useCallback((e: React.MouseEvent, itemId: string) => {
        if (!onToolbarOrderChange) return;
        if (e.button !== 0) return; // Only left click
        e.preventDefault();
        setDraggedItem(itemId);
        setDragOverItem(null);
        setDropIndicator(null);
    }, [onToolbarOrderChange]);

    const handleDragReorder = useCallback((sourceId: string, targetId: string, position: 'before' | 'after') => {
        if (!onToolbarOrderChange || sourceId === targetId) return;

        const newOrder = order.filter((id) => id !== sourceId);
        const targetIndex = newOrder.indexOf(targetId);

        if (targetIndex === -1) return;

        const insertIndex = position === 'before' ? targetIndex : targetIndex + 1;
        newOrder.splice(insertIndex, 0, sourceId);

        onToolbarOrderChange(newOrder);
    }, [order, onToolbarOrderChange]);

    const preventNativeDrag = useCallback((e: DragEvent) => {
        e.preventDefault();
    }, []);

    useEffect(() => {
        if (!draggedItem) return;

        const handleMouseMove = (e: MouseEvent) => {
            let hoveredItem: string | null = null;
            const itemRects: { itemId: string; rect: DOMRect }[] = [];

            itemRefs.current.forEach((el, itemId) => {
                if (!el || itemId === draggedItem) return;

                const rect = el.getBoundingClientRect();
                itemRects.push({ itemId, rect });
                if (
                    e.clientX >= rect.left &&
                    e.clientX <= rect.right &&
                    e.clientY >= rect.top &&
                    e.clientY <= rect.bottom
                ) {
                    hoveredItem = itemId;
                    const midpoint = rect.left + rect.width / 2;
                    setDropIndicator({
                        targetId: itemId,
                        position: e.clientX < midpoint ? 'before' : 'after',
                    });
                }
            });

            setDragOverItem(hoveredItem);
            if (!hoveredItem) {
                if (itemRects.length === 0) {
                    setDropIndicator(null);
                    return;
                }

                // Allow dropping before the first item or after the last item.
                itemRects.sort((a, b) => a.rect.left - b.rect.left);
                const first = itemRects[0];
                const last = itemRects[itemRects.length - 1];
                const verticalInRange = e.clientY >= first.rect.top && e.clientY <= first.rect.bottom;

                if (!verticalInRange) {
                    setDropIndicator(null);
                    return;
                }

                if (e.clientX < first.rect.left) {
                    setDropIndicator({ targetId: first.itemId, position: 'before' });
                    setDragOverItem(first.itemId);
                    return;
                }

                if (e.clientX > last.rect.right) {
                    setDropIndicator({ targetId: last.itemId, position: 'after' });
                    setDragOverItem(last.itemId);
                    return;
                }

                setDropIndicator(null);
            }
        };

        const handleMouseUp = () => {
            if (draggedItem && dropIndicator) {
                handleDragReorder(draggedItem, dropIndicator.targetId, dropIndicator.position);
            }
            setDraggedItem(null);
            setDragOverItem(null);
            setDropIndicator(null);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [draggedItem, dropIndicator, handleDragReorder]);

    const setItemRef = useCallback((itemId: string, element: HTMLDivElement | null) => {
        if (element) {
            itemRefs.current.set(itemId, element);
        } else {
            itemRefs.current.delete(itemId);
        }
    }, []);

    return (
        <div className="border-b border-[var(--ui-border)] px-2 py-2 overflow-x-auto">
            <div className="flex items-center gap-0.5 min-w-max">
                {order.map((itemId) => {
                    const item = TOOLBAR_ITEMS[itemId];
                    if (!item) return null;

                    if (item.type === 'separator') {
                        const isDropTarget = dropIndicator?.targetId === itemId;
                        return (
                            <div
                                key={itemId}
                                ref={(el) => setItemRef(itemId, el)}
                                className={`relative w-px h-6 bg-[var(--ui-border)] mx-1 transition-all ${
                                    dragOverItem === itemId ? 'bg-[var(--ui-accent)] w-1' : ''
                                }`}
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleMouseDragStart(e, itemId);
                                }}
                                onDragStart={preventNativeDrag}
                                draggable={false}
                            >
                                {isDropTarget && (
                                    <div
                                        className={`pointer-events-none absolute top-0 bottom-0 w-0.5 bg-[var(--ui-accent)] ${
                                            dropIndicator.position === 'before' ? '-left-1' : '-right-1'
                                        }`}
                                    />
                                )}
                            </div>
                        );
                    }

                    const Icon = item.icon!;
                    const disabled = isDisabled(item);
                    const isDragging = draggedItem === itemId;
                    const isDragOver = dragOverItem === itemId;
                    const isDropTarget = dropIndicator?.targetId === itemId;

                    return (
                        <div
                            key={itemId}
                            ref={(el) => setItemRef(itemId, el)}
                            className={`relative group ${isDragOver ? 'ring-2 ring-[var(--ui-accent)] ring-offset-1 ring-offset-[var(--ui-bg)] rounded' : ''}`}
                        >
                            {isDropTarget && (
                                <div
                                    className={`pointer-events-none absolute top-0 bottom-0 w-0.5 bg-[var(--ui-accent)] z-10 ${
                                        dropIndicator.position === 'before' ? '-left-1' : '-right-1'
                                    }`}
                                />
                            )}
                            <button
                                onClick={() => !disabled && handleClick(item)}
                                title={item.title}
                                className={`toolbar-btn ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${isDragging ? 'opacity-50' : ''}`}
                                disabled={disabled}
                                onDragStart={preventNativeDrag}
                                draggable={false}
                            >
                                <Icon className="w-5 h-5" />
                            </button>
                            {/* Mouse-based drag handle for Tauri (avoids HTML5 DnD issues). */}
                            <button
                                type="button"
                                onMouseDown={(e) => {
                                    e.stopPropagation();
                                    handleMouseDragStart(e, itemId);
                                }}
                                className="toolbar-drag-handle absolute -left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-40 transition-opacity cursor-grab active:cursor-grabbing text-[var(--ui-text-muted)] hover:text-[var(--ui-text)]"
                                aria-label={`Reorder ${item.title}`}
                                title={`Reorder ${item.title}`}
                                onDragStart={preventNativeDrag}
                                draggable={false}
                            >
                                <GripVertical className="w-3 h-3" />
                            </button>
                        </div>
                    );
                })}

                {/* Pinned Custom Transformations */}
                {pinnedTransformations && pinnedTransformations.length > 0 && onPinnedTransform && (
                    <>
                        <div className="w-px h-6 bg-[var(--ui-border)] mx-1"/>
                        {pinnedTransformations.map((t) => {
                            const Icon = getIconComponent(t.icon || 'Wand2');
                            return (
                                <button
                                    key={t.id}
                                    onClick={() => onPinnedTransform(t)}
                                    title={t.name + (t.description ? ` — ${t.description}` : '')}
                                    className="toolbar-btn"
                                >
                                    <Icon className="w-5 h-5" />
                                </button>
                            );
                        })}
                    </>
                )}
            </div>
        </div>
    );
}
