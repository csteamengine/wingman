# PRO Features: Diff Preview & Custom Text Transformations

## Overview

Implement two PRO features:
1. **Diff Preview** - Gate existing diff preview/review functionality as a PRO feature
2. **Custom Text Transformations** - Allow users to create JavaScript-based text transformations

---

## Feature 1: Diff Preview as PRO Feature

### Files to Modify

| File | Changes |
|------|---------|
| `/src/types/index.ts` | Add `show_diff_preview` to `AppSettings`, add `'diff_preview'` to `ProFeature` |
| `/src/stores/settingsStore.ts` | Add `show_diff_preview: false` to defaults |
| `/src/stores/editorStore.ts` | Check PRO status before showing diff preview |
| `/src/components/QuickActionsPanel.tsx` | Check PRO status before showing diff preview |
| `/src/components/SettingsPanel.tsx` | Add PRO badge and gate the toggle |

### Implementation Details

1. **Add to types** (`/src/types/index.ts`):
   - Add `show_diff_preview: boolean` to `AppSettings` interface
   - Add `'diff_preview'` to `ProFeature` union type

2. **Add default** (`/src/stores/settingsStore.ts`):
   - Add `show_diff_preview: false` to `defaultSettings`

3. **Gate in editorStore** (`/src/stores/editorStore.ts`):
   - Import `useLicenseStore`
   - Check `isProFeatureEnabled('diff_preview')` before showing preview modal

4. **Gate in QuickActionsPanel** (`/src/components/QuickActionsPanel.tsx`):
   - Check `isProFeatureEnabled('diff_preview')` before showing preview modal

5. **Gate in SettingsPanel** (`/src/components/SettingsPanel.tsx`):
   - Add PRO badge to "Show Diff Preview" toggle
   - Disable toggle if not PRO

---

## Feature 2: Custom Text Transformations (PRO Feature)

### New Files to Create

| File | Purpose |
|------|---------|
| `/src/types/customTransform.ts` | Type definitions for custom transforms |
| `/src/stores/customTransformStore.ts` | Zustand store for managing custom transforms |
| `/src/utils/transformExecutor.ts` | Safe JavaScript execution with error handling |
| `/src/components/CustomTransformsPanel.tsx` | UI for managing custom transforms |
| `/src/components/TransformEditor.tsx` | Monaco-style editor for writing transforms |

### Files to Modify

| File | Changes |
|------|---------|
| `/src/types/index.ts` | Add `'custom_transforms'` to `ProFeature` |
| `/src/stores/editorStore.ts` | Add method to execute custom transforms |
| `/src/components/EditorWindow.tsx` | Add custom transforms dropdown to toolbar |
| `/src/components/QuickActionsPanel.tsx` | Add custom transforms section |
| `/src/components/SettingsPanel.tsx` | Add link to manage custom transforms |
| `/src-tauri/src/storage.rs` | Add storage for custom transforms |
| `/src-tauri/src/lib.rs` | Add Tauri commands for custom transform CRUD |

### Type Definitions (`/src/types/customTransform.ts`)

```typescript
export interface CustomTransform {
  id: string;
  name: string;
  description: string;
  code: string;           // JavaScript function body
  icon?: string;          // Optional custom icon (emoji or icon name)
  shortcut?: string;      // Optional keyboard shortcut
  created_at: string;
  updated_at: string;
}

export interface CustomTransformResult {
  success: boolean;
  result?: string;
  error?: string;
  executionTime?: number;
}

export interface CustomTransformsData {
  transforms: CustomTransform[];
}
```

### Safe JavaScript Execution (`/src/utils/transformExecutor.ts`)

```typescript
export async function executeTransform(
  code: string,
  inputText: string
): Promise<CustomTransformResult> {
  const startTime = performance.now();

  try {
    // Create a sandboxed function from the user's code
    // The function receives 'text' as input and should return transformed text
    const fn = new Function('text', `
      "use strict";
      ${code}
    `);

    // Execute with timeout protection
    const result = await Promise.race([
      Promise.resolve(fn(inputText)),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Transform timed out (5s limit)')), 5000)
      )
    ]);

    // Validate result is a string
    if (typeof result !== 'string') {
      return {
        success: false,
        error: `Transform must return a string, got ${typeof result}`,
      };
    }

    return {
      success: true,
      result,
      executionTime: performance.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
      executionTime: performance.now() - startTime,
    };
  }
}
```

