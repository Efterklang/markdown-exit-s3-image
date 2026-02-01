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
 * Configuration options consumed by the plugin.
 */
export interface Options {
	/**
	 * Options for progressive image generation.
	 */
	progressive?: ProgressiveOptions;

	/**
	 * Domains that support Bitiful API for thumbhash and info.
	 * @default ["assets.vluv.space", "s3.bitiful.net", "bitiful.com"]
	 */
	bitiful_domains?: string[];

	/**
	 * Array of file format extensions to ignore (case-insensitive).
	 * @default ["svg"]
	 * @example ["svg", "gif"]
	 */
	ignore_formats?: string[];
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
	bitiful_domains: string[];
	ignore_formats: string[];
	cache_path: CachePathOption;
}
