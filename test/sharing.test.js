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
  // 画像URLの ?v= はSNSのキャッシュ更新用なので、パス部分だけを公開URLと照合する。
  const imageUrl = new URL(meta['og:image']);
  assert.equal(imageUrl.protocol, 'https:');
  assert.equal(imageUrl.origin + imageUrl.pathname, new URL('assets/ogp.jpg', CONFIG.siteUrl).href);
  assert.match(imageUrl.search, /^(\?v=\d+)?$/u);
  const jpeg = await readFile(new URL('../assets/ogp.jpg', import.meta.url));
  assert.equal(jpeg.subarray(0, 3).toString('hex'), 'ffd8ff');
  // 端末固有のカラープロファイル（ICC）が埋め込まれていると、SNS側の縮小処理で表示が崩れることがあるため含めない。
  assert.ok(!jpeg.includes(Buffer.from('ICC_PROFILE')));
  assert.equal(meta['og:image:type'], 'image/jpeg');
  const { width, height } = readJpegSize(jpeg);
  assert.equal(Number(meta['og:image:width']), width);
  assert.equal(Number(meta['og:image:height']), height);
  // summary_large_image は横長の大きなカードで表示されるため、16:9 前後の比率を保つ。
  assert.ok(width / height >= 1.7 && width / height <= 1.95);
});

// JPEGのフレームヘッダー（SOFマーカー）から画像の幅と高さを読み取る。
function readJpegSize(jpeg) {
  const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 9 < jpeg.length) {
    assert.equal(jpeg[offset], 0xff);
    const marker = jpeg[offset + 1];
    const segmentLength = jpeg.readUInt16BE(offset + 2);
    if (frameMarkers.has(marker)) {
      return { height: jpeg.readUInt16BE(offset + 5), width: jpeg.readUInt16BE(offset + 7) };
    }
    offset += 2 + segmentLength;
  }
  throw new Error('JPEGのフレームヘッダーが見つかりません');
}
