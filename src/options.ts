import type { Options, ResolvedOptions } from "./types.js";

export function resolveOptions(userOptions: Options = {}): ResolvedOptions {
  const defaultOptions: ResolvedOptions = {
    progressive: {
      enable: true,
      srcset_widths: [400, 600, 800, 1200, 2000, 3000],
    },
    ignore_formats: ["svg", "gif", "webm"],
    bitiful_domains: ["assets.vluv.space", "s3.bitiful.net", "bitiful.com"],
    cache_path: null,
  };

  const resolved: ResolvedOptions = {
    ...defaultOptions,
    ...userOptions,
    progressive: {
      ...defaultOptions.progressive,
      ...userOptions.progressive,
    },
    ignore_formats: userOptions.ignore_formats ?? defaultOptions.ignore_formats,
    bitiful_domains:
      userOptions.bitiful_domains ?? defaultOptions.bitiful_domains,
    cache_path: userOptions.cache_path ?? defaultOptions.cache_path,
  };

  return resolved;
}
