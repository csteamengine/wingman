/**
 * Custom CodeMirror search panel with case-preserving replace functionality.
 * Replicates default search panel behavior while adding a "Preserve Case" checkbox.
 */

import {
    EditorView,
    runScopeHandlers,
} from '@codemirror/view';
import type {Panel} from '@codemirror/view';
import {
    EditorState,
    StateField,
    StateEffect,
} from '@codemirror/state';
import {
    SearchQuery,
    setSearchQuery,
    findNext,
    findPrevious,
    replaceNext as defaultReplaceNext,
    replaceAll as defaultReplaceAll,
    closeSearchPanel,
    getSearchQuery,
    search,
} from '@codemirror/search';
import {preserveCase} from './casePreservation';

// State effect to toggle preserve case
const setPreserveCase = StateEffect.define<boolean>();

// State field to track preserve case checkbox state
const preserveCaseState = StateField.define<boolean>({
    create() {
        return false;
    },
    update(value, tr) {
        for (const effect of tr.effects) {
            if (effect.is(setPreserveCase)) {
                return effect.value;
            }
        }
        return value;
    },
});

// Helper to get the preserve case state
function getPreserveCaseState(state: EditorState): boolean {
    return state.field(preserveCaseState, false) || false;
}

/**
 * Creates the custom search panel with preserve case option.
 */
