import { useState, useCallback, useRef } from 'react';
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
    const dragCounter = useRef(0);

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

    const handleDragStart = useCallback((e: React.DragEvent, itemId: string) => {
        setDraggedItem(itemId);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', itemId);
        // Add a slight delay to allow the drag image to be set
        setTimeout(() => {
            (e.target as HTMLElement).style.opacity = '0.5';
        }, 0);
    }, []);

    const handleDragEnd = useCallback((e: React.DragEvent) => {
        (e.target as HTMLElement).style.opacity = '1';
        setDraggedItem(null);
        setDragOverItem(null);
        dragCounter.current = 0;
    }, []);

    const handleDragEnter = useCallback((e: React.DragEvent, itemId: string) => {
        e.preventDefault();
        dragCounter.current++;
        if (draggedItem && draggedItem !== itemId) {
            setDragOverItem(itemId);
        }
    }, [draggedItem]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            setDragOverItem(null);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }, []);

    const handleDrop = useCallback((e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        dragCounter.current = 0;

        if (!draggedItem || draggedItem === targetId || !onToolbarOrderChange) {
            setDraggedItem(null);
            setDragOverItem(null);
            return;
        }

        const newOrder = [...order];
        const draggedIndex = newOrder.indexOf(draggedItem);
        const targetIndex = newOrder.indexOf(targetId);

        if (draggedIndex === -1 || targetIndex === -1) {
            setDraggedItem(null);
            setDragOverItem(null);
            return;
        }

        // Remove dragged item and insert at new position
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedItem);

        onToolbarOrderChange(newOrder);
        setDraggedItem(null);
        setDragOverItem(null);
    }, [draggedItem, order, onToolbarOrderChange]);

    return (
        <div className="border-b border-[var(--ui-border)] px-2 py-2 overflow-x-auto">
            <div className="flex items-center gap-0.5 min-w-max">
                {order.map((itemId) => {
                    const item = TOOLBAR_ITEMS[itemId];
                    if (!item) return null;

                    if (item.type === 'separator') {
                        return (
                            <div
                                key={itemId}
                                className={`w-px h-6 bg-[var(--ui-border)] mx-1 transition-all ${
                                    dragOverItem === itemId ? 'bg-[var(--ui-accent)] w-1' : ''
                                }`}
                                draggable
                                onDragStart={(e) => handleDragStart(e, itemId)}
                                onDragEnd={handleDragEnd}
                                onDragEnter={(e) => handleDragEnter(e, itemId)}
                                onDragLeave={handleDragLeave}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, itemId)}
                            />
                        );
                    }

                    const Icon = item.icon!;
                    const disabled = isDisabled(item);
                    const isDragging = draggedItem === itemId;
                    const isDragOver = dragOverItem === itemId;

                    return (
                        <div
                            key={itemId}
                            className={`relative group ${isDragOver ? 'ring-2 ring-[var(--ui-accent)] ring-offset-1 ring-offset-[var(--ui-bg)] rounded' : ''}`}
                            draggable
                            onDragStart={(e) => handleDragStart(e, itemId)}
                            onDragEnd={handleDragEnd}
                            onDragEnter={(e) => handleDragEnter(e, itemId)}
                            onDragLeave={handleDragLeave}
                            onDragOver={handleDragOver}
                            onDrop={(e) => handleDrop(e, itemId)}
                        >
                            <button
                                onClick={() => !disabled && handleClick(item)}
                                title={item.title}
                                className={`toolbar-btn ${disabled ? 'opacity-40 cursor-not-allowed' : ''} ${isDragging ? 'opacity-50' : ''}`}
                                disabled={disabled}
                            >
                                <Icon className="w-5 h-5" />
                            </button>
                            {/* Drag handle indicator on hover */}
                            <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-30 pointer-events-none transition-opacity">
                                <GripVertical className="w-3 h-3" />
                            </div>
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
