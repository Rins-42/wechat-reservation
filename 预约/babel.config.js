module.exports = {
  // Babel 5兼容配置
  stage: 0, // 启用所有实验性特性
  loose: "all", // 宽松模式
  modules: "common", // 转换为CommonJS模块
  // 目标环境配置
  targets: {
    browsers: ["last 2 versions", "not ie <= 8"]
  }
};
