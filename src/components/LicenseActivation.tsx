import {useState} from 'react';
import {open} from '@tauri-apps/plugin-shell';
import {useLicense} from '../hooks/useLicense';
import {usePremiumStore} from '../stores/premiumStore';

const SUPABASE_URL = 'https://yhpetdqcmqpfwhdtbhat.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_t4l4DUhI_I2rpT9pMU8dgg_Y2j55oJY';

export function LicenseActivation() {
    const {
        status,
        email,
        daysUntilExpiry,
        loading,
        error,
        isPro,
        isPremium,
        handleActivate,
        handleDeactivate,
        handleRefresh,
    } = useLicense();
    const { loadSubscriptionStatus, loadObsidianConfig, loadAIConfig } = usePremiumStore();

    const [licenseKey, setLicenseKey] = useState('');
    const [activationEmail, setActivationEmail] = useState('');
    const [activationError, setActivationError] = useState<string | null>(null);
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setActivationError(null);

        if (!licenseKey.trim() || !activationEmail.trim()) {
            setActivationError('Please enter both license key and email');
            return;
        }

        const trimmedKey = licenseKey.trim();
        const trimmedEmail = activationEmail.trim().toLowerCase();

        // Store license key in localStorage BEFORE activating so Premium features can access it
        localStorage.setItem('wingman_license_key', trimmedKey);
        localStorage.setItem('wingman_license_email', trimmedEmail);

        const success = await handleActivate(trimmedKey, trimmedEmail);
        if (success) {
            setLicenseKey('');
            setActivationEmail('');
            // Explicitly load Premium subscription status and configs
            loadSubscriptionStatus(trimmedKey);
            loadObsidianConfig();
            loadAIConfig();
        } else {
            // Clear localStorage on failure
            localStorage.removeItem('wingman_license_key');
            localStorage.removeItem('wingman_license_email');
            setActivationError(error || 'Activation failed. Please check your license key and email.');
        }
    };

    // Show current license status if pro or premium
    if (isPro) {
        return (
            <div className="space-y-4">
                <div className={`flex items-center gap-3 p-3 rounded-md ${
                    isPremium
                        ? 'bg-amber-500/10 border border-amber-500/20'
                        : 'bg-green-500/10 border border-green-500/20'
                }`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        isPremium ? 'bg-amber-500/20' : 'bg-green-500/20'
                    }`}>
                        {isPremium ? (
                            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"/>
                            </svg>
                        ) : (
                            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor"
                                 viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
                            </svg>
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${isPremium ? 'text-amber-400' : 'text-green-400'}`}>
                            Wingman {isPremium ? 'Premium' : 'Pro'} Active
                        </p>
                        {email && (
                            <p className="text-xs text-[var(--ui-text-muted)] truncate">{email}</p>
                        )}
                    </div>
                </div>

                {status === 'grace_period' && daysUntilExpiry !== null && (
                    <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                        <p className="text-sm text-yellow-400">
                            Offline validation required. {daysUntilExpiry} days remaining.
                        </p>
                        <button
                            onClick={handleRefresh}
                            disabled={loading}
                            className="btn mt-2 text-xs"
                        >
                            {loading ? 'Validating...' : 'Validate Now'}
                        </button>
                    </div>
                )}

                <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--ui-text-muted)]">
            {daysUntilExpiry !== null && `Revalidation in ${daysUntilExpiry} days`}
          </span>
                    {!showDeactivateConfirm ? (
                        <button
                            onClick={() => setShowDeactivateConfirm(true)}
                            disabled={loading}
                            className="text-red-400 hover:text-red-300 text-xs"
                        >
                            Deactivate
                        </button>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-[var(--ui-text-muted)]">Confirm?</span>
                            <button
                                onClick={async () => {
                                    console.log('Deactivate confirmed, calling handleDeactivate...');
                                    const success = await handleDeactivate();
                                    console.log('handleDeactivate result:', success);
                                    setShowDeactivateConfirm(false);
                                    if (success) {
                                        // Clear stored license key on deactivation
                                        localStorage.removeItem('wingman_license_key');
                                        localStorage.removeItem('wingman_license_email');
                                    } else {
                                        setActivationError('Failed to deactivate. You may need to be online.');
                                    }
                                }}
                                disabled={loading}
                                className="text-red-400 hover:text-red-300 text-xs font-medium"
                            >
                                {loading ? 'Deactivating...' : 'Yes'}
                            </button>
                            <button
                                onClick={() => setShowDeactivateConfirm(false)}
                                disabled={loading}
                                className="text-[var(--ui-text-muted)] hover:text-[var(--editor-fg)] text-xs"
                            >
                                No
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Show activation form
    return (
        <div className="space-y-4">
            <div
                className="flex items-center gap-3 p-3 bg-[var(--ui-surface)] border border-[var(--ui-border)] rounded-md">
                <div
                    className="w-8 h-8 rounded-full bg-[var(--ui-border)] flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-[var(--ui-text-muted)]" fill="none" stroke="currentColor"
                         viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium">Free Tier</p>
                    <p className="text-xs text-[var(--ui-text-muted)]">
                        Upgrade for history, snippets, syntax highlighting & more
                    </p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                    <label className="block text-xs font-medium mb-1">Email</label>
                    <input
                        type="email"
                        value={activationEmail}
                        onChange={(e) => setActivationEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="input w-full text-sm"
                        disabled={loading}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium mb-1">License Key</label>
                    <input
                        type="text"
                        value={licenseKey}
                        onChange={(e) => setLicenseKey(e.target.value.toUpperCase())}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        className="input w-full text-sm font-mono"
                        disabled={loading}
                    />
                </div>

                {(activationError || error) && (
                    <p className="text-xs text-red-400">{activationError || error}</p>
                )}

                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={loading || !licenseKey.trim() || !activationEmail.trim()}
                        className="btn bg-[var(--ui-accent)] text-white flex-1 disabled:opacity-50"
                    >
                        {loading ? 'Activating...' : 'Activate License'}
                    </button>
                </div>
            </form>

            <div className="pt-6 border-t border-[var(--ui-border)]">
                <div
                    className="p-4 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-lg border border-blue-500/20">
                    <div className="flex items-start gap-3 mb-3">
                        <div
                            className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                      d="M13 10V3L4 14h7v7l9-11h-7z"/>
                            </svg>
                        </div>
                        <div>
                            <h4 className="text-sm font-medium text-[var(--ui-text)]">Get Wingman Pro</h4>
                            <p className="text-xs text-[var(--ui-text-muted)]">$4.99 one-time payment</p>
                        </div>
                    </div>

                    <ul className="space-y-1.5 mb-4 text-xs text-[var(--ui-text-muted)]">
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            Clipboard History
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            Snippets & Templates
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            Syntax Highlighting
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="text-green-400">✓</span>
                            Custom Themes & More
                        </li>
                    </ul>

                    <button
                        onClick={async () => {
                            try {
                                const response = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'apikey': SUPABASE_ANON_KEY,
                                    },
                                });
                                const data = await response.json();
                                console.log('Pro checkout response:', data);
                                if (data.url) {
                                    open(data.url);
                                }
                            } catch (err) {
                                console.error('Failed to create checkout session:', err);
                            }
                        }}
                        className="w-full px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-cyan-700 transition-colors"
                    >
                        Buy Pro License
                    </button>
                </div>
            </div>
        </div>
    );
}
