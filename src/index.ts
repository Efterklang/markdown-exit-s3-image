import type { MarkdownExit } from "markdown-exit";
import {
	getBitifulDimension,
	getBitifulThumbhash,
	isBitifulDomain,
} from "./bitiful.js";
import { ImageCache } from "./cache.js";
import { resolveOptions } from "./options.js";
import type { Options, ResolvedOptions } from "./types.js";

/**
 * Parsed result from Obsidian-style image alt text.
 */
interface ParsedImageAlt {
	alt: string;
	width?: number;
	height?: number;
}

type ImageRule = NonNullable<MarkdownExit["renderer"]["rules"]["image"]>;

/**
 * Parse Obsidian-style image dimensions from alt text.
 * Supports formats: `![alt|width]`, `![alt|widthxheight]`
 */
export function parseObsidianImageAlt(content: string): ParsedImageAlt {
	const trimmedContent = content.trim();
	const match = trimmedContent.match(/^(.*?)\|(\d+)(?:x(\d+))?$/);
	if (!match) {
		return { alt: content };
	}

	const alt = match[1].trim();
	const width = Number.parseInt(match[2], 10);
	const height = match[3] ? Number.parseInt(match[3], 10) : undefined;

	return { alt, width, height };
}

/**
 * Check if file format should be ignored based on URL extension.
 */
function shouldIgnoreFormat(url: string, formats: string[]): boolean {
	try {
		const pathname = new URL(url).pathname.toLowerCase();
		return formats.some((format) =>
			pathname.endsWith(`.${format.toLowerCase()}`),
		);
	} catch {
		return false;
	}
}

function shouldUseProgressiveImage(
	src: string | null,
	options: ResolvedOptions,
): src is string {
	return Boolean(
		options.progressive.enable &&
			src &&
			src.startsWith("http") &&
			isBitifulDomain(src, options.bitiful_domains) &&
			!shouldIgnoreFormat(src, options.ignore_formats) &&
			process.env.NODE_ENV !== "development",
	);
}

function escapeHtml(value: string): string {
	return value
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

function addOrMergeStyleAttribute(html: string, style: string): string {
	if (!html.includes("<img")) {
		return html;
	}

	if (html.includes('style="')) {
		return html.replace(/style="([^"]*)"/, (_match, existingStyle: string) => {
			const separator =
				existingStyle.length > 0 && !existingStyle.trim().endsWith(";")
					? "; "
					: " ";
			return `style="${existingStyle}${separator}${style}"`;
		});
	}

	return html.replace(/<img\b/, `<img style="${style}"`);
}

function applyDimensionToHTML(
	html: string,
	width?: number,
	height?: number,
): string {
	if (!width) {
		return html;
	}

	let style = `max-width: ${width}px; width: ${width}px;`;
	if (height) {
		style += ` height: ${height}px;`;
	}

	return addOrMergeStyleAttribute(html, style);
}

function wrapWithFigure(html: string, caption: string): string {
	if (!caption) {
		return html;
	}

	return `<figure>${html}<figcaption>${escapeHtml(caption)}</figcaption></figure>`;
}

async function renderStandardImage(
	imageRule: ImageRule,
	tokens: Parameters<ImageRule>[0],
	idx: number,
	info: Parameters<ImageRule>[2],
	env: Parameters<ImageRule>[3],
	self: Parameters<ImageRule>[4],
	parsedAlt: ParsedImageAlt,
): Promise<string> {
	const token = tokens[idx];
	const originalContent = token.content;
	token.content = parsedAlt.alt;

	try {
		const html = await imageRule(tokens, idx, info, env, self);
		return wrapWithFigure(
			applyDimensionToHTML(html, parsedAlt.width, parsedAlt.height),
			parsedAlt.alt,
		);
	} finally {
		token.content = originalContent;
	}
}

function generateSrcset(
	src: string,
	width: number,
	srcsetWidths: number[],
): string {
	const sortedWidths = Array.from(
		new Set(
			srcsetWidths
				.filter((candidate) => Number.isFinite(candidate) && candidate > 0)
				.filter((candidate) => candidate < width)
				.concat(width),
		),
	).sort((a, b) => a - b);

	return sortedWidths
		.map((candidateWidth) => {
			const url =
				candidateWidth === width
					? src
					: src.includes("?")
						? `${src}&w=${candidateWidth}`
						: `${src}?w=${candidateWidth}`;
			return `${url} ${candidateWidth}w`;
		})
		.join(", ");
}

