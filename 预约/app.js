// 从云函数取得真实用户身份；不在查询条件中使用字符串占位符。
App({
  globalData: { isAdmin: false, hasUserInfo: false, openid: null },
  onLaunch() {
    if (!wx.cloud) { console.error('当前基础库不支持云开发'); return; }
    let cloudEnvId;
    try {
      ({ cloudEnvId } = require('./config.local'));
    } catch (error) {
      console.error('请先复制 config.example.js 为 config.local.js，并填写云环境 ID');
      return;
    }
    if (typeof cloudEnvId !== 'string' || !cloudEnvId.trim() || cloudEnvId.startsWith('YOUR_')) {
      console.error('请在 config.local.js 中填写有效的云环境 ID');
      return;
    }
    wx.cloud.init({ env: cloudEnvId.trim(), traceUser: true });
    this.getOpenId().then(() => this.checkUserInfo()).catch(error => console.error('初始化失败', error));
    wx.cloud.callFunction({ name: 'checkAdmin' }).then(response => {
      this.globalData.isAdmin = response.result && response.result.isAdmin === true;
    }).catch(error => console.error('检查管理员失败', error));
  },
  getOpenId() {
    if (this.globalData.openid) return Promise.resolve(this.globalData.openid);
    if (!this._loginPromise) {
      this._loginPromise = wx.cloud.callFunction({ name: 'login' }).then(response => {
        if (!response.result || !response.result.openid) throw new Error('登录未返回用户身份');
        this.globalData.openid = response.result.openid;
        return response.result.openid;
      }).catch(error => { this._loginPromise = null; throw error; });
    }
    return this._loginPromise;
  },
  async checkUserInfo() {
    if (this._checkingUser) return this._checkingUser;
    this._checkingUser = (async () => {
      const openid = await this.getOpenId();
      const result = await wx.cloud.database().collection('users').where({ _openid: openid }).get();
      this.globalData.hasUserInfo = Boolean(result.data && result.data[0] && result.data[0].realName);
      if (!this.globalData.hasUserInfo) {
        const pages = getCurrentPages();
        if (pages.length && pages[pages.length - 1].route === 'pages/userInfo/userInfo') return false;
        const answer = await wx.showModal({ title: '完善信息', content: '请先填写真实姓名', confirmText: '去填写' });
        if (answer.confirm) await wx.navigateTo({ url: '/pages/userInfo/userInfo' });
      }
      return this.globalData.hasUserInfo;
    })().catch(error => { console.error('检查用户信息失败', error); return false; }).finally(() => { this._checkingUser = null; });
    return this._checkingUser;
  }
});
