# wechat-reservation

基于微信小程序与微信云开发的物品预约系统，提供物品选择、预约审核、使用登记和归还管理。

## 功能

| 角色 | 功能 |
| --- | --- |
| 用户 | 填写真实姓名，按分类浏览物品，选择预约时间和用途 |
| 用户 | 查看个人预约，开始使用、归还或取消预约 |
| 管理员 | 管理分类与物品，审核预约，配置审核要求和可提前预约天数 |

预约状态包括待审核、已通过、已拒绝、使用中、已归还和已取消。

## 技术组成

- 前端：JavaScript、WXML、WXSS，包含 6 个页面。
- 后端：微信云开发数据库、7 个 Node.js 云函数，使用 `wx-server-sdk`。
- 检查与测试：Node.js 项目检查脚本和内置测试运行器。

## 快速开始

1. 在 `预约` 目录创建本地配置：

   ```powershell
   Copy-Item config.example.js config.local.js
   Copy-Item project.config.example.json project.config.json
   ```

2. 在 `config.local.js` 中填写自己的云环境 ID，在 `project.config.json` 中填写自己的小程序 AppID。两个本地配置文件已加入 Git 忽略规则。
3. 在微信开发者工具中导入仓库的 **`预约` 子目录**。
4. 在云开发控制台准备 `users`、`categories`、`items`、`reservations`、`settings` 集合，并配置适合业务的数据库权限与查询索引。
5. 确认 `cloudfunctionRoot` 为 `cloudfunctions/`，选择云环境，逐个上传部署云函数并使用云端安装依赖。
6. 编译项目，用测试账号验证预约、审核、开始使用、归还和取消流程。

使用自己的 AppID 与云环境运行独立实例。管理员身份在云端管理，数据库权限应限制普通用户修改管理员标志或他人的预约。

## 目录

| 路径 | 内容 |
| --- | --- |
| `预约/pages/` | 首页、预约、归还、管理、物品编辑、用户信息页面 |
| `预约/cloudfunctions/` | 身份查询、权限检查和预约操作云函数 |
| `预约/utils/` | 分页读取、日期格式化等公共方法 |
| `预约/scripts/` | 项目结构与引用检查 |
| `预约/tests/` | 离线回归测试 |

## 本地检查

安装 Node.js 后，在 `预约` 目录运行：

```powershell
npm run check
npm test
```

这两项检查无需安装 npm 依赖。需要安装项目声明的开发依赖时，使用 `npm ci`；小程序编译、预览和发布通过微信开发者工具完成。

项目此前已通过真机测试。本次代码调整已通过项目检查及 15 项离线测试，尚未重新进行微信开发者工具编译、真机及云端权限验证。

开发配置、云函数接口与验证范围见 [开发说明](DEVELOPMENT.md)。
