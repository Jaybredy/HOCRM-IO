import { QueryClient, MutationCache } from '@tanstack/react-query';

// Global fallback for mutation errors — surfaces any error that wasn't
// handled by a per-mutation onError. Without this, RLS denials (200 with
// empty body), schema-drift PGRST204s, and edge-function 4xx/5xx all get
// silently swallowed (audit B-7.f found 30 of 31 mutations missing
// onError). Per-mutation onError still wins; this catches the rest.
const mutationCache = new MutationCache({
	onError: (error, _variables, _context, mutation) => {
		// If the mutation defines its own onError, react-query already
		// invoked it before this fallback runs; don't double-report.
		if (mutation.options.onError) return;
		const msg = error?.message || 'Unknown error';
		// eslint-disable-next-line no-alert -- intentional global fallback
		alert(`Action failed: ${msg}`);
		// eslint-disable-next-line no-console
		console.error('Unhandled mutation error', error);
	},
});

export const queryClientInstance = new QueryClient({
	mutationCache,
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});