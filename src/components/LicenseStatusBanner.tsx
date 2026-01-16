import { useLicenseStore } from '../stores/licenseStore';

export function LicenseStatusBanner() {
  const { status, daysUntilExpiry, loading, refreshLicense } = useLicenseStore();

  // Only show banner for grace period or expired status
  if (status !== 'grace_period' && status !== 'expired') {
    return null;
  }

  const handleRefresh = async () => {
    await refreshLicense();
  };

  if (status === 'expired') {
    return (
      <div className="px-3 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <svg
            className="w-4 h-4 text-red-400 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <span className="text-xs text-red-400 truncate">
            License validation expired. Pro features disabled.
          </span>
        </div>
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="text-xs text-red-400 hover:text-red-300 underline flex-shrink-0"
        >
          {loading ? 'Validating...' : 'Revalidate'}
        </button>
      </div>
    );
  }

  // Grace period warning
  return (
    <div className="px-3 py-2 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <svg
          className="w-4 h-4 text-yellow-400 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span className="text-xs text-yellow-400 truncate">
          {daysUntilExpiry !== null
            ? `Offline mode: ${daysUntilExpiry} days until Pro features disable`
            : 'License validation needed'}
        </span>
      </div>
      <button
        onClick={handleRefresh}
        disabled={loading}
        className="text-xs text-yellow-400 hover:text-yellow-300 underline flex-shrink-0"
      >
        {loading ? 'Validating...' : 'Go online'}
      </button>
    </div>
  );
}
