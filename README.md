# markdown-exit-s3-image

A [markdown-exit](https://github.com/Efterklang/markdown-exit) plugin for S3 images with Bitiful CDN integration.

## Features

- **Progressive image loading** - Blurhash placeholders while images load
- **Obsidian-style sizing** - `![alt|width]` or `![alt|widthxheight]` syntax
- **Automatic srcset** - Responsive images with configurable widths
- **Smart caching** - JSON-based metadata caching

## Install

```bash
npm install markdown-exit-s3-image
```

## Usage

```typescript
import { MarkdownExit } from "markdown-exit";
import { image } from "markdown-exit-s3-image";

const md = new MarkdownExit({ html: true });
md.use(image, {
  bitiful_domains: ["demo.bitiful.com"],
  progressive: { enable: true },
});

const html = await md.renderAsync(
  "![girl](https://demo.bitiful.com/girl.jpeg)",
);
```

## Options

```typescript
interface Options {
  bitiful_domains: string[]; // Bitiful CDN domains
  ignore_formats?: string[]; // Formats to skip (e.g., ["svg"])
  progressive: {
    enable: boolean; // Enable progressive loading
    srcset_widths?: number[]; // Widths for srcset generation
  };
  cache_path?: string; // Path to cache file
}
```

## Obsidian Sizing

```markdown
![alt|300]        <!-- width only -->
![alt|640x480]    <!-- width x height -->
```

## License

Credit: [Barbapapazes/markdown-exit-image: Erase images CLS automatically with this Markdown Exit plugin.](https://github.com/Barbapapazes/markdown-exit-image)

MIT
