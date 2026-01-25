import {useEffect, useState} from 'react';
import {useCustomAIPromptsStore} from '../stores/customAIPromptsStore';
import {Pencil, Trash2, Plus, X, Check} from 'lucide-react';

export function CustomAIPromptConfig() {
    const {prompts, loadPrompts, addPrompt, updatePrompt, deletePrompt, togglePromptEnabled} = useCustomAIPromptsStore();
    const [isLoading, setIsLoading] = useState(true);
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        systemPrompt: '',
    });

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await loadPrompts();
            setIsLoading(false);
        };
        load();
    }, [loadPrompts]);

    const handleAdd = async () => {
        if (!formData.name.trim() || !formData.systemPrompt.trim()) return;

        await addPrompt(formData.name, formData.description, formData.systemPrompt);
        setShowAddDialog(false);
        setFormData({name: '', description: '', systemPrompt: ''});
    };

    const handleEdit = async (id: string) => {
        if (!formData.name.trim() || !formData.systemPrompt.trim()) return;

        const prompt = prompts.find(p => p.id === id);
        if (!prompt) return;

        await updatePrompt(id, formData.name, formData.description, formData.systemPrompt, prompt.enabled);
        setEditingId(null);
        setFormData({name: '', description: '', systemPrompt: ''});
    };

    const startEdit = (id: string) => {
        const prompt = prompts.find(p => p.id === id);
        if (!prompt) return;

        setEditingId(id);
        setFormData({
            name: prompt.name,
            description: prompt.description,
            systemPrompt: prompt.system_prompt,
        });
    };

    const cancelEdit = () => {
        setEditingId(null);
        setFormData({name: '', description: '', systemPrompt: ''});
    };

    if (isLoading) {
        return (
            <div className="text-sm text-[var(--ui-text-muted)]">
                Loading custom AI prompts...
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs text-[var(--ui-text-muted)]">
                        Create custom AI prompts to refine your text in specific ways
                    </p>
                </div>
                <button
                    onClick={() => setShowAddDialog(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[var(--ui-accent)] text-white text-xs font-medium hover:opacity-90 transition-opacity"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Add Prompt
                </button>
            </div>

            {/* Add/Edit Dialog */}
            {(showAddDialog || editingId) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
                    setShowAddDialog(false);
                    cancelEdit();
                }}>
                    <div
                        className="bg-[var(--ui-surface-solid)] rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-medium text-[var(--ui-text)] mb-4">
                            {editingId ? 'Edit Custom Prompt' : 'Add Custom Prompt'}
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium text-[var(--ui-text)] mb-1.5">
                                    Name <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    placeholder="e.g., Meeting Notes"
                                    className="w-full px-3 py-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--ui-text)] mb-1.5">
                                    Description
                                </label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="e.g., Format rough notes into structured meeting minutes"
                                    className="w-full px-3 py-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-[var(--ui-text)] mb-1.5">
                                    System Prompt <span className="text-red-400">*</span>
                                </label>
                                <textarea
                                    value={formData.systemPrompt}
                                    onChange={(e) => setFormData({...formData, systemPrompt: e.target.value})}
                                    placeholder={`You are an expert at formatting meeting notes. Transform the user's rough notes into well-structured meeting minutes.

Guidelines:
- Use clear headings and bullet points
- Organize by topics discussed
- Include action items separately
- Keep it concise

Output the formatted meeting minutes directly.`}
                                    rows={12}
                                    className="w-full px-3 py-2 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md text-sm text-[var(--ui-text)] placeholder:text-[var(--ui-text-muted)] focus:outline-none focus:border-[var(--ui-accent)] font-mono"
                                />
                                <p className="text-xs text-[var(--ui-text-muted)] mt-1.5">
                                    This is the instruction given to the AI. The user's text will be treated as input to transform.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => {
                                    setShowAddDialog(false);
                                    cancelEdit();
                                }}
                                className="flex-1 px-4 py-2 rounded-md border border-[var(--ui-border)] text-sm font-medium text-[var(--ui-text)] hover:bg-[var(--ui-hover)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => editingId ? handleEdit(editingId) : handleAdd()}
                                disabled={!formData.name.trim() || !formData.systemPrompt.trim()}
                                className="flex-1 px-4 py-2 rounded-md bg-[var(--ui-accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                            >
                                {editingId ? 'Save Changes' : 'Add Prompt'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Prompts List */}
            <div className="space-y-2">
                {prompts.length === 0 ? (
                    <div className="text-center py-8 text-sm text-[var(--ui-text-muted)]">
                        No custom prompts yet. Click "Add Prompt" to create one.
                    </div>
                ) : (
                    prompts.map((prompt) => (
                        <div
                            key={prompt.id}
                            className="flex items-center justify-between py-3 px-4 bg-[var(--ui-surface)] rounded-md border border-[var(--ui-border)]"
                        >
                            <div className="flex-1 min-w-0 mr-4">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-[var(--ui-text)]">{prompt.name}</p>
                                    {!prompt.enabled && (
                                        <span className="text-xs px-2 py-0.5 rounded bg-[var(--ui-border)] text-[var(--ui-text-muted)]">
                                            Disabled
                                        </span>
                                    )}
                                </div>
                                {prompt.description && (
                                    <p className="text-xs text-[var(--ui-text-muted)] mt-0.5 line-clamp-1">
                                        {prompt.description}
                                    </p>
                                )}
                                <p className="text-xs text-[var(--ui-text-muted)] mt-1 line-clamp-2 font-mono">
                                    {prompt.system_prompt}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => startEdit(prompt.id)}
                                    className="p-2 rounded-md hover:bg-[var(--ui-hover)] text-[var(--ui-text-muted)] hover:text-[var(--ui-text)] transition-colors"
                                    title="Edit prompt"
                                >
                                    <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => togglePromptEnabled(prompt.id)}
                                    className={`relative w-11 h-6 rounded-full transition-colors ${
                                        prompt.enabled ? 'bg-[var(--ui-accent)]' : 'bg-[var(--ui-border)]'
                                    }`}
                                    title={prompt.enabled ? 'Disable' : 'Enable'}
                                >
                                    <span
                                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                            prompt.enabled ? 'translate-x-6' : 'translate-x-1'
                                        }`}
                                    />
                                </button>
                                <button
                                    onClick={() => {
                                        if (confirm(`Delete "${prompt.name}"?`)) {
                                            deletePrompt(prompt.id);
                                        }
                                    }}
                                    className="p-2 rounded-md hover:bg-red-500/20 text-[var(--ui-text-muted)] hover:text-red-400 transition-colors"
                                    title="Delete prompt"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
