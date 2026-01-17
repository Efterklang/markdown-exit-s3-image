# Test Markdown with Images

## Standard Markdown Images

![Alt text for standard image](https://demo.bitiful.com/girl.jpeg)

## Mixed content

可以在HTML中嵌入图片，例如下面的例子：

<div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 2rem;">
  <div style="flex: 1;">

![Alt text for standard image](https://demo.bitiful.com/girl.jpeg)

  </div>
  <div style="flex: 1;">

![Alt text for standard image](https://demo.bitiful.com/girl.jpeg)

  </div>
</div>

## Local images (should be skipped)

![Local image](./test.png)

## Unsupported domains (if configured)

![Unsupported domain](https://bu.dusays.com/2025/09/17/68c9f8d54dca5.webp)

## Complex scenarios

### Image in list

1. First item
2. ![Image in list](https://demo.bitiful.com/girl.jpeg)
3. Third item

### Image in blockquote

> This is a blockquote with ![image](https://demo.bitiful.com/girl.jpeg)
