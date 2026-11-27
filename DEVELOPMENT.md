# 开发说明

## 工程配置

微信开发者工具项目位于 `预约` 子目录。

| 配置 | 位置 | 用途 |
| --- | --- | --- |
| `appid` | 本地 `预约/project.config.json` | 指定小程序身份，从 `project.config.example.json` 复制创建 |
| `cloudfunctionRoot` | 本地 `预约/project.config.json` | 云函数目录，当前为 `cloudfunctions/` |
| `cloudEnvId` | 本地 `预约/config.local.js` | 选择小程序连接的云环境，从 `config.example.js` 复制创建 |
| `pages` | `预约/app.json` | 注册页面路径与导航顺序 |

`config.local.js`、`project.config.json`、`project.private.config.json`、`.env`、`node_modules`、本地压缩包与小程序安装包不纳入版本管理。示例配置只包含占位值。提交前检查暂存区，避免强制添加本地配置。

## 页面与业务

| 页面 | 路径 | 职责 |
| --- | --- | --- |
| 首页 | `pages/index/index` | 预约、归还与管理员入口 |
| 预约 | `pages/reserve/reserve` | 分类筛选、物品选择、预约时间和用途填写 |
| 我的预约 | `pages/return/return` | 查看记录、开始使用、归还和取消 |
| 管理后台 | `pages/admin/admin` | 分类、物品、预约审核和批量设置 |
| 物品编辑 | `pages/admin/content/content` | 新增或编辑物品 |
| 用户信息 | `pages/userInfo/userInfo` | 填写和更新真实姓名 |

## 云函数

| 函数 | 作用 |
| --- | --- |
| `login` | 返回调用者的微信身份信息 |
| `checkAdmin` | 查询当前用户是否为管理员 |
| `submitReservation` | 校验预约内容及时间冲突，创建预约 |
| `getReservations` | 按用户或管理员身份查询预约列表 |
| `startUsingReservation` | 将符合条件的预约转为使用中 |
| `returnReservation` | 登记归还及实际结束时间 |
| `cancelReservation` | 按权限与状态取消预约 |

部署前确认目标环境，在每个函数目录使用“上传并部署：云端安装依赖”。如果环境中已有部署，先比较代码与配置，再决定更新范围。

## 数据集合

| 集合 | 用途 |
| --- | --- |
| `users` | 微信身份关联、真实姓名、管理员标志 |
| `categories` | 物品分类 |
| `items` | 物品信息、所属分类、审核要求、预约天数限制 |
| `reservations` | 预约人、物品、计划时间、实际时间、用途与状态 |
| `settings` | 默认物品设置 |

集合名可从代码确认；本仓库不提供已验证可直接用于生产环境的数据库权限规则或索引清单。根据实际查询建立索引，并确保普通用户不能修改管理员身份、审核结果或他人的预约。

当前管理员页面仍包含客户端数据库写入操作，部署时需要验证它们与数据库规则的兼容性。服务端预约采用先检查冲突、再写入的流程；高并发场景应进一步验证并发控制。

## 本地验证

在 `预约` 目录执行：

```powershell
npm run check
npm test
```

项目检查覆盖 JavaScript 语法、JSON 格式、页面文件、事件处理器、静态素材与云函数引用。

15 项离线测试覆盖：项目引用完整性、分类筛选、45 条物品分页及分类关联、归还按钮传参、取消失败提示、超时取消部分失败、真实用户身份查询、空分类编辑、并发登录请求复用、无效预约日期拒绝，以及示例配置占位值、本地配置缺失、占位值启动拦截、本地环境配置加载和公开文件敏感标识检查。

项目此前已通过真机测试。本次代码调整的验证使用模拟微信 API，不连接生产数据库；当前提交尚未重新完成真实云环境、权限规则与真机验证。

## 日志与隐私

业务调试日志不输出 OPENID、UNIONID、完整用户资料、预约用途或完整预约记录。身份关联和权限校验仍使用运行时身份数据；移除调试日志不会移除业务所需字段。

## 联调检查

1. 检查 AppID 与云环境对应关系，确认 7 个云函数均已部署。
2. 使用普通账号填写姓名，浏览分类并选择物品。
3. 提交预约，验证审核要求、预约日期限制和冲突提示。
4. 使用管理员账号核对审核、分类管理、物品编辑及批量设置。
5. 验证开始使用、归还、取消与刷新后的状态一致。
6. 验证普通账号无法执行越权查询、审核或管理操作。
7. 在真机上检查日期输入、跨日预约、长列表与异常提示。

## 参考

- [微信开发者工具项目配置](https://developers.weixin.qq.com/miniprogram/dev/devtools/projectconfig.html)
- [微信云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [WXML 数据绑定](https://developers.weixin.qq.com/miniprogram/dev/reference/wxml/data.html)