function buildProgressiveImageHTML(
	parsedAlt: ParsedImageAlt,
	src: string,
	options: ResolvedOptions,
	originalWidth: number,
	originalHeight: number,
	dataURL: string,
): string {
	const displayWidth = parsedAlt.width ?? originalWidth;
	const displayHeight =
		parsedAlt.height ??
		Math.round((originalHeight / originalWidth) * displayWidth);
	const srcset = generateSrcset(
		src,
		originalWidth,
		options.progressive.srcset_widths,
	);
	const escapedAlt = escapeHtml(parsedAlt.alt);
	const escapedSrc = escapeHtml(src);
	const figcaption = parsedAlt.alt
		? `<figcaption style="margin-top: 8px; text-align: center; color: #666; font-size: 0.9em;">${escapedAlt}</figcaption>`
		: "";

	// 注意：这里的 onload 逻辑依然是操作 parentElement，即操作我们新增的 wrapper 层
	const mainImgAttrs = [
		`src="${escapedSrc}"`,
		`alt="${escapedAlt}"`,
		`srcset="${escapeHtml(srcset)}"`,
		`sizes="${escapeHtml(options.progressive.sizes ?? `${displayWidth}px`)}"`,
		`loading="lazy"`,
		`decoding="async"`,
		`style="width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.6s ease-in-out; display: block;"`,
		`onload="this.style.opacity=1; setTimeout(() => { this.parentElement.style.backgroundImage='none'; }, 600);"`,
	]
		.filter(Boolean)
		.join(" ");

	if (!dataURL) {
		const imageHtml = `<img ${mainImgAttrs}>`;
		return figcaption
			? `<figure style="max-width: ${displayWidth}px;">${imageHtml}${figcaption}</figure>`
			: imageHtml;
	}

	// 核心修改：增加了一个包裹图片的 div，将背景和比例从 figure 移到了这个 div 上
	return `
	<figure class="pic" style="max-width: ${displayWidth}px; width: 100%; margin: 1em auto;">
		<div class="img-wrapper" style="
			position: relative;
			width: 100%;
			background-image: url('${dataURL}');
			background-size: cover;
			background-repeat: no-repeat;
			aspect-ratio: ${displayWidth} / ${displayHeight};
			overflow: hidden;
		">
			<img ${mainImgAttrs}>
		</div>
		${figcaption}
	</figure>`.replace(/\n\t+/g, ""); // 移除多余换行和空格
}

async function getProgressiveImageData(
	src: string,
	cache: ImageCache | null,
): Promise<{
	dataURL: string;
	width: number;
	height: number;
} | null> {
	if (cache) {
		const cached = cache.get(src);
		if (cached) {
			return cached;
		}
	}

	const [dimensionResult, thumbhashResult] = await Promise.all([
		getBitifulDimension(src),
		getBitifulThumbhash(src),
	]);

	if (!dimensionResult) {
		console.warn(
			`[ImagePlugin] Skipping progressive image for ${src} - dimensions unavailable`,
		);
		return null;
	}

	const result = {
		width: dimensionResult.width,
		height: dimensionResult.height,
		dataURL: thumbhashResult ?? "",
	};

	if (cache && result.dataURL) {
		cache.set(src, result);
	}

	return result;
}

export function image(md: MarkdownExit, userOptions: Options) {
	const options = resolveOptions(userOptions);
	const cache =
		options.cache_path && options.progressive.enable
			? new ImageCache(options.cache_path)
			: null;
	const cacheReady = cache
		? cache.load().catch((error) => {
				console.error("[ImageCache] Failed to load cache:", error);
			})
		: Promise.resolve();

	if (cache) {
		process.once("beforeExit", () => {
			void cache.save();
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

		if (!shouldUseProgressiveImage(src, options)) {
			return renderStandardImage(
				imageRule,
				tokens,
				idx,
				info,
				env,
				self,
				parsedAlt,
			);
		}

		await cacheReady;

		const progressiveData = await getProgressiveImageData(src, cache);
		if (!progressiveData) {
			return renderStandardImage(
				imageRule,
				tokens,
				idx,
				info,
				env,
				self,
				parsedAlt,
			);
		}

		return buildProgressiveImageHTML(
			parsedAlt,
			src,
			options,
			progressiveData.width,
			progressiveData.height,
			progressiveData.dataURL,
		);
	};
}
