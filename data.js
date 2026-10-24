// 架空の街の施設・事故・証言。位置の正典は生成画像に合わせた map-layout.js です。
import { MAP_LAYOUT } from './map-layout.js';
// 地図の操作感・表示の調整値。倍率はすべて「画像1pxが画面何pxになるか」の値（displayScale）で比べる。
export const MAP_CONFIG = {
  width: MAP_LAYOUT.width, height: MAP_LAYOUT.height, image: MAP_LAYOUT.image,
  maxZoom: 5.5, zoomStep: 1.4, metersPerPixel: 1.6, scaleBarPixels: 80,
  // displayScale がこの値以上で町名（district）・施設名と番地（street）を表示する。
  districtLabelScale: 0.45, streetLabelScale: 0.9,
  // 縮尺表示に使う切りのよい距離（m）。
  scaleUnits: [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000],
  // 拡大縮小しても画面上で一定に見せるラベルの大きさ（px）。
  labelFontSize: 14, labelStrokeWidth: 3, townFontSize: 16,
  // 施設・目撃を選んだときの最低ズームと、選択地点を寄せる表示枠内の位置（幅・高さに対する割合）。
  focusZoomNarrow: 2.3, focusZoomWide: 1.5, focusNarrowMaxWidth: 600,
  focusSideBySideMinWidth: 760, focusXSideBySide: 0.32, focusXStacked: 0.5, focusY: 0.4,
  // ホイール1単位あたりのズーム感度と、矢印キー1回の移動量（px）。
  wheelZoomSensitivity: 0.0013, keyboardPanPixels: 65
};
export const TOWNS = ['西山台', '北町', '本町', '中央', '東町', '緑町', '新町', '南町', '港南', '凪浜町'];
export const TOWN_LABELS = MAP_LAYOUT.townLabels;
const building = (id, name, town, chome, lot, built, extra = {}) => ({
  id, name, town, chome, lot, built, floors: 4, use: '事務所・店舗',
  elevator: '乗用エレベーター／更新済み', ...extra, ...MAP_LAYOUT.buildings[id]
});
export const BUILDINGS = [
  building('central', '三栖田中央ビル', '中央', 1, 4, 1988, { floors: 8 }),
  building('sunheights', 'サンハイツ新町', '新町', 2, 12, 1996, { use: '共同住宅' }),
  building('station', '三栖田駅 南口連絡通路', '中央', 2, 1, 2003, { floors: 2, use: '駅連絡施設' }),
  building('station-north', '三栖田駅北口ビル', '中央', 1, 6, 2002, { floors: 6 }),
  building('warehouse', '凪浜物流 第二倉庫', '凪浜町', 2, 8, 1985, { use: '倉庫', floors: 3 }),
  building('housing', '北町市営住宅', '北町', 2, 9, 1982, { use: '共同住宅', floors: 7 }),
  building('library', '市立図書館', '西山台', 1, 7, 1995, { use: '図書館', floors: 3 }),
  building('medical', '東町メディカルセンター', '東町', 1, 3, 2005, { use: '診療所', floors: 6 }),
  building('shopping', '緑町ショッピングセンター', '緑町', 2, 8, 1990, { use: '商業施設', floors: 3 }),
  building('hall', '三栖田会館', '中央', 2, 2, 1978, { use: '集会所', floors: 5, elevator: '乗用／1978年設置・2016年制御更新' }),
  building('residence', '西山台レジデンス', '西山台', 1, 5, 2001, { use: '共同住宅', floors: 6 }),
  building('south', '南町第一ビル', '南町', 1, 8, 1981, { floors: 5 }),
  building('west-heights', '西山台ハイツ', '西山台', 3, 5, 1994, { use: '共同住宅', floors: 5 }),
  building('cold-storage', '港南冷蔵 旧棟', '港南', 2, 11, 1976, { use: '倉庫', floors: 4, elevator: '荷物用／1976年設置・事故後使用停止' }),
  building('green-housing', '緑町公営住宅', '緑町', 1, 3, 1989, { use: '共同住宅', floors: 6 }),
  building('department', '旧・三栖田百貨店', '中央', 3, 5, 1972, { use: '空き店舗', floors: 6, elevator: '乗用／1972年設置・現在運休' }),
  building('east-third', '東町第三ビル', '東町', 3, 2, 1975, { floors: 5, elevator: '乗用／1975年設置・事故後撤去' }),
  building('south-house', '南町荘', '南町', 3, 9, 1986, { use: '共同住宅', floors: 4 }),
  building('first', '旧・本町保守事務所', '本町', 1, 6, 1968, { use: '保守会社旧事務所', floors: 4, elevator: '乗用／1968年設置・事故後封鎖' }),
  building('hospital', '市立三栖田病院', '東町', 1, 6, 2011, { use: '病院', floors: 9 }),
  building('city-hall', '三栖田市役所', '中央', 1, 9, 2008, { use: '市役所', floors: 7 }),
  building('school', '三栖田市立第二小学校', '北町', 3, 2, 1984, { use: '学校', floors: 3, elevator: '乗用／2015年設置' }),
  building('post', '三栖田中央郵便局', '緑町', 3, 4, 1999, { use: '郵便局', floors: 3 }),
  building('hotel', '三栖田ステーションホテル', '南町', 2, 7, 2007, { use: 'ホテル', floors: 10 }),
  building('east-hall', '東町合同ビル', '東町', 2, 5, 1973, { floors: 6, elevator: '乗用／2018年に設備一式を更新' }),
  building('seaside', '凪浜第一倉庫', '凪浜町', 3, 2, 1971, { use: '倉庫', floors: 2, elevator: '荷物用／2017年撤去' }),
  building('pump', '港南ポンプ場', '港南', 3, 4, 1970, { use: 'ポンプ施設', floors: 2, elevator: '昇降設備なし' }),
  building('new-office', '凪浜テクノセンター', '凪浜町', 1, 4, 2014, { floors: 8 }),
  building('community', '南町交流センター', '南町', 2, 3, 2006, { use: '公共施設', floors: 3 }),
  building('park-office', '西山自然公園 管理棟', '西山台', 2, 1, 2001, { use: '公園施設', floors: 2, elevator: '乗用／2001年設置' }),
  building('nagihama-third', '旧凪浜第三ビル', '凪浜町', 3, 6, 1974, {
    floors: 5, use: '旧事務所ビル', elevator: '乗用／1974年設置・設備更新記録なし',
    note: '現在は入居者なし。東西の隣接区画は空地。南側に旧道が通る。'
  })
];
export const TARGET_BUILDING_ID = 'nagihama-third';
export const TARGET_BUILDING = BUILDINGS.find(item => item.id === TARGET_BUILDING_ID);
export const addressOf = item => '三栖田市' + item.town + item.chome + '丁目' + item.lot + '番地';
// 投稿フォームの丁目・番地の選択肢。施設の最大値までの連番にし、正解だけが目立たないようにする。
const rangeUpTo = max => Array.from({ length: max }, (_, index) => index + 1);
export const CHOME_OPTIONS = rangeUpTo(Math.max(...BUILDINGS.map(item => item.chome)));
export const LOT_OPTIONS = rangeUpTo(Math.max(...BUILDINGS.map(item => item.lot)));

