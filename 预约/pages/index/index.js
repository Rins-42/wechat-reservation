// 首页 - 应用入口页面
const defaultAvatar = "https://mmbiz.qpic.cn/mmbiz/icTdbqWNOwNRna42FI242Lcia07jQodd2FJGIYQfG0LAJGFxM4FbnQP6yfMxBgJ0F3YRqJCJ1aPAK2dQagdusBZg/0";
const app = getApp();

Page({
    // 页面数据定义
    data: {
        motto: "Hello World", // 页面标语
        userInfo: { // 用户信息
            avatarUrl: defaultAvatar, // 用户头像URL
            nickName: "" // 用户昵称
        },
        hasUserInfo: false, // 是否已获取用户信息
        canIUseGetUserProfile: wx.canIUse("getUserProfile"), // 是否支持getUserProfile API
        canIUseNicknameComp: wx.canIUse("input.type.nickname"), // 是否支持昵称输入组件
        isAdmin: false // 是否为管理员
    },
    
    // 点击视图跳转（示例功能）
    bindViewTap() {
        wx.navigateTo({
            url: "../logs/logs"
        });
    },
    
    // 选择头像事件处理
    onChooseAvatar(event) {
        const avatarUrl = event.detail.avatarUrl;
        const nickName = this.data.userInfo.nickName;
        this.setData({
            "userInfo.avatarUrl": avatarUrl,
            // 当昵称和头像都存在且头像不是默认头像时，标记已获取用户信息
            hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatar
        });
    },
    
    // 昵称输入变化事件处理
    onInputChange(event) {
        const nickName = event.detail.value;
        const avatarUrl = this.data.userInfo.avatarUrl;
        this.setData({
            "userInfo.nickName": nickName,
            // 当昵称和头像都存在且头像不是默认头像时，标记已获取用户信息
            hasUserInfo: nickName && avatarUrl && avatarUrl !== defaultAvatar
        });
    },
    
    // 获取用户信息（旧版API）
    getUserProfile() {
        const that = this;
        wx.getUserProfile({
            desc: "展示用户信息",
            success: (result) => {
                that.setData({
                    userInfo: result.userInfo,
                    hasUserInfo: true
                });
            }
        });
    },
    
    // 页面加载时执行
    onLoad() {
        this.checkAdminStatus();
    },
    
    // 页面显示时执行
    onShow() {
        this.checkAdminStatus();
    },
    
    // 检查管理员状态
    checkAdminStatus() {
        const that = this;
        
        // 如果全局状态中已有管理员状态，直接使用
        if (app.globalData.isAdmin) {
            this.setData({
                isAdmin: true
            });
            return;
        }
        
        // 调用云函数检查管理员权限
        wx.cloud.callFunction({
            name: "checkAdmin",
            success: (result) => {
                const isAdmin = result.result.isAdmin;
                that.setData({
                    isAdmin: isAdmin
                });
                // 更新全局状态
                app.globalData.isAdmin = isAdmin;
            },
            fail: (error) => {
                console.error("检查管理员状态失败:", error);
            }
        });
    },
    
    // 跳转到管理员页面
    navigateToAdmin() {
        wx.navigateTo({
            url: "/pages/admin/admin"
        });
    }
});
