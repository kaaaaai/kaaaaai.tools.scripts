# Surge 规则备份与失效资源核查

核查日期：2026-10-15。来源为 Surge“External Resources”截图；截图中部分 URL 被截断，因此只有能还原完整地址的项目做了独立 HTTP 复核。HTTP 200 只证明资源可下载，不证明新版 App 中的过滤效果。

## 可安装的备份

| 用途 | 模块 | 来源与许可 | 说明 |
| --- | --- | --- | --- |
| 哔哩哔哩广告过滤，替代失效的 `bilibili_json.js` | [BiliBili.ADBlock.sgmodule](bilibili-adblock-v0.7.3/BiliBili.ADBlock.sgmodule) | [Biliverse/ADBlock v0.7.3](https://github.com/Biliverse/ADBlock/releases/tag/v0.7.3)，Apache-2.0 | 同版本的 `request.bundle.js`、`response.bundle.js` 和 BoxJS 配置一并保存；模块中的脚本地址已改为本仓库。 |
| B 站等 App 的开屏广告过滤，替代失效的 `bilibili_splash.js` | [startup.sgmodule](blackmatrix7-ads-20261015/startup.sgmodule) | [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script/tree/d8363caa2c1e47fb735615316032bed3f475ee57/script/startup)，GPL-2.0 | `startup.js` 一并保存，模块中的脚本地址已改为本仓库。 |
| 通用广告 URL 拦截，可覆盖部分旧广告集合模块的用途 | [Advertising.sgmodule](blackmatrix7-ads-20261015/Advertising.sgmodule) | [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script/tree/d8363caa2c1e47fb735615316032bed3f475ee57/rewrite/Surge/Advertising)，GPL-2.0 | 模块没有远程脚本依赖；覆盖范围与旧集合不完全相同。 |
| 知乎去广告及页面整理，替代失效的 `Zhihu.Adblock.js`、`Zhihu_Plus.js` | [zheye.sgmodule](blackmatrix7-ads-20261015/zheye.sgmodule) | [blackmatrix7/ios_rule_script](https://github.com/blackmatrix7/ios_rule_script/tree/d8363caa2c1e47fb735615316032bed3f475ee57/script/zheye)，GPL-2.0 | 模块已备份，但脚本仍引用作者的 Gist；核查时该 Gist 返回 200。这项备份并非完全离线可用。 |

安装时使用上述模块文件在本仓库的 Raw URL。建议停用功能重叠的旧模块，避免多条重写同时处理同一响应。

## 截图中的失效项

| 项目 | 核查结果 | 处理情况 |
| --- | --- | --- |
| `Zhihu.Adblock.js`、`baiduCloud.adblock.js` | 从旧模块还原的两个 `ddgksf2013` Gist 地址均返回 404。 | 知乎有上述功能相近的替代；百度网盘脚本尚无经验证的等效替代。 |
| `suishouji.js`、`bilibili_json.js`、`redbook_json.js`、`v2ex.js` | 从旧模块还原的 `ddgksf2013` 地址均返回 404。 | 哔哩哔哩有上述替代；其余暂不声称等效。 |
| `fly.js` | 截图中的 GitLab 地址返回 403，并非 404。 | 权限或访问限制原因未确定；未备份。 |
| `Goodbility.Vip1`、`BuyiTunesVip`、`RevenueCatVip` | 截图显示 404。作者 README 中的新域名链接现在返回资源索引 HTML，而非 JavaScript。 | 未找到可验证的等效脚本，未备份。 |
| `myBlockAds`、`weibo`、`smzdm_remove_ads`、`Bilibili_开屏去广告`、`知乎_处理用户信息` | 截图显示 404；因原 URL 被截断，未逐条复核完整地址。 | 通用广告、开屏广告和知乎有上述功能相近的替代；其他功能待原模块文件核对。 |

`blackmatrix7` 文件的原始许可见 [LICENSE](blackmatrix7-ads-20261015/LICENSE)；`Biliverse` 文件的原始许可见 [LICENSE](bilibili-adblock-v0.7.3/LICENSE)。所有第三方文件保留其原作者信息。这里没有上传个人订阅或私有配置。
