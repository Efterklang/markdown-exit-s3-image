import type { MarkdownExit } from "markdown-exit";
import sharp from "sharp";
import { rgbaToDataURL } from "thumbhash";
import { ImageCache } from "./cache.js";
import { resolveOptions } from "./options.js";
import type { Options } from "./types.js";

/**
 * Determine whether a remote URL matches the supported domain list.
 * Supports wildcards (*) for pattern matching.
 */
function isSupportedDomain(url: string, patterns: string[]): boolean {
	if (patterns.length === 0) {
		return true;
	}

	try {
		const urlObj = new URL(url);
		const hostname = urlObj.hostname;

		return patterns.some((pattern) => {
			const regexPattern = pattern
				.replace(/\./g, "\\.") // Escape dots
				.replace(/\*/g, ".*"); // Convert * to .*
			const regex = new RegExp(`^${regexPattern}$`, "i");
			return regex.test(hostname);
		});
	} catch {
		return false;
	}
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

	if (!options.progressive.enable) {
		return;
	}

	const cachePath = options.cache_path;
	const cache = cachePath ? new ImageCache(cachePath) : null;
	let cacheLoaded = false;
	let imageCount = 0;

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

		if (!src) {
			return imageRule(tokens, idx, info, env, self);
		}

		// Skip non-remote images (local images)
		const isRemote = src.startsWith("http");
		if (!isRemote) {
			return imageRule(tokens, idx, info, env, self);
		}

		// Check if domain is supported
		if (!isSupportedDomain(src, options.supported_domains)) {
			return imageRule(tokens, idx, info, env, self);
		}

		// Check if format should be ignored
		if (shouldIgnoreFormat(src, options.ignore_formats)) {
			return imageRule(tokens, idx, info, env, self);
		}

		if (!cacheLoaded && cache) {
			await cache.load();
			cacheLoaded = true;
		}

		try {
			// --- 1. Check Cache ---
			if (cache) {
				const cached = cache.get(src);
				if (cached) {
					imageCount++;
					return buildImageHTML(
						token.content,
						src,
						options,
						imageCount,
						cached.width,
						cached.height,
						cached.placeholder,
					);
				}
			}

			// --- 2. Get Image Buffer from remote URL ---
			const response = await fetch(src);
			const imageBuffer = Buffer.from(await response.arrayBuffer());

			// --- 3. Image Processing ---
			const image = sharp(imageBuffer);
			const metadata = await image.metadata();
			const { width, height } = metadata;

			const { data: thumbnailBuffer, info: thumbnailInfo } = await image
				.resize(100, 100, { fit: "inside" })
				.ensureAlpha()
				.raw()
				.toBuffer({ resolveWithObject: true });

			const placeholderUrl = rgbaToDataURL(
				thumbnailInfo.width,
				thumbnailInfo.height,
				new Uint8Array(thumbnailBuffer),
			);

			// --- 4. Cache Result ---
			if (cache) {
				cache.set(src, { width, height, placeholder: placeholderUrl });
			}

			// --- 5. Build and Return HTML ---
			imageCount++;
			return buildImageHTML(
				token.content,
				src,
				options,
				imageCount,
				width,
				height,
				placeholderUrl,
			);
		} catch (e) {
			console.error(`[markdown-exit-image] Error processing image ${src}:`, e);
			// Fallback to default renderer on error
			return imageRule(tokens, idx, info, env, self);
		}
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
	imageIndex: number,
	width: number,
	height: number,
	dataURL: string,
): string {
	// 1. 生成响应式图片srcset
	const srcset = generateSrcset(src, width, options.progressive.srcset_widths);

	// 2. 确定是否懒加载
	const shouldLazyLoad =
		options.lazy.enable && imageIndex > options.lazy.skip_first;

	// 3. 构建 img 标签属性
	// 注意：width 和 height 属性传原始像素值，用于浏览器计算宽高比防止 CLS
	const mainImgAttrs = [
		`src="${src}"`,
		`alt="${alt}"`,
		`width="${width}"`,
		`height="${height}"`,
		`srcset="${srcset}"`,
		`sizes="${options.progressive.sizes || `(max-width: ${width}px) 100vw, ${width}px`}"`,
		shouldLazyLoad ? 'loading="lazy" decoding="async"' : 'fetchpriority="high"',
		`style="width: 100%; height: auto; display: block; transition: opacity 0.4s; opacity: 0;"`,
		`onload="this.style.opacity=1; this.parentElement.style.backgroundImage='none';"`,
	]
		.filter(Boolean)
		.join(" ");

	/**
	 * 4. 返回包装后的 HTML
	 * - 外层 div 控制最大宽度并占用占位空间
	 * - aspect-ratio 确保容器高度在图片加载前就已确定
	 * - background-image 放置低分辨率模糊预览图 (dataURL)
	 */
	return `
    <div class="img-container" style="
      position: relative;
      overflow: hidden;
      aspect-ratio: ${width} / ${height};
      max-width: ${width}px;
      width: 100%;
      background-image: url('${dataURL}');
      background-size: cover;
      background-repeat: no-repeat;
    ">
      <img ${mainImgAttrs}>
    </div>
  `;
}
