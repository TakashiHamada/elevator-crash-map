import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CONFIG } from '../board-data.js';

// SNSのクローラーが受け取る静的HTMLを対象にし、JavaScriptによる後付けに依存しないことを確認する。
test('SNS共有用のURLと大きな画像カードを静的HTMLに指定する', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const meta = Object.fromEntries([...html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)">/gu)].map(([, key, value]) => [key, value]));
  assert.equal(meta['og:type'], 'website');
  assert.equal(meta['og:url'], CONFIG.siteUrl);
  assert.ok(html.includes(`<link rel="canonical" href="${CONFIG.siteUrl}">`));
  assert.equal(meta['twitter:card'], 'summary_large_image');
  assert.equal(meta['twitter:title'], meta['og:title']);
  assert.equal(meta['twitter:description'], meta['og:description']);
  assert.equal(meta['twitter:image'], meta['og:image']);
  assert.equal(meta['twitter:image:alt'], meta['og:image:alt']);
  assert.ok(meta['og:title']);
  assert.ok(meta['og:description']);
  assert.ok(meta['og:image:alt']);

  // 公開URL・画像ファイル・宣言した画像寸法の食い違いを検出する。
  const imageUrl = new URL('assets/social-map.png', CONFIG.siteUrl);
  assert.equal(imageUrl.protocol, 'https:');
  assert.equal(meta['og:image'], imageUrl.href);
  const png = await readFile(new URL('../assets/social-map.png', import.meta.url));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(meta['og:image:type'], 'image/png');
  assert.equal(png.readUInt32BE(16), 1200);
  assert.equal(png.readUInt32BE(20), 630);
  assert.equal(Number(meta['og:image:width']), png.readUInt32BE(16));
  assert.equal(Number(meta['og:image:height']), png.readUInt32BE(20));
});
