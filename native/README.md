# Native C++ / Python simulator

元の 2D 質点・バネ格子計算を、パラメーター設定と再実行ができる形に整理した版です。
初期状態は変位・速度ともゼロ。12個の短い力パルスの後、受動共振器の反射・干渉・減衰を計算します。

## 必要環境と実行

Python 3.10以上、C++17対応の g++、NumPy / SciPy / Matplotlib / Pillow が必要です。
動画生成には FFmpeg と日本語フォントも必要です。Linux / macOS / Windows（g++ を PATH に設定、または WSL）が対象です。

```sh
python -m pip install -r native/requirements.txt
python native/run.py --no-render
# MP4 も作る場合（FFmpeg が PATH 上に必要）
python native/run.py
```

実行すると native/ 内の生成物を上書きします。残したい結果は先に別のフォルダーにコピーしてください。
元の設定では 1250×401 点、60 T0、2条件（多層あり・なし）を計算します。
約300 MB以上の生データと動画用の空き領域が必要です。処理は数分以上かかり、動画描画はさらに時間がかかります。
ブラウザ版より重いオフライン解析用です。

## パラメーターを変更

`native/parameters.json` を編集して同じコマンドを再実行します。
別の設定なら `python native/run.py --parameters my-parameters.json --no-render`。

| 名前 | 初期値 | 許容範囲 / 意味 |
|---|---:|---|
| seed | 420731 | 0〜4294967295 の整数。12波源の位置・時刻・符号・振幅を再生成 |
| dt | 0.3 | 0.01〜0.35。小さいほど計算量増大。格子間隔1、基準周期80 |
| layer_mass | 4 | 1〜10。多層部分の質量 |
| layer_stiffness | 2 | 0.1〜2。多層部分のバネ定数 |
| pulse_sigma_periods | 0.225 | 0.1〜0.3。力パルスの幅 / T0 |
| amplitude_scale | 1 | 0.01〜10。全波源の力の倍率 |

上限は固定格子・材料範囲で保守的な時間刻み安定条件を守るためです。
T0=80、格子・層位置・吸収領域・全計算時間・12波源・表示範囲は固定です。
これらの構造変更は C++、解析、描画を一緒に修正する必要があり、JSON だけでは変更しません。
`config.json`、`parameters.h`、`input.txt` は生成物です。編集するのは `parameters.json` です。
振幅を変えても線形モデルです。カラー目盛りは固定なので、大きな振幅は表示で飽和します。

## ファイルと検証

- configure.py: JSON 検証、再現可能な波源と入力・C++ヘッダー生成。
- simulate.cpp: 中央差分の減衰付き時間発展。材料境界のバネは調和平均。
- analyze.py: エネルギー収支、断面整合性、スペクトル、図と summary_data.npz。
- render.py: 同じ場と中央断面から MP4 と PNG を生成。
- ORIGINAL_MODEL.md: 元の設定でのモデル説明と過去の測定値。変更した設定の検証結果ではありません。
- verify_time_step.sh: 通常計算後、刻み0.15で20 T0まで再計算して比較する追加検証。
  これは元の dt=0.3 用です。dtを変更した場合は基準値とコンパイル指定を修正してください。

```sh
python -m unittest discover -s tests -p 'test_native.py' -v
# 元のdt=0.3で通常計算を完了したあとだけ
bash native/verify_time_step.sh
```

生成物は field.bin（float32, frame×101×271）、section.bin（float32, frame×541）、
frame_times.npy（生の時刻）、diagnostics.csv、config.json、validation.json、summary_data.npz、
validation_plots.png、動画・代表フレームです。バイナリーは実行環境のネイティブエンディアンです。
サンプル検査と数値検証は物理的実験との一致や全パラメーターの精度保証ではありません。

日本語フォントが標準位置にない場合は `CAVITY_FONT` と任意の `CAVITY_FONT_BOLD` に
ローカルの CJK フォントファイルを設定してください。未設定なら代替フォントで実行しますが、日本語が欠ける場合があります。

## モデルの範囲

スカラー変位の2D質点・バネ格子であり、Maxwell方程式、偏光、量子光学、レーザー発振ではありません。
利得・非線形性・位相同期・曲面鏡による横閉じ込めはありません。複数の共振成分が残り、最後は減衰します。
外側は固定境界＋減衰パッドです。完全無反射の境界ではありません。
同じ加振力でも多層あり・なしの投入仕事は異なるため、内部エネルギーはそれぞれ波源停止時を1にします。
スペクトルの平均化は解析だけで、場の時間発展には使いません。

明示的な再配布ライセンスは追加していません。依存ライブラリーの権利・ライセンスはそれぞれに従います。
