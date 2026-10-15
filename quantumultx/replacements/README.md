# Quantumult X 失效重写替代记录

核查日期：2026-10-15。

## 小红书净化与去水印

- 旧地址：`https://github.com/ddgksf2013/Rewrite/raw/master/AdBlock/XiaoHongShuAds.conf`，实测 HTTP 404；原仓库当前树中也没有 `XiaoHongShu` 文件。
- 替代地址：<https://raw.githubusercontent.com/iab0x00/ProxyRules/main/Rewrite/RedBook.snippet>，实测 HTTP 200，SHA-256 `dec23540daa4182f537b98344f00b784e46529ffb9b262202bc34d0e96bd8c0e`。
- 脚本依赖：<https://raw.githubusercontent.com/iab0x00/ProxyRules/main/Script/rednote.js>，实测 HTTP 200，SHA-256 `c3261546380e295344a25ba711421d3da1913b42ebeadb0ad4877c8943f59df5`。
- 核查时的来源提交：[`27fe722`](https://github.com/iab0x00/ProxyRules/commit/27fe722f48d8ba7acee582398f45b34297b65dd6)。规则标注“小红书去广告、去图片视频水印”；脚本包含广告数据处理与 `disable_watermark` 字段设置。尚未在目标 App 中验证实际效果。

来源仓库未标明再分发许可，因此这里只保存地址、校验值和核查结果，不镜像第三方规则或脚本。个人 Quantumult X 配置保存在私有仓库中。
