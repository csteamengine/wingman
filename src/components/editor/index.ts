// Language configuration
export { languages, LANGUAGE_OPTIONS } from './languageConfig';
export type { LanguageOption } from './languageConfig';

// Linters
export { jsonLinter, xmlLinter, pythonLinter, htmlLinter, yamlLinter } from './linters';

// Markdown extensions
export {
    markdownPlugin,
    markdownTheme,
    codeBlockTheme,
    markdownLinkPasteHandler,
    clipboardDropHandler,
    isUrl,
} from './markdownExtensions';

// Editor keymap
export { editorKeymap, wrapSelection } from './editorKeymap';

// UI Components
export { StatusBar } from './StatusBar';
export { ActionButtons } from './ActionButtons';
export { AttachmentsBar } from './AttachmentsBar';
export { FloatingNotifications } from './FloatingNotifications';
export type { ValidationToast } from './FloatingNotifications';
export { Toolbar } from './Toolbar';
export { FileDragOverlay, ClipboardDragIndicator, AILoadingOverlay } from './DragOverlays';
