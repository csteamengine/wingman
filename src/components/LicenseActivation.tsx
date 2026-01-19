import { useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { useLicense } from '../hooks/useLicense';

export function LicenseActivation() {
  const {
    status,
    email,
    daysUntilExpiry,
    loading,
    error,
    isPro,
    handleActivate,
    handleDeactivate,
    handleRefresh,
  } = useLicense();

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

    const success = await handleActivate(licenseKey.trim(), activationEmail.trim().toLowerCase());
    if (success) {
      setLicenseKey('');
      setActivationEmail('');
    } else {
      setActivationError(error || 'Activation failed. Please check your license key and email.');
    }
  };

  // Show current license status if pro
  if (isPro) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-md">
          <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-400">Wingman Pro Active</p>
            {email && (
              <p className="text-xs text-[var(--editor-muted)] truncate">{email}</p>
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
          <span className="text-[var(--editor-muted)]">
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
              <span className="text-xs text-[var(--editor-muted)]">Confirm?</span>
              <button
                onClick={async () => {
                  console.log('Deactivate confirmed, calling handleDeactivate...');
                  const success = await handleDeactivate();
                  console.log('handleDeactivate result:', success);
                  setShowDeactivateConfirm(false);
                  if (!success) {
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
                className="text-[var(--editor-muted)] hover:text-[var(--editor-fg)] text-xs"
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
      <div className="flex items-center gap-3 p-3 bg-[var(--editor-surface)] border border-[var(--editor-border)] rounded-md">
        <div className="w-8 h-8 rounded-full bg-[var(--editor-border)] flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[var(--editor-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">Free Tier</p>
          <p className="text-xs text-[var(--editor-muted)]">
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
            className="btn bg-[var(--editor-accent)] text-white flex-1 disabled:opacity-50"
          >
            {loading ? 'Activating...' : 'Activate License'}
          </button>
        </div>
      </form>

      <div className="pt-2 border-t border-[var(--editor-border)]">
        <p className="text-xs text-[var(--editor-muted)] mb-2">
          Don't have a license?
        </p>
        <button
          onClick={async () => {
            try {
              const response = await fetch('https://yhpetdqcmqpfwhdtbhat.supabase.co/functions/v1/create-checkout-session', {
                method: 'POST',
              });
              const data = await response.json();
              if (data.url) {
                open(data.url);
              }
            } catch (err) {
              console.error('Failed to create checkout session:', err);
            }
          }}
          className="btn w-full text-center text-sm"
        >
          Get Wingman Pro - $4.99
        </button>
      </div>
    </div>
  );
}
