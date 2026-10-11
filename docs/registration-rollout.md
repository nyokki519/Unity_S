# 参加申込改修の導入手順

## 最新方針と実装

メールは入力・送信・収集しない。参加経験を未選択から必須で選び、初参加者には公式LINEの追加が必要であることと、追加後に「初参加/参加希望」とメッセージを送る案内を表示する。リピーターは従来どおり「参加希望」。確認画面・結果画面・コピーボタンが同じ方針に連動する。LINEの友だち追加や送信完了は自動確認しない。

イベント選択／自由入力、入力確認／修正、キーボード・スマートフォン対応、送信結果不明時の案内を実装した。既存のイベント名・日時・お名前の3entryを使い、追加項目がなくても申込できる。registration-config.jsのenabled:trueはこの既存互換モード。任意metadata entryを推測して送らず、匿名計測entryも維持する。

本番Googleへの架空回答、LINE／メール実送信は行っていない。Google編集資格情報がないため、項目追加と実保存は未実施。コード／モックテストの成功は本番設定や受理の証明ではない。

## 公開・導入順

1. **Unity_SとHPのコードを公開する。** 既存3項目の保存を維持し、メール設定を必要としない。公開後のGET確認と画面確認は行うが、架空の本番回答は送らない。HPは個別外部URLを維持し、共通フォームへのリンクのみevent_idを追加する。
2. **Analyticsの公開イベントAPIを追加する。** /api/public/registration-eventsは今月・翌月の開催前イベントを返す。既存の今月API契約は維持する。同じ日程でも異なる公開IDは申込候補に残す。新API未公開の404時だけ今月APIへ戻り、今月のみと表示する。503等では自由入力を案内する。
3. **Analyticsの非公開参加者読取をデプロイ前に検証する。** 既存GOOGLE_SHEETS_CREDENTIALSと回答シートへの閲覧権限を確認する。認証済みSheets APIはread-onlyで許可列のみ読み、メール列は取得しない。/api/participantsは既存CRON_SECRET認証必須、初期HTML/RSCに参加者名を含めない。資格情報不足で匿名gvizへ戻さない。資格情報／共有が未確認のまま変更をデプロイすると参加者表示やLINE読取が止まる。
4. **回答保存先を非公開に移行する。** 認証済み読取、参加者UI、LINEプレビューを確認後、Drive一般アクセスを制限付きにし、ウェブ公開・公開コピーも停止する。ログアウト状態のシート/gviz/CSV等で匿名拒否を検証する。列・タブ非表示だけで保護済みとしない。これらはGoogle所有者操作で、メールなし申込UIの利用開始とは別。

## 任意の参加経験・公開ID保存

Googleへのmetadata保存を有効にする場合だけ、以下を行う。未設定のままでも既存3項目は送信できるが、**同日同名イベントはGoogle保存後に公開IDで区別できない**。完全なID連携には実eventId entryの設定が必要。

1. 既存フォームのApps Scriptへintegrations/google-form/RegistrationSetup.gsを追加する。既存GrowthConfirmation.gsと匿名計測トリガーは残す。
2. 保存先の非公開設定と匿名拒否を検証し、Script PropertiesのUNITY_PRIVATE_DESTINATION_VERIFIEDをtrueにする。これは所有者の確認記録であり、コードだけで匿名拒否を証明するものではない。
3. setupUnityRegistration()を実行する。参加経験・公開イベントID・イベント入力方法の3質問だけを冪等に追加し、実prefill entryを返す。メール質問は作らない。Google側では3質問とも任意とし、旧3項目の送信を拒否しない。既存ヘッダー・回答・トリガーは保持する。
4. 隔離した検証フォームで旧3項目とmetadata付きの両方の保存を確認する。番号を推測せず、実entryをregistration-config.jsのexperience/eventId/modeへ設定する。未設定項目は送信されない。不正・重複設定は送信を止める。
5. ID付き回答は日付＋IDで分け、IDなし旧行を推測照合しない。LINEの新ID通知は初期OFF。管理画面の公開IDと実効OFFを確認し、プレビュー・時刻・旧行との重複を確認後に個別ONする。実LINE送信を検証に使わない。

## 項目対応

| 項目 | 公開設定キー | 現状 |
|---|---|---|
| イベント名 | entries.eventName | entry.1834327533（既存） |
| 参加日 | entries.date | entry.2119680669（JST YYYY-MM-DD） |
| お名前 | entries.name | entry.1786168698（既存） |
| Unityへの参加経験 | entries.experience | 任意追加。UIは未選択から必須 |
| 公開イベントID | entries.eventId | 任意追加。自由入力は空欄 |
| イベント入力方法 | entries.mode | 任意追加。公開イベント／自由入力 |
| 匿名計測ID | UnityGrowthConfig.formEntry | 既存設定を維持 |

メール項目は存在しない。旧設定にemail entryが残っていても送信しない。初参加者のLINEメッセージは初参加/参加希望、リピーターは参加希望。

## 送信結果・復旧

Googleへのno-cors POSTは受理／保存確認ではない。通信が完了した場合は「送信処理を行いました」、中断時は「送信結果を確認できません」と表示する。自動再送せずLINEへ案内する。画面内では入力を保持し、ページを離れると個人入力を消去する。未送信フォームは戻った際に初期化し、送信操作済みは再送しない案内と正しいLINEメッセージを保つ。

UI停止はenabled:falseを公開する。既存の回答・追加列・質問・計測履歴を削除しない。非公開化後のシートを復旧のために再公開しない。

## 開発検証

- Unity_S: node --test tests/*.test.cjs、python tools/check-registration-browser.py。
- HP: Node、SEO Python、python tools/check-monthly-events.py、python tools/check-growth-browser.py --form-root /workspace/Unity_S。
- Analytics: npm test、npm run typecheck、npm run build。ローカル本番buildを起動しpython tools/check-registration-admin-browser.py --base-url http://127.0.0.1:3101。

ブラウザーテストはPlaywright/Chromiumを使い、外部通信を全てモックする。テストentryは本番設定へ入れない。画像内のイベント・参加者は検証fixture。

## 未実施の外部作業

本番へのマージ／公開、Googleフォームの任意metadata追加・実entry取得、匿名拒否と認証読取の実証、隔離フォームでの実保存。メール用質問・保存・有効化の作業は撤回され、必要ない。Google操作に必要な資格情報はこの環境にはない。
