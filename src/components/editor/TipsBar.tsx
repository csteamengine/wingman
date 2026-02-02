import {useState, useEffect, useCallback} from 'react';
import {AnimatePresence, motion} from 'framer-motion';

const TIPS = [
    'Use the History panel (clock icon) to browse and restore previous clipboard entries.',
    'Drag clipboard items directly into the editor to insert them at any position. (Pro)',
    'Use Cmd+0 through Cmd+9 to quickly switch between your favorite language modes.',
    'Create custom AI prompts in Settings to automate repetitive text transformations. (Premium)',
    'Use Format (Cmd+Shift+F) to auto-format code in 20+ languages.',
    'Mask Secrets automatically redacts API keys, tokens, and passwords from your text.',
    'Export notes directly to Obsidian with one click. (Pro)',
    'Create GitHub Gists instantly from the editor. (Pro)',
    'Enable Diff Preview in Settings to review changes before applying transformations. (Pro)',
];

const ROTATION_INTERVAL = 9000; // 9 seconds
const STORAGE_KEY = 'wingman_tip_index';

const tipVariants = {
    initial: {opacity: 0, y: 20},
    animate: {opacity: 1, y: 0},
    exit: {opacity: 0, y: -20},
};

export function TipsBar() {
    const [tipIndex, setTipIndex] = useState(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        return saved ? parseInt(saved, 10) % TIPS.length : 0;
    });
    const [isPaused, setIsPaused] = useState(false);

    const advanceTip = useCallback(() => {
        setTipIndex((prev) => {
            const next = (prev + 1) % TIPS.length;
            localStorage.setItem(STORAGE_KEY, String(next));
            return next;
        });
    }, []);

    useEffect(() => {
        if (isPaused) return;

        const interval = setInterval(advanceTip, ROTATION_INTERVAL);
        return () => clearInterval(interval);
    }, [isPaused, advanceTip]);

    return (
        <div
            className="relative flex items-center px-3 py-1.5 border-t border-[var(--ui-border)] bg-[var(--ui-surface)]/50"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
        >
            <span className="text-xs text-[var(--ui-text-muted)] mr-2 flex-shrink-0">Tip:</span>
            <div className="flex-1 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.p
                        key={tipIndex}
                        variants={tipVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{duration: 0.3}}
                        className="text-xs text-[var(--ui-text-muted)] truncate"
                    >
                        {TIPS[tipIndex]}
                    </motion.p>
                </AnimatePresence>
            </div>
        </div>
    );
}