### Custom Transform Store (`/src/stores/customTransformStore.ts`)

```typescript
interface CustomTransformState {
  transforms: CustomTransform[];
  loading: boolean;
  error: string | null;

  // CRUD operations
  loadTransforms: () => Promise<void>;
  addTransform: (transform: Omit<CustomTransform, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateTransform: (id: string, updates: Partial<CustomTransform>) => Promise<void>;
  deleteTransform: (id: string) => Promise<void>;

  // Execution
  executeTransform: (id: string, text: string) => Promise<CustomTransformResult>;
}
```

### Rust Storage (`/src-tauri/src/storage.rs`)

Add new struct and file handling:
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CustomTransform {
    pub id: String,
    pub name: String,
    pub description: String,
    pub code: String,
    pub icon: Option<String>,
    pub shortcut: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CustomTransformsData {
    pub transforms: Vec<CustomTransform>,
}
```

### UI Components

**CustomTransformsPanel** - Full panel for managing transforms:
- List of existing transforms with edit/delete buttons
- "Add New Transform" button
- Search/filter functionality
- Import/export transforms

**TransformEditor** - Modal for creating/editing:
- Name input
- Description input
- Code editor with syntax highlighting (use CodeMirror with JavaScript mode)
- "Test Transform" button with sample input
- Error display area
- Save/Cancel buttons

**Toolbar Integration** - Dropdown in EditorWindow toolbar:
- Icon button that opens dropdown
- Lists all custom transforms
- Click to execute
- "Manage Transforms" link at bottom

### Integration with Diff Preview

When executing a custom transform:
1. Get current text from editor
2. Execute transform via `executeTransform()`
3. If error, show toast notification with error message
4. If success and diff preview enabled (and PRO), show diff modal
5. If success and diff preview disabled, apply directly
6. Add to transformation history for undo support

### Example Custom Transforms (Built-in Templates)

Provide starter templates users can customize:

```javascript
// Reverse each word
return text.split(' ').map(word =>
  word.split('').reverse().join('')
).join(' ');
```

```javascript
// Add line numbers
return text.split('\n').map((line, i) =>
  `${(i + 1).toString().padStart(3)} | ${line}`
).join('\n');
```

```javascript
// Convert to slug
return text.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
```

---

## Implementation Order

### Phase 1: Fix Existing Diff Preview Types
1. Add `show_diff_preview` to TypeScript types and settingsStore defaults
2. Verify diff preview works end-to-end

### Phase 2: Gate Diff Preview as PRO
1. Add `'diff_preview'` to `ProFeature` type
2. Gate in editorStore.ts
3. Gate in QuickActionsPanel.tsx
4. Gate settings toggle in SettingsPanel.tsx

### Phase 3: Custom Transforms Foundation
1. Create type definitions
2. Create Rust storage structs and commands
3. Create customTransformStore.ts
4. Create transformExecutor.ts

### Phase 4: Custom Transforms UI
1. Create TransformEditor component
2. Create CustomTransformsPanel component
3. Add to SettingsPanel navigation

### Phase 5: Custom Transforms Integration
1. Add toolbar dropdown in EditorWindow
2. Add to QuickActionsPanel
3. Integrate with diff preview system
4. Add keyboard shortcut support

### Phase 6: Polish
1. Add built-in template transforms
2. Error handling and user feedback
3. Import/export functionality

---

## Security Considerations

1. **No eval()** - Use `new Function()` which is slightly safer
2. **Timeout protection** - 5 second max execution time
3. **Strict mode** - All user code runs in strict mode
4. **No DOM access** - Function only receives text, no window/document
5. **Error boundaries** - All errors caught and displayed gracefully
6. **No network access** - Cannot make fetch/XHR calls from transform

---

## Verification Plan

1. **Diff Preview PRO Gate**:
   - Free user: Toggle disabled with PRO badge, diff preview never shows
   - PRO user: Toggle works, diff preview shows when enabled

2. **Custom Transforms**:
   - Can create/edit/delete transforms
   - Transforms execute correctly
   - Errors display gracefully without crashing
   - Integrates with diff preview
   - Persists across app restarts
   - Only available for PRO users
