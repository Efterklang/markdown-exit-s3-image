export type CachePathOption = string | null;

/**
 * Options controlling progressive image loading.
 */
export interface ProgressiveOptions {
	/**
	 * Enable or disable progressive image loading.
	 * @default true
	 */
	enable?: boolean;

	/**
	 * An array of widths to generate for the srcset attribute.
	 * @default [400, 600, 800, 1200, 2000, 3000]
	 */
	srcset_widths?: number[];

	/**
	 * Optional value for the sizes attribute.
	 * @example "(max-width: 800px) 100vw, 800px"
	 */
	sizes?: string;
}

/**
 * Options for controlling lazy loading behaviour.
 */
export interface LazyOptions {
	/**
	 * Enable or disable lazy loading.
	 * @default true
	 */
	enable?: boolean;

	/**
	 * Number of images to skip before applying lazy loading.
	 * @default 2
	 */
	skip_first?: number;
}

/**
 * Configuration options consumed by the plugin.
 */
export interface Options {
	/**
	 * Options for progressive image generation.
	 */
	progressive?: ProgressiveOptions;

	/**
	 * Domains that are eligible for processing. Supports wildcards.
	 * When empty, all remote domains are processed.
	 * @default []
	 * @example ["example.com", "*.cdn.example.com"]
	 */
	supported_domains?: string[];

	/**
	 * Array of file format extensions to ignore (case-insensitive).
	 * @default ["svg"]
	 * @example ["svg", "gif"]
	 */
	ignore_formats?: string[];

	/**
	 * Options for lazy loading.
	 */
	lazy?: LazyOptions;

	/**
	 * Path to the cache file. When unset, caching is disabled.
	 * @default null
	 * @example ".cache/thumbhash-cache.json"
	 */
	cache_path?: CachePathOption;
}

/**
 * Fully resolved options with defaults applied.
 */
export interface ResolvedOptions extends Options {
	progressive: ProgressiveOptions & {
		enable: boolean;
		srcset_widths: number[];
	};
	lazy: LazyOptions & {
		enable: boolean;
		skip_first: number;
	};
	supported_domains: string[];
	ignore_formats: string[];
	cache_path: CachePathOption;
}
