# 从夯到拉

杀戮尖塔 2 铁甲战士卡牌本地排名工具。

## Commands

```bash
npm install
npm run scrape:sts2
npm run dev
```

验证：

```bash
npm run build
npm run test
npm run test:e2e
```

`npm run scrape:sts2` 会从 `https://slaythespire2.gg/zh/cards` 生成本地卡牌 JSON，并把中文卡图下载到 `public/assets/cards/sts2/ironclad`。应用运行时读取本地文件，不联网。
