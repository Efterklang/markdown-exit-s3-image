import { promises as fs } from "node:fs";

// Define the structure for a cache entry
export interface CacheEntry {
	width: number;
	height: number;
	placeholder: string; // This will store the data URL
}

// Define the cache structure
export interface CacheData {
	[key: string]: CacheEntry;
}

export class ImageCache {
	private cache: CacheData = {};
	private isDirty = false;
	private cacheFilePath: string;

	// Statistics
	private stats = {
		apiRequests: 0,
		cacheHits: 0,
	};

	constructor(private cacheFile: string) {
		this.cacheFilePath = this.cacheFile;
	}

	// Load cache from the file system
	async load(): Promise<void> {
		try {
			await fs.access(this.cacheFilePath);
			const cacheContent = await fs.readFile(this.cacheFilePath, "utf8");
			this.cache = JSON.parse(cacheContent || "{}");
			console.log(
				`[ImageCache] Cache loaded from ${this.cacheFilePath} with ${Object.keys(this.cache).length} items.`,
			);
		} catch (_) {
			console.log(
				"[ImageCache] Cache file not found or failed to read, starting with an empty cache.",
			);
			this.cache = {};
		}
	}

	// Save cache to the file system if it has changed
	async save(): Promise<void> {
		if (!this.isDirty) {
			console.log("[ImageCache] No changes to save.");
			return;
		}

		try {
			const cacheContent = JSON.stringify(this.cache, null, 2);
			await fs.writeFile(this.cacheFilePath, cacheContent, "utf8");
			this.isDirty = false;
			console.log(`[ImageCache] Cache saved to ${this.cacheFilePath}.`);
		} catch (error) {
			console.error("[ImageCache] Failed to save cache file:", error);
		}
	}

	// Get an entry from the cache
	get(key: string): CacheEntry | null {
		if (this.cache[key]) {
			this.stats.cacheHits++;
			return this.cache[key];
		}
		this.stats.apiRequests++;
		return null;
	}

	// Set an entry in the cache
	set(key: string, value: CacheEntry): void {
		if (JSON.stringify(this.cache[key]) !== JSON.stringify(value)) {
			this.cache[key] = value;
			this.isDirty = true;
		}
	}

	// Get statistics
	getStats() {
		const totalRequests = this.stats.apiRequests + this.stats.cacheHits;
		return {
			totalItems: Object.keys(this.cache).length,
			isDirty: this.isDirty,
			...this.stats,
			totalRequests,
			cacheHitRate:
				totalRequests > 0
					? ((this.stats.cacheHits / totalRequests) * 100).toFixed(1)
					: "0.0",
		};
	}
}