const accident = (id, buildingId, date, type, body, source, comments = []) => ({
  id, buildingId, date, type, body, source, comments
});
export const ACCIDENTS = [
  accident('MS-018', 'central', '2026-08-24', '急停止・閉じ込め',
    '午前8時40分ごろ、3階と4階の間でかごが急停止。乗員3名は約50分後に救出された。制御盤の不具合が確認され、部品交換後に運転を再開した。', '三栖田日報／2026年8月25日',
    ['閉じ込められた人、無事でよかった。', 'また黒い服の男の人が見に来てたよ。', 'それ、ここの管理人さんじゃない？']),
  accident('MS-017', 'sunheights', '2025-11-06', '戸開走行',
    '午後6時15分ごろ、扉が開いたまま、かごが約30センチ上昇した。住人1名が転倒し軽傷。安全装置の点検のため運転を休止した。', '新町自治会報',
    ['住んでる友達に聞いたけど、もう直ってるって。', '普通にけがをする事故もあるんだよな。']),
  accident('MS-016', 'station', '2025-03-18', '閉じ込め',
    '駅南口の連絡通路でエレベーターが停止。利用者2名は約35分後に救出され、けがはなかった。電源装置の不具合が原因とみられる。', '三栖田交通 設備のお知らせ',
    ['駅のやつもか。', '終電の後に動いてるって話は、このエレベーター？']),
  accident('MS-015', 'warehouse', '2024-09-12', 'かご落下・行方不明',
    '荷物用昇降機が3階から最下部へ落下。乗っていた作業員1名の所在が分からなくなった。救助隊が大きく損壊したかごを確認したが、内部は無人だった。', '三栖田日報／2024年9月13日',
    ['あの落ち方だったら普通は助からないだろ。', '中にいなかったなら、どこに行ったんだ。']),
  accident('MS-014', 'housing', '2023-07-02', '停電・閉じ込め',
    '落雷による停電後、5階付近で停止。非常電源への切替が作動せず、住人4名が約1時間後に救出された。', '市営住宅管理事務所',
    ['この辺、全部停電してた日だ。', '全員見つかったならいい。']),
  accident('MS-013', 'library', '2022-05-20', '段差による転倒',
    '2階で停止した際に床との間に段差が生じ、利用者1名が転倒。着床位置のセンサーを調整した。', '市立図書館 施設管理報告',
    ['図書館にもあったんですね。']),
  accident('MS-012', 'medical', '2021-12-03', '扉の挟まれ',
    '1階の乗り場で扉が閉まり、利用者1名が腕を負傷した。戸閉時の検知装置に不具合が確認された。', '施設管理者のお知らせ',
    ['ここは事故後すぐ更新してる。']),
  accident('MS-011', 'shopping', '2021-10-13', '浸水・閉じ込め',
    '大雨による機械室への浸水で停止。従業員2名が閉じ込められたが、保守会社により救出された。復旧まで11日間休止。', '三栖田地域新聞',
    ['地下に水が入ったやつ。けが人はいません。']),
  accident('MS-010', 'hall', '2021-06-04', '異常走行・行方不明',
    '午後9時過ぎ、乗員1名を乗せたかごが最上階から急降下した。安全装置で停止した後、救助隊が扉を開けたが乗員は見つからなかった。', '三栖田日報／2021年6月5日',
    ['ここ、乗る前に変な音がするって有名だった。', 'ノイズみたいな音？', '誰か録音してないの。']),
  accident('MS-009', 'residence', '2021-02-15', '急停止',
    '地震の影響で緊急停止。乗員1名が転倒し打撲を負った。保守点検後、翌日から運転を再開。', '管理組合 事故報告',
    ['新しい建物でも止まる時は止まる。']),
  accident('MS-008', 'south', '2020-08-09', '閉じ込め',
    '高温により制御装置が停止。乗員1名が約40分間閉じ込められ、体調不良で搬送された。機械室の換気設備を改修した。', '三栖田市消防活動記録',
    ['真夏にこれはきつい。']),
  accident('MS-007', 'west-heights', '2020-04-21', '戸開走行',
    '1階で乗降中にかごが下降。住人1名が転倒し負傷した。ブレーキ部品の摩耗が確認された。', '管理組合 事故報告',
    ['古い設備のまま使ってる所、まだあるのかな。']),
  accident('MS-006', 'cold-storage', '2020-02-07', '昇降路内事故・行方不明',
    '保守作業中に支持装置が破損し、かごが落下。作業員1名が行方不明となった。昇降路内を捜索したが発見には至らず、旧棟は使用停止となった。', '三栖田日報／2020年2月8日',
    ['ニュースで見た。設備の壊れ方がひどかった。', '見つからないのが本当に分からない。']),
  accident('MS-005', 'green-housing', '2019-11-30', '急停止・閉じ込め',
    '住人2名を乗せたエレベーターが階の途中で停止。救出後、制御装置の不具合が判明した。', '三栖田市住宅課 管理記録',
    ['この事故は全員無事だった。']),
  accident('MS-004', 'department', '2019-08-17', '扉の挟まれ',
    '地下売場のエレベーターで、従業員が扉に手を挟まれ負傷した。百貨店は翌年閉店し、現在は空き店舗となっている。', '三栖田地域新聞 縮刷版',
    ['今は入れません。配信目的で行くのはやめてください。']),
  accident('MS-003', 'east-third', '2019-06-03', 'かご落下・行方不明',
    '乗員2名を乗せたかごが落下。救助隊到着時、かごは大きく変形していたが内部は無人だった。2名の行方は現在も分かっていない。', '三栖田日報／2019年6月4日',
    ['事故の前から不思議な音がしてた場所らしい。', '耳では聞こえるのにスマホには入らないとか。', 'これ以降、エレベーターおとこって言われ始めた気がする。']),
  accident('MS-002', 'south-house', '2019-02-26', '停電・閉じ込め',
    '停電の復旧後もエレベーターが作動せず、住人1名が閉じ込められた。約1時間後に救出され、けがはなかった。', '南町自治会だより',
    ['非常通話がつながらなかったらしい。点検は大切だね。']),
  accident('MS-001', 'first', '2018-11-27', '点検中の事故・行方不明',
    '午後8時過ぎ、エレベーターの点検をしていた30代男性が行方不明になった。点検中にかごが落下したとみられ、救助隊が到着した時には内部に誰もいなかった。現場周辺でも男性は見つかっていない。', '三栖田日報／2018年11月28日',
    ['いつもこの辺りで点検していた技師さんですよね。', 'すごく古いエレベーターにも詳しい人だった。', '帰ってきてほしい。'])
];
export const getBuilding = id => BUILDINGS.find(item => item.id === id);
export function recordsForSnapshot(snapshot, dates) {
  const cutoff = dates[snapshot];
  return ACCIDENTS.filter(item => item.date <= cutoff);
}

