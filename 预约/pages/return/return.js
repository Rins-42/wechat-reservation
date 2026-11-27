// 归还页面 - 查看和管理预约记录
const app = getApp();

Page({
    // 页面数据定义
    data: {
        reservations: [], // 预约记录列表
        statusMap: {
            pending: "待审核",
            approved: "已通过",
            rejected: "已拒绝",
            using: "使用中",
            returned: "已归还",
            cancelled: "已取消"
        }, // 预约状态映射表
        loading: true // 加载状态
    },
    
    // 页面加载时执行
    onLoad() {
        this.loadReservations();
    },
    
    // 页面显示时执行
    onShow() {
        // 检查用户信息，如果不存在则检查
        if (!app.globalData.hasUserInfo) {
            app.checkUserInfo();
        }
        this.loadReservations();
    },
    
    // 下拉刷新处理
    onPullDownRefresh() {
        this.loadReservations().then(() => {
            wx.stopPullDownRefresh(); // 停止下拉刷新动画
        });
    },
    
    // 格式化日期时间为YYYY-MM-DD HH:MM格式
    formatDateTime(date) {
        if (!date) return "";
        try {
            // 处理字符串类型的日期
            if (typeof date === "string") {
                date = new Date(date);
            }
            // 验证日期有效性
            if (isNaN(date.getTime())) return "";
            
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        } catch (error) {
            console.error("日期格式化失败:", error);
            return "";
        }
    },
    
    // 加载预约记录
    async loadReservations() {
        try {
            this.setData({
                loading: true
            });
            
            // 调用云函数获取用户预约记录
            const result = await wx.cloud.callFunction({
                name: "getReservations",
                data: {
                    type: "user" // 获取当前用户的预约记录
                }
            });
            
            const reservationsData = result.result;
            
            // 验证数据格式
            if (!Array.isArray(reservationsData)) {
                console.error("预约数据格式错误");
                throw new Error("预约数据格式错误");
            }
            
            // 检查并取消超时预约
            await this.checkAndCancelOverdueReservations(reservationsData);
            
            // 处理预约数据
            const processedReservations = reservationsData.map(reservation => {
                try {
                    if (!reservation) {
                        throw new Error("预约记录为空");
                    }
                    
                    // 转换日期对象
                    const startTime = reservation.startTime ? new Date(reservation.startTime) : null;
                    const endTime = reservation.endTime ? new Date(reservation.endTime) : null;
                    const actualStartTime = reservation.actualStartTime ? new Date(reservation.actualStartTime) : null;
                    const actualEndTime = reservation.actualEndTime ? new Date(reservation.actualEndTime) : null;
                    
                    // 处理物品信息
                    let items = [];
                    if (Array.isArray(reservation.items) && reservation.items.length > 0) {
                        items = reservation.items.map(item => ({
                            _id: item._id || "",
                            name: item.name || "未知项目",
                            categoryName: item.categoryName || "未知分类"
                        }));
                    } else if (Array.isArray(reservation.itemIds) && reservation.itemIds.length > 0) {
                        items = reservation.itemIds.map(itemId => ({
                            _id: itemId,
                            name: "未知项目",
                            categoryName: "未知分类"
                        }));
                    }
                    
                    
                    // 构建处理后的预约记录对象
                    const processedReservation = {
                        _id: reservation._id || "",
                        status: reservation.status || "pending",
                        statusText: this.data.statusMap[reservation.status || "pending"],
                        startTime: startTime,
                        endTime: endTime,
                        actualStartTime: actualStartTime,
                        actualEndTime: actualEndTime,
                        startTimeStr: this.formatDateTime(startTime),
                        endTimeStr: this.formatDateTime(endTime),
                        actualStartTimeStr: this.formatDateTime(actualStartTime),
                        actualEndTimeStr: this.formatDateTime(actualEndTime),
                        items: items,
                        purpose: reservation.purpose || ""
                    };
                    
                    return processedReservation;
                } catch (error) {
                    console.error("处理单条预约记录失败:", error);
                    // 返回错误信息记录
                    return {
                        _id: (reservation && reservation._id) || "",
                        status: "error",
                        statusText: "数据错误",
                        items: [],
                        error: error.message
                    };
                }
            }).filter(Boolean); // 过滤掉空记录
            
            
            // 更新页面数据
            this.setData({
                reservations: processedReservations,
                loading: false
            });
            
        } catch (error) {
            console.error("加载预约记录失败:", error);
            wx.showToast({
                title: error.message || "加载失败",
                icon: "error",
                duration: 2000
            });
            
            this.setData({
                loading: false,
                reservations: []
            });
        }
    },
    
    // 检查并取消超时预约
    async checkAndCancelOverdueReservations(reservations) {
        try {
            const now = new Date();
            // 筛选超时预约：状态为已批准且未实际开始使用，且当前时间超过结束时间
            const overdueReservations = reservations.filter(reservation => {
                if (reservation.status !== "approved" || reservation.actualStartTime) {
                    return false;
                }
                const endTime = new Date(reservation.endTime);
                return now > endTime;
            });
            
            if (overdueReservations.length > 0) {
                
                // 并行取消所有超时预约
                const cancelPromises = overdueReservations.map(reservation => 
                    wx.cloud.callFunction({
                        name: "cancelReservation",
                        data: {
                            reservationId: reservation._id,
                            reason: "预约超时自动取消"
                        }
                    })
                );
                
                const results = await Promise.all(cancelPromises);
                const cancelledIds = new Set(overdueReservations.filter((item,index) => results[index].result && results[index].result.success).map(item => item._id));
                
                // 更新本地预约状态
                reservations.forEach(reservation => {
                    if (cancelledIds.has(reservation._id)) {
                        reservation.status = "cancelled";
                    }
                });
                
                // 显示取消提示
                if (cancelledIds.size > 0) {
                    wx.showToast({
                        title: `${cancelledIds.size}个超时预约已自动取消`,
                        icon: "none",
                        duration: 3000
                    });
                }
            }
        } catch (error) {
            console.error("处理超时预约失败:", error);
        }
    },
    
    // 获取状态文本
    getStatusText(status) {
        return this.data.statusMap[status] || status;
    },
    
    // 开始使用预约物品
    async startUsing(event) {
        try {
            const reservationId = event.currentTarget.dataset.id;
            if (!reservationId) {
                throw new Error("预约ID无效");
            }
            
            wx.showLoading({
                title: "处理中...",
                mask: true
            });
            
            // 调用云函数开始使用预约
            const result = await wx.cloud.callFunction({
                name: "startUsingReservation",
                data: {
                    reservationId: reservationId
                }
            });
            
            wx.hideLoading();
            
            // 处理云函数返回结果
            if (result && result.result && result.result.success) {
                wx.showToast({
                    title: "开始使用成功",
                    icon: "success"
                });
                // 刷新预约列表
                await this.loadReservations();
            } else {
                throw new Error((result && result.result && result.result.message) || "操作失败");
            }
            
        } catch (error) {
            wx.hideLoading();
            console.error("开始使用失败:", error);
            wx.showToast({
                title: error.message || "操作失败",
                icon: "error",
                duration: 2000
            });
        }
    },
    
    // 归还预约物品
    async returnItems(event) {
        try {
            const reservationId = event.currentTarget.dataset.id;
            if (!reservationId) {
                throw new Error("预约ID无效");
            }
            
            wx.showLoading({
                title: "处理中...",
                mask: true
            });
            
            // 调用云函数归还预约
            const result = await wx.cloud.callFunction({
                name: "returnReservation",
                data: {
                    reservationId: reservationId
                }
            });
            
            wx.hideLoading();
            
            // 处理云函数返回结果
            if (result && result.result && result.result.success) {
                wx.showToast({
                    title: "归还成功",
                    icon: "success"
                });
                // 刷新预约列表
                await this.loadReservations();
            } else {
                throw new Error((result && result.result && result.result.message) || "操作失败");
            }
            
        } catch (error) {
            wx.hideLoading();
            console.error("归还失败:", error);
            wx.showToast({
                title: error.message || "操作失败",
                icon: "error",
                duration: 2000
            });
        }
    },
    
    // 取消预约
    async cancelReservation(event) {
  try {
    const reservationId = event.currentTarget.dataset.id;
    if (!reservationId) throw new Error('预约ID无效');
    const answer = await wx.showModal({ title:'确认取消',content:'确定要取消这个预约吗？',confirmText:'确定取消',cancelText:'再想想' });
    if (!answer.confirm) return;
    const response = await wx.cloud.callFunction({ name:'cancelReservation',data:{reservationId} });
    if (!response.result || !response.result.success) throw new Error((response.result || {}).message || '取消失败');
    wx.showToast({ title:'取消成功',icon:'success' });
    await this.loadReservations();
  } catch (error) { console.error('取消失败',error); wx.showToast({title:error.message || '操作失败',icon:'none'}); }
}
});
