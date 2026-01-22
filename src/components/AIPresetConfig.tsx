import {useEffect, useState} from 'react';
import {usePremiumStore} from '../stores/premiumStore';
import type {AIPreset} from '../types';

export function AIPresetConfig() {
    const {aiPresets, loadAIPresets, togglePresetEnabled} = usePremiumStore();
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            await loadAIPresets();
            setIsLoading(false);
        };
        load();
    }, [loadAIPresets]);

    if (isLoading) {
        return (
            <div className="text-sm text-[var(--ui-text-muted)]">
                Loading presets...
            </div>
        );
    }

    if (!aiPresets || aiPresets.length === 0) {
        return (
            <div className="text-sm text-[var(--ui-text-muted)]">
                No presets available
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-xs text-[var(--ui-text-muted)] mb-3">
                Enable or disable AI presets to customize your transformation options
            </p>
            {aiPresets.map((preset: AIPreset) => (
                <div
                    key={preset.id}
                    className="flex items-center justify-between py-2 px-3 bg-[var(--ui-surface)] rounded-md"
                >
                    <div className="flex-1">
                        <p className="text-sm font-medium text-[var(--ui-text)]">{preset.name}</p>
                        <p className="text-xs text-[var(--ui-text-muted)] mt-0.5">{preset.description}</p>
                    </div>
                    <button
                        onClick={() => togglePresetEnabled(preset.id)}
                        className={`relative w-11 h-6 rounded-full transition-colors ml-3 ${
                            preset.enabled ? 'bg-[var(--ui-accent)]' : 'bg-[var(--ui-border)]'
                        }`}
                    >
                        <span
                            className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                preset.enabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                        />
                    </button>
                </div>
            ))}
        </div>
    );
}