const sighting = (id, buildingId, date, title, body, location) => ({
  id, buildingId, date, title, body, location, source: '市民から寄せられた情報',
  ...MAP_LAYOUT.sightingLocations[buildingId]
});
export const SIGHTINGS = [
  sighting('SI-001', 'first', '2019-03-02', '保守事務所の前で聞き込みをする男性',
    '旧保守事務所の前の路地で、30代くらいの男性が通行人に話を聞いていた。「以前ここで働いていた技師のことを知りませんか」と尋ねられたという。',
    '旧・本町保守事務所の南東側の路地'),
  sighting('SI-002', 'east-third', '2019-06-04', '事故翌日、現場近くにいた男性',
    '事故の翌日、ビル西側の歩道で黒い上着の男性が長い時間立っていた。建物を見上げたり、手帳に何かを書き込んだりしていたという。',
    '東町第三ビルの西側の歩道'),
  sighting('SI-003', 'hall', '2021-06-05', '会館の前で同じ男性を見かけた',
    '前日の事故について聞いて回る男性を、会館の東側の道で見かけたという情報。「別の事故現場でも見た人に似ている」との書き込みが寄せられた。',
    '三栖田会館の東側の道'),
  sighting('SI-004', 'cold-storage', '2024-09-14', '倉庫の近くで写真を撮っていた男性',
    '使用停止になった旧棟の南側の道路で、黒い服の男性が建物を撮影していた。立入規制の内側には入らず、近くにいた人に以前の事故について尋ねていたらしい。',
    '港南冷蔵・旧棟南側の道路'),
  sighting('SI-005', 'station', '2025-03-19', '終電後に動いていたエレベーター',
    '終電が出た後、南口の連絡通路で無人のエレベーターが上がってきたという目撃情報。目撃した人はかごの中を確認できず、そのまま駅を離れたという。',
    '三栖田駅・南口の駅前広場'),
  sighting('SI-006', 'central', '2026-08-25', '事故の後に現れた黒い上着の男性',
    '事故の翌日、中央ビル東側の歩道で建物の写真を撮る男性が目撃された。市民掲示板では「エレベーターおとこでは」「ここの管理人さんでは」と意見が分かれている。',
    '三栖田中央ビルの東側の歩道')
];
export function sightingsForSnapshot(snapshot, dates) {
  if (snapshot === 'live') return SIGHTINGS;
  return SIGHTINGS.filter(item => item.date <= dates[snapshot]);
}
