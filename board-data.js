// ARGの調整値と確認用データ。静的プロトタイプのため認証情報もブラウザーへ配信されます。
window.ARG_CONFIG = {
  adminPath: 'archive-933a10092d26a5d633ea1a3a9543544007ab7f58.html',
  storageKey: 'kirihara-arg-v2',
  sessionKey: 'kirihara-admin-session',
  username: 'kanrinin',
  password: 'b4-0917',
  administrator: '霧原市を拠点に取材するフリーライターです。事故のあったエレベーターには、なぜか同じような都市伝説が集まります。公的な記録だけでは拾えない声を、この地図に残しています。寄せられた情報は確認のうえ掲載します。',
  memo: [
    '9月17日。駅南口の連絡通路で、終電後に昇降機が動いたという証言を再確認。保守記録には該当する運転がない。',
    '中央ビルの「B4」という表示と、会館の存在しない階の話は別々の人から聞いた。偶然として片付けるには細部が似すぎている。',
    '情報提供の中に「地下4階」「終電」「鏡」が現れたときだけ、これまでの取材メモと照合して掲示板へ反映する。原文はそのまま掲示しない。',
    'ログイン履歴にも見覚えのない時刻が混じる。消しても手元のメモには残しておく。'
  ],
  // キーワードと管理人名義の掲載文。本文を公開せず、定型の返信または編集済み情報を表示します。
  keywordRules: [
    {id:'b4', keywords:['地下4階','b4'], kind:'返信', title:'管理人からの返信', body:'地下4階という表示について、同じ証言が複数届いています。霧原中央ビルの保守記録をもう一度確認します。'},
    {id:'last-train', keywords:['終電','最終電車'], kind:'管理人による投稿', title:'終電後の連絡通路について', body:'駅南口の連絡通路で、終電後に無人のかごが上がってくるという情報が寄せられました。運転履歴を照会中です。'},
    {id:'mirror', keywords:['鏡','かがみ'], kind:'管理人からの返信', title:'管理人からの返信', body:'鏡に映る人数の話は新町でも聞きました。事故との関係はまだ分かりませんが、記録しておきます。'}
  ]
};
window.RUMORS = [
  {id:'rumor-1', name:'管理人', date:'2026/09/18 21:14', body:'霧原中央ビルで、存在しない「地下4階」が表示されたという話を聞いた。記録を探しています。'},
  {id:'rumor-2', name:'管理人', date:'2026/09/17 23:08', body:'終電後の駅南口。無人のエレベーターが上がってきたという。濡れた靴跡だけが残ったそうです。'}
];
window.LOGIN_HISTORY = Array.from({length: 48}, (_, index) => {
  const time = new Date(2026, 8, 18, 23, 42 - index * 73);
  const pad = value => String(value).padStart(2, '0');
  return {id:`sample-${index + 1}`, date:`${time.getFullYear()}/${pad(time.getMonth()+1)}/${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}`, device:index % 7 === 0 ? '不明な端末' : index % 3 === 0 ? '携帯端末' : '管理人端末', result:index % 7 === 0 ? '記録不明' : 'ログイン成功'};
});