function createSearchPanel(view: EditorView): Panel {
    const dom = document.createElement('div');
    dom.className = 'cm-search';

    // Create search row
    const searchRow = document.createElement('div');
    searchRow.className = 'cm-search-row';
    searchRow.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 8px; flex-wrap: wrap;';

    // Search input
    const searchInput = document.createElement('input');
    searchInput.className = 'cm-textfield';
    searchInput.name = 'search';
    searchInput.placeholder = 'Search';
    searchInput.setAttribute('main-field', 'true');
    searchInput.style.cssText = 'flex: 1; min-width: 150px;';
    searchInput.autocomplete = 'off';
    searchInput.autocapitalize = 'off';
    searchInput.spellcheck = false;

    // Case sensitive checkbox
    const caseSensitiveLabel = document.createElement('label');
    caseSensitiveLabel.className = 'cm-search-option';
    caseSensitiveLabel.style.cssText = 'display: inline-flex; align-items: center; gap: 2px; font-size: 12px; cursor: pointer;';
    const caseSensitiveCheckbox = document.createElement('input');
    caseSensitiveCheckbox.type = 'checkbox';
    caseSensitiveCheckbox.name = 'case';
    caseSensitiveCheckbox.tabIndex = -1; // Skip in tab order
    caseSensitiveLabel.appendChild(caseSensitiveCheckbox);
    caseSensitiveLabel.appendChild(document.createTextNode('Aa'));
    caseSensitiveLabel.title = 'Case sensitive';

    // Regex checkbox
    const regexLabel = document.createElement('label');
    regexLabel.className = 'cm-search-option';
    regexLabel.style.cssText = 'display: inline-flex; align-items: center; gap: 2px; font-size: 12px; cursor: pointer;';
    const regexCheckbox = document.createElement('input');
    regexCheckbox.type = 'checkbox';
    regexCheckbox.name = 'regexp';
    regexCheckbox.tabIndex = -1; // Skip in tab order
    regexLabel.appendChild(regexCheckbox);
    regexLabel.appendChild(document.createTextNode('.*'));
    regexLabel.title = 'Regular expression';

    // Whole word checkbox
    const wholeWordLabel = document.createElement('label');
    wholeWordLabel.className = 'cm-search-option';
    wholeWordLabel.style.cssText = 'display: inline-flex; align-items: center; gap: 2px; font-size: 12px; cursor: pointer;';
    const wholeWordCheckbox = document.createElement('input');
    wholeWordCheckbox.type = 'checkbox';
    wholeWordCheckbox.name = 'word';
    wholeWordCheckbox.tabIndex = -1; // Skip in tab order
    wholeWordLabel.appendChild(wholeWordCheckbox);
    wholeWordLabel.appendChild(document.createTextNode('W'));
    wholeWordLabel.title = 'Whole word';

    // Navigation buttons
    const prevButton = document.createElement('button');
    prevButton.className = 'cm-button';
    prevButton.textContent = '< Prev';
    prevButton.type = 'button';
    prevButton.tabIndex = -1; // Skip in tab order

    const nextButton = document.createElement('button');
    nextButton.className = 'cm-button';
    nextButton.textContent = 'Next >';
    nextButton.type = 'button';
    nextButton.tabIndex = -1; // Skip in tab order

    // Close button
    const closeButton = document.createElement('button');
    closeButton.className = 'cm-button';
    closeButton.name = 'close';
    closeButton.textContent = '×';
    closeButton.type = 'button';
    closeButton.title = 'Close search';
    closeButton.style.cssText = 'margin-left: auto;';
    closeButton.tabIndex = -1; // Skip in tab order

    // Assemble search row
    searchRow.appendChild(searchInput);
    searchRow.appendChild(caseSensitiveLabel);
    searchRow.appendChild(regexLabel);
    searchRow.appendChild(wholeWordLabel);
    searchRow.appendChild(prevButton);
    searchRow.appendChild(nextButton);
    searchRow.appendChild(closeButton);

    // Create replace row
    const replaceRow = document.createElement('div');
    replaceRow.className = 'cm-search-row';
    replaceRow.style.cssText = 'display: flex; align-items: center; gap: 4px; padding: 4px 8px; flex-wrap: wrap;';

    // Replace input
    const replaceInput = document.createElement('input');
    replaceInput.className = 'cm-textfield';
    replaceInput.name = 'replace';
    replaceInput.placeholder = 'Replace';
    replaceInput.style.cssText = 'flex: 1; min-width: 150px;';
    replaceInput.autocomplete = 'off';
    replaceInput.autocapitalize = 'off';
    replaceInput.spellcheck = false;

    // Replace button
    const replaceButton = document.createElement('button');
    replaceButton.className = 'cm-button';
    replaceButton.textContent = 'Replace';
    replaceButton.type = 'button';
    replaceButton.tabIndex = -1; // Skip in tab order

    // Replace all button
    const replaceAllButton = document.createElement('button');
    replaceAllButton.className = 'cm-button';
    replaceAllButton.textContent = 'All';
    replaceAllButton.type = 'button';
    replaceAllButton.tabIndex = -1; // Skip in tab order

    // Preserve case checkbox
    const preserveCaseLabel = document.createElement('label');
    preserveCaseLabel.className = 'cm-search-preserve-case';
    preserveCaseLabel.style.cssText = 'display: inline-flex; align-items: center; gap: 4px; font-size: 12px; cursor: pointer; margin-left: 8px;';
    const preserveCaseCheckbox = document.createElement('input');
    preserveCaseCheckbox.type = 'checkbox';
    preserveCaseCheckbox.name = 'preserve-case';
    preserveCaseCheckbox.tabIndex = -1; // Skip in tab order
    preserveCaseLabel.appendChild(preserveCaseCheckbox);
    preserveCaseLabel.appendChild(document.createTextNode('Preserve Case'));
    preserveCaseLabel.title = 'Preserve the case pattern of matched text when replacing';

    // Assemble replace row
    replaceRow.appendChild(replaceInput);
    replaceRow.appendChild(replaceButton);
    replaceRow.appendChild(replaceAllButton);
    replaceRow.appendChild(preserveCaseLabel);

    // Assemble panel
    dom.appendChild(searchRow);
    dom.appendChild(replaceRow);

    // Initialize from current search query
    const currentQuery = getSearchQuery(view.state);
    if (currentQuery.search) {
        searchInput.value = currentQuery.search;
        caseSensitiveCheckbox.checked = currentQuery.caseSensitive;
        regexCheckbox.checked = currentQuery.regexp;
        wholeWordCheckbox.checked = currentQuery.wholeWord;
        replaceInput.value = currentQuery.replace;
    }

    // Initialize preserve case from state
    preserveCaseCheckbox.checked = getPreserveCaseState(view.state);

    // Helper to build and set search query
    function updateQuery() {
        const query = new SearchQuery({
            search: searchInput.value,
            replace: replaceInput.value,
            caseSensitive: caseSensitiveCheckbox.checked,
            regexp: regexCheckbox.checked,
            wholeWord: wholeWordCheckbox.checked,
        });
        view.dispatch({effects: setSearchQuery.of(query)});
    }

    // Event handlers
    searchInput.addEventListener('input', updateQuery);
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            findNext(view);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSearchPanel(view);
            view.focus();
        } else {
            runScopeHandlers(view, e, 'search-panel');
        }
    });

    replaceInput.addEventListener('input', updateQuery);
    replaceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleReplace();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSearchPanel(view);
            view.focus();
        } else {
            runScopeHandlers(view, e, 'search-panel');
        }
    });

    caseSensitiveCheckbox.addEventListener('change', updateQuery);
    regexCheckbox.addEventListener('change', updateQuery);
    wholeWordCheckbox.addEventListener('change', updateQuery);

    preserveCaseCheckbox.addEventListener('change', () => {
        view.dispatch({effects: setPreserveCase.of(preserveCaseCheckbox.checked)});
    });

    prevButton.addEventListener('click', () => {
        findPrevious(view);
        view.focus();
    });

    nextButton.addEventListener('click', () => {
        findNext(view);
        view.focus();
    });

    closeButton.addEventListener('click', () => {
        closeSearchPanel(view);
        view.focus();
    });

    /**
     * Handles the replace operation with optional case preservation.
     */
    function handleReplace() {
        const query = getSearchQuery(view.state);
        const shouldPreserveCase = preserveCaseCheckbox.checked;

        if (!shouldPreserveCase) {
            defaultReplaceNext(view);
            return;
        }

        // Get the current selection/match
        const {state} = view;
        const selection = state.selection.main;

        // Check if current selection matches the search
        const cursor = query.getCursor(state.doc, selection.from, selection.to);
        const match = cursor.next();

        if (match.done || match.value.from !== selection.from || match.value.to !== selection.to) {
            // No match at selection, find next
            findNext(view);
            return;
        }

        // Get the matched text and compute case-preserved replacement
        const matchedText = state.sliceDoc(match.value.from, match.value.to);
        const replacement = preserveCase(matchedText, query.replace);

        // Apply the replacement
        view.dispatch({
            changes: {from: match.value.from, to: match.value.to, insert: replacement},
            selection: {anchor: match.value.from + replacement.length},
            userEvent: 'input.replace',
        });

        // Find the next match
        findNext(view);
    }

    /**
     * Handles replace all with optional case preservation.
     */
    function handleReplaceAll() {
        const query = getSearchQuery(view.state);
        const shouldPreserveCase = preserveCaseCheckbox.checked;

        if (!shouldPreserveCase) {
            defaultReplaceAll(view);
            return;
        }

        // Collect all matches and their case-preserved replacements
        const {state} = view;
        const changes: {from: number; to: number; insert: string}[] = [];
        const cursor = query.getCursor(state.doc);

        let result = cursor.next();
        while (!result.done) {
            const matchedText = state.sliceDoc(result.value.from, result.value.to);
            const replacement = preserveCase(matchedText, query.replace);
            changes.push({
                from: result.value.from,
                to: result.value.to,
                insert: replacement,
            });
            result = cursor.next();
        }

        if (changes.length > 0) {
            view.dispatch({
                changes,
                userEvent: 'input.replace.all',
            });
        }
    }

    replaceButton.addEventListener('click', () => {
        handleReplace();
        view.focus();
    });

    replaceAllButton.addEventListener('click', () => {
        handleReplaceAll();
        view.focus();
    });

    return {
        dom,
        top: true,
        mount() {
            searchInput.focus();
            searchInput.select();
        },
    };
}

/**
 * The complete search panel extension with case preservation support.
 * Use this instead of the default search() extension.
 */
export const searchPanelExtension = [
    preserveCaseState,
    search({
        top: true,
        createPanel: createSearchPanel,
    }),
];
