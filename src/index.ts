import type { MarkdownExit } from "markdown-exit";
import {
	getBitifulDimension,
	getBitifulThumbhash,
	isBitifulDomain,
} from "./bitiful.js";
import { ImageCache } from "./cache.js";
import { resolveOptions } from "./options.js";
import type { Options } from "./types.js";

/**
 * Check if file format should be ignored based on URL extension.
 */
function shouldIgnoreFormat(url: string, formats: string[]): boolean {
	const urlObj = new URL(url);
	const pathname = urlObj.pathname.toLowerCase();
	return formats.some((format) =>
		pathname.endsWith(`.${format.toLowerCase()}`),
	);
}

export function image(md: MarkdownExit, userOptions: Options) {
	const options = resolveOptions(userOptions);

	if (!options.progressive.enable) {
		return;
	}

	const cachePath = options.cache_path;
	const cache = cachePath ? new ImageCache(cachePath) : null;

	// Load cache once on plugin initialization
	if (cache) {
		cache.load().catch((err) => {
			console.error("[ImageCache] Failed to load cache:", err);
		});
	}

	// Save cache on exit
	process.once("beforeExit", () => {
		if (cache) {
			cache.save();
		}
	});

	const imageRule = md.renderer.rules.image;
	if (!imageRule) {
		return;
	}

	md.renderer.rules.image = async (tokens, idx, info, env, self) => {
		const token = tokens[idx];
		const src = token.attrGet("src");

		// 忽略不处理的图片
		// - 格式在忽略列表内
		if (
			!src ||
			!src.startsWith("http") ||
			!isBitifulDomain(src, options.bitiful_domains) ||
			shouldIgnoreFormat(src, options.ignore_formats) ||
			process.env.NODE_ENV === "development"
		) {
			return imageRule(tokens, idx, info, env, self);
		}

		// --- 1. Check Cache ---
		if (cache) {
			const cached = cache.get(src);
			if (cached) {
				return buildImageHTML(
					token.content,
					src,
					options,
					cached.width,
					cached.height,
					cached.dataURL,
				);
			}
		}

		let width: number;
		let height: number;
		let placeholderUrl = "";

		const [dimensionResult, thumbhashResult] = await Promise.all([
			getBitifulDimension(src),
			getBitifulThumbhash(src),
		]);

		// If dimension API fails, fall back to default image rendering
		if (!dimensionResult) {
			console.warn(
				`[ImagePlugin] Skipping progressive image for ${src} - dimensions unavailable`,
			);
			return imageRule(tokens, idx, info, env, self);
		}

		width = dimensionResult.width;
		height = dimensionResult.height;
		placeholderUrl = thumbhashResult || "";

		// --- 4. Cache Result ---
		if (cache && placeholderUrl) {
			cache.set(src, { width, height, dataURL: placeholderUrl });
		}

		// --- 5. Build and Return HTML ---
		return buildImageHTML(
			token.content,
			src,
			options,
			width,
			height,
			placeholderUrl,
		);
	};
}

function generateSrcset(
	src: string,
	width: number,
	srcsetWidths: number[],
): string {
	// 1. 过滤并处理宽度列表
	const validWidths = srcsetWidths
		.filter((w) => w < width) // 只保留比原图小的尺寸
		.concat(width); // 将原图实际宽度作为最后一档加入

	// 2. 去重并排序
	const sortedWidths = Array.from(new Set(validWidths)).sort((a, b) => a - b);

	// 3. 生成字符串
	return sortedWidths
		.map((w) => {
			// 如果w等于原始宽度，不添加w=参数；否则添加w=参数用于CDN响应式处理
			const url =
				w === width
					? src
					: src.includes("?")
						? `${src}&w=${w}`
						: `${src}?w=${w}`;
			return `${url} ${w}w`;
		})
		.join(", ");
}

function buildImageHTML(
	alt: string,
	src: string,
	options: ReturnType<typeof resolveOptions>,
	width: number,
	height: number,
	dataURL: string,
): string {
	// 1. 生成响应式图片srcset
	const srcset = generateSrcset(src, width, options.progressive.srcset_widths);

	// 2. 构建 img 标签属性
	const mainImgAttrs = [
		`src="${src}"`,
		`alt="${alt}"`,
		`srcset="${srcset}"`,
		`loading="lazy" decoding="async"`,
		`style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.6s ease-in-out;"`,
		`onload="this.style.opacity=1; setTimeout(() => { this.parentElement.style.backgroundImage='none'; }, 600);"`,
	]
		.filter(Boolean)
		.join(" ");

	/**
	 * 3. 返回包装后的 HTML
	 * - 只有当有 dataURL 时才包装 div
	 * - 外层 div 设置背景和宽高比
	 */
	if (dataURL) {
		return `<div class="pic" style="
			position: relative;
			overflow: hidden;
			width: 100%;
			max-width: ${width}px;
			background-image: url('${dataURL}');
			background-size: cover;
			background-repeat: no-repeat;
			aspect-ratio: ${width} / ${height};
		">
			<img ${mainImgAttrs}>
		</div>`;
	} else {
		return `<img ${mainImgAttrs}>`;
	}
}
