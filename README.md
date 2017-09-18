# AlbumMaker
Slack に写真を上げると、そっから Google Photo に上がって、その生の画像の URL を Dropbox Paper の対象のドキュメントに追記してくれる
jpeg、png、gif 等ならいけるっぽい

## 使い方
1. 環境変数に色々指定して起動する、すると…
2. 動く

## 現時点での注意
- Slack に連続して写真を上げると Paper Document の Revision が一致しなくなって死ぬ
- Paper 内の対象のドキュメントが編集され続けている状態で動作すると Paper Document の Revision が一致しなくなって死ぬ
- 稀に Google Photo API 周りで不定期に死ぬ
- 動画を上げると死ぬ
