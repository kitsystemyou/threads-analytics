# Threads Analytics Dashboard

Meta公式のThreads APIを利用して、自分自身の直近の投稿パフォーマンス（閲覧数、いいね数、エンゲージメント率など）を可視化するSPA（シングルページアプリケーション）です。

## 概要

極力バックエンドでデータを持たない構成とするため、Vite + React を用いてフロントエンドのみで実装しています。
APIアクセス用のアクセストークンは初回起動時に画面から入力し、ブラウザの `localStorage` にのみ保存され、安全に運用可能です。

## 機能

* 直近10件の投稿データ取得 (Threads API `GET /me/threads`)
* 投稿ごとのインサイト取得 (Threads API `GET /{media-id}/insights`)
* エンゲージメント率の自動計算
* 直近の閲覧数やエンゲージメント推移のグラフ表示 (Recharts)

## 環境構築と起動方法

本アプリケーションはNode.js環境で動作します。あらかじめNode.js（v18以上推奨）をインストールしてください。

1. 依存関係のインストール
プロジェクトのルートディレクトリで以下のコマンドを実行し、必要なパッケージをインストールします。

```bash
npm install
```

2. 開発用サーバーの起動
以下のコマンドでローカル開発サーバーを立ち上げます。

```bash
npm run dev
```

起動後、コンソールに表示されるURL（通常は `http://localhost:5173/` ）にブラウザからアクセスしてください。

## トークンの取得について

本アプリをご利用になるには、Threads APIのAccess Tokenが必要です。
Meta for Developersよりアプリを作成し、ご自身のThreadsアカウントを連携してトークンを発行してください。

## 技術スタック

* **Framework**: React (Vite)
* **Styling**: Vanilla CSS (Glassmorphism & Dark Mode)
* **Charts**: Recharts
* **Icons**: Lucide React
