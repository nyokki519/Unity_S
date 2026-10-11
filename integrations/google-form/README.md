# Googleフォームの受付確認

既存の申込フォームと送信処理は維持します。HPのクリックやno-cors fetch成功は受付完了と扱いません。Googleフォームの実際のonSubmitイベントから、匿名UUIDと回答IDのSHA256だけを確認APIへ送ります。氏名・イベント名・参加日・メールを読み取って送信しません。

## 初期設定（フォーム所有者が一度実施）

1. AnalyticsのSQL014を適用します。Vercel Productionに32文字以上の専用ランダムキー `GROWTH_CONFIRM_TOKEN` を設定し、再デプロイします。既存SEOキーとは別にしてください。秘密値をチャット・Git・公開ファイルに貼らないでください。
2. **実際のGoogleフォーム**からApps Scriptを開き、[GrowthConfirmation.gs](GrowthConfirmation.gs)を貼ります。回答先スプレッドシートのScriptではありません。
3. Script Propertiesに同じ `GROWTH_CONFIRM_TOKEN` を設定し、`setupGrowthTracking()` を実行、Googleの権限を許可します。この処理は任意の匿名ID質問とonSubmitトリガーを作ります。質問・トリガーは重複作成しません。既存申込項目は変更しません。
4. ログに返る **公開情報** `entry.数字` を [tracking-config.js](../../tracking-config.js) の `formEntry:null` と置き換えて、通常commit/pushで公開します。例: `window.UnityGrowthConfig = {formEntry: 'entry.123456789'};`。質問IDからentry名を推測しないでください。
5. 公開フォームをHPから開き、開発者ツールで任意IDのhidden inputが作られることを確認します。架空申込を本番送信する必要はありません。
6. `activateGrowthConfirmation()` を実行します。**公開済みtracking-configのentry一致とトリガー存在**を検証した後にだけ計測開始を登録します。setupだけでは受付確認を開始済みにしません。
7. 通常の実申込後、Analyticsの設定画面で確認します。開始日途中のコホートはpartial_period、開始前は未取得です。フォーム受理と実際の出席は別です。

Insights認証なしでもこの導線計測は利用できます。フォーム直接アクセスはdirect/unknownとして集計されることがあります。sessionStorage、DNT/GPC、JSブロックでは未計測。追跡IDは最大30日、DBは90日保存。複数申込は同じセッションの受付確認として1件に数え、人数や全参加申込の総数ではありません。

## 運用・停止

`onUnityGrowthSubmit` を手動実行せず、Form onSubmit triggerで実行します。失敗時は最大3回再試行し、Apps Script実行履歴のHTTPコードで原因を確認します。本文・token・回答内容はログへ出しません。未知/30日超のUUIDはunmatchedです。回答IDのhashは重複通知を抑制します。

キーの交換はVercelとScript Propertiesの両方へ反映します。計測停止にはtrigger削除・専用キー解除・Analytics `GROWTH_TRACKING_ENABLED=false`。フォームの匿名ID質問を削除する前に `formEntry:null` を公開してください。受付確認の停止後は、管理者が `growth_integrations` のgoogle_form行を削除して未設定状態に戻してください（過去の数値が後から0になるのを防ぐため、履歴は別途保持）。コードのロールバックは通常git revert、force push不要。

## 開発検証

`node --test tests/*.test.cjs` でsetup/activation/非PII通知をモック検証します。HPの `tools/check-growth-browser.py --form-root ../Unity_S` は公開originをローカルファイルへ差し替え、スマホでHP→クリック→フォーム→送信操作を確認します。Googleへの送信もモックなので実回答を作りません。
