import type { Options, ResolvedOptions } from "./types.js";

export function resolveOptions(userOptions: Options = {}): ResolvedOptions {
	const defaultOptions: ResolvedOptions = {
		progressive: {
			enable: true,
			srcset_widths: [400, 600, 800, 1200, 2000, 3000],
		},
		lazy: {
			enable: true,
			skip_first: 2,
		},
		supported_domains: [],
		ignore_formats: ["svg"],
		cache_path: null,
	};

	const resolved: ResolvedOptions = {
		...defaultOptions,
		...userOptions,
		progressive: {
			...defaultOptions.progressive,
			...userOptions.progressive,
		},
		lazy: {
			...defaultOptions.lazy,
			...userOptions.lazy,
		},
		supported_domains:
			userOptions.supported_domains ?? defaultOptions.supported_domains,
		ignore_formats: userOptions.ignore_formats ?? defaultOptions.ignore_formats,
		cache_path: userOptions.cache_path ?? defaultOptions.cache_path,
	};

	return resolved;
}
