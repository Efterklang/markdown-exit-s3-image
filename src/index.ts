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
 * Parsed result from Obsidian-style image alt text.
 */
interface ParsedImageAlt {
	alt: string;
	width?: number;
	height?: number;
}

/**
 * Parse Obsidian-style image dimensions from alt text.
 * Supports formats: `![alt|width]`, `![alt|widthxheight]`
 * Examples:
 *   - `![image|300]` -> width: 300
 *   - `![image|300x200]` -> width: 300, height: 200
 *
 * @param content The image alt text content
 * @returns Parsed result with alt text and optional dimensions
 */
export function parseObsidianImageAlt(content: string): ParsedImageAlt {
	const trimmedContent = content.trim();
	const match = trimmedContent.match(/^(.*?)\|(\d+)(?:x(\d+))?$/);
	if (!match) {
		return { alt: content };
	}

	const alt = match[1].trim();
	const width = parseInt(match[2], 10);
	const height = match[3] ? parseInt(match[3], 10) : undefined;

	return { alt, width, height };
}

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

	const cachePath = options.cache_path;
	const cache = cachePath && options.progressive.enable ? new ImageCache(cachePath) : null;

	if (cache) {
		cache.load().catch((err) => {
			console.error("[ImageCache] Failed to load cache:", err);
		});

		process.once("beforeExit", () => {
			cache.save();
		});
	}

	const imageRule = md.renderer.rules.image;
	if (!imageRule) {
		return;
	}

	md.renderer.rules.image = async (tokens, idx, info, env, self) => {
		const token = tokens[idx];
		const src = token.attrGet("src");

		const parsedAlt = parseObsidianImageAlt(token.content);

		const shouldHandleProgressive =
			options.progressive.enable &&
			src &&
			src.startsWith("http") &&
			isBitifulDomain(src, options.bitiful_domains) &&
			!shouldIgnoreFormat(src, options.ignore_formats) &&
			process.env.NODE_ENV !== "development";

		if (!shouldHandleProgressive) {
			if (parsedAlt.width) {
				const result = await imageRule(tokens, idx, info, env, self);
				return applyDimensionToHTML(result, parsedAlt.width, parsedAlt.height);
			}
			return imageRule(tokens, idx, info, env, self);
		}

		if (cache) {
			const cached = cache.get(src);
			if (cached) {
				return buildImageHTML(
					parsedAlt,
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

		if (!dimensionResult) {
			console.warn(
				`[ImagePlugin] Skipping progressive image for ${src} - dimensions unavailable`,
			);
			return imageRule(tokens, idx, info, env, self);
		}

		width = dimensionResult.width;
		height = dimensionResult.height;
		placeholderUrl = thumbhashResult || "";

		if (cache && placeholderUrl) {
			cache.set(src, { width, height, dataURL: placeholderUrl });
		}

		return buildImageHTML(
			parsedAlt,
			src,
			options,
			width,
			height,
			placeholderUrl,
		);
	};
}

/**
 * Apply user-specified dimensions to existing HTML img tag.
 */
function applyDimensionToHTML(
	html: string,
	width?: number,
	height?: number,
): string {
	if (!width) return html;

	let style = `max-width: ${width}px; width: ${width}px;`;
	if (height) {
		style += ` height: ${height}px;`;
	}

	// Try to add style to existing img tag
	if (html.includes("<img")) {
		return html.replace(
			/<img\s/,
			`<img style="${style}" `,
		);
	}

	return html;
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
	parsedAlt: ParsedImageAlt,
	src: string,
	options: ReturnType<typeof resolveOptions>,
	originalWidth: number,
	originalHeight: number,
	dataURL: string,
): string {
	// Use user-specified dimensions if provided, otherwise use original dimensions
	const displayWidth = parsedAlt.width || originalWidth;
	const displayHeight = parsedAlt.height;

	// 1. 生成响应式图片srcset
	const srcset = generateSrcset(src, originalWidth, options.progressive.srcset_widths);

	// 2. 构建 img 标签属性
	const mainImgAttrs = [
		`src="${src}"`,
		`alt="${parsedAlt.alt}"`,
		`srcset="${srcset}"`,
		`loading="lazy" decoding="async"`,
		`style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.6s ease-in-out;"`,
		`onload="this.style.opacity=1; setTimeout(() => { this.parentElement.style.backgroundImage='none'; }, 600);"`,
	]
		.filter(Boolean)
		.join(" ");

	// Calculate aspect ratio based on display dimensions or original dimensions
	const aspectWidth = displayWidth;
	const aspectHeight = displayHeight || Math.round((originalHeight / originalWidth) * displayWidth);

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
			max-width: ${displayWidth}px;
			background-image: url('${dataURL}');
			background-size: cover;
			background-repeat: no-repeat;
			aspect-ratio: ${aspectWidth} / ${aspectHeight};
		">
			<img ${mainImgAttrs}>
		</div>`;
	} else {
		return `<img ${mainImgAttrs}>`;
	}
}
