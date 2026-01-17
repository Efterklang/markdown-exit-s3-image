import { promises as fs } from "node:fs";

export interface CacheEntry {
	dataURL: string;
	width: number;
	height: number;
}

export interface CacheData {
	[key: string]: CacheEntry;
}

export class ImageCache {
	private cache: CacheData = {};
	private isDirty = false;
	private cacheFilePath: string;

	private stats = {
		apiRequests: 0,
		cacheHits: 0,
	};

	constructor(private cacheFile: string) {
		this.cacheFilePath = this.cacheFile;
	}

	async load(): Promise<void> {
		try {
			await fs.access(this.cacheFilePath);
			const cacheContent = await fs.readFile(this.cacheFilePath, "utf8");
			this.cache = JSON.parse(cacheContent || "{}") as CacheData;
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

	get(key: string): CacheEntry | null {
		const decodedKey = decodeURIComponent(key);
		if (this.cache[decodedKey]) {
			this.stats.cacheHits++;
			return this.cache[decodedKey];
		}
		this.stats.apiRequests++;
		return null;
	}

	set(key: string, value: CacheEntry): void {
		const decodedKey = decodeURIComponent(key);
		if (JSON.stringify(this.cache[decodedKey]) !== JSON.stringify(value)) {
			this.cache[decodedKey] = value;
			this.isDirty = true;
		}
	}

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
