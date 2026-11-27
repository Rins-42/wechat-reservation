// 用户信息页面 - 管理用户个人信息
Page({
    // 页面数据定义
    data: {
        realName: "", // 用户真实姓名
        userInfo: null // 用户信息对象
    },
    
    // 页面加载时执行
    onLoad() {
        this.loadUserInfo();
    },
    
    // 加载用户信息
    async loadUserInfo() {
        try {
            const db = wx.cloud.database();
            // 根据当前用户的openid查询用户信息
            const result = await db.collection("users").where({
                _openid: await getApp().getOpenId()
            }).get();
            
            // 如果查询到用户信息，更新页面数据
            if (result.data && result.data.length > 0) {
                const user = result.data[0];
                this.setData({
                    realName: user.realName || "",
                    userInfo: user
                });
            }
        } catch (error) {
            console.error("加载用户信息失败：", error);
        }
    },
    
    // 真实姓名输入框变化事件
    onRealNameInput(event) {
        this.setData({
            realName: event.detail.value.trim()
        });
    },
    
    // 保存用户信息
    async saveUserInfo() {
        // 验证真实姓名是否为空
        if (!this.data.realName) {
            wx.showToast({
                title: "请输入真实姓名",
                icon: "none"
            });
            return;
        }
        
        try {
            wx.showLoading({ title: "保存中" });
            const db = wx.cloud.database();
            
            // 判断是更新现有用户信息还是新增用户信息
            if (this.data.userInfo) {
                // 更新现有用户信息
                await db.collection("users").doc(this.data.userInfo._id).update({
                    data: {
                        realName: this.data.realName,
                        updateTime: db.serverDate()
                    }
                });
            } else {
                // 新增用户信息
                await db.collection("users").add({
                    data: {
                        realName: this.data.realName,
                        createTime: db.serverDate(),
                        updateTime: db.serverDate()
                    }
                });
            }
            
            // 更新全局用户信息状态
            getApp().globalData.hasUserInfo = true;
            wx.showToast({
                title: "保存成功",
                icon: "success"
            });
            
            // 保存成功后返回上一页
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
        } catch (error) {
            console.error("保存用户信息失败：", error);
            wx.showToast({
                title: "保存失败",
                icon: "none"
            });
        } finally {
            wx.hideLoading();
        }
    }
});
