const { getAll } = require('../../utils/data');
// 预约页面 - 物品预约功能
Page({
        // 页面数据定义
        data: {
            items: [], // 所有物品列表
            filteredItems: [], // 过滤后的物品列表
            selectedItems: [], // 选中的物品ID列表
            selectedItemsDetails: [], // 选中的物品详细信息
            categories: [], // 分类列表
            currentCategory: null, // 当前选中的分类
            startDate: "", // 开始日期
            startTime: "", // 开始时间
            endDate: "", // 结束日期
            endTime: "", // 结束时间
            startDateDisplay: "", // 开始日期显示格式
            endDateDisplay: "", // 结束日期显示格式
            minDate: "", // 最小可选日期
            maxDate: "", // 最大可选日期
            loading: true, // 加载状态
            existingReservations: [], // 现有预约记录
            showReservationList: false, // 是否显示预约列表
            purpose: "", // 预约用途
            purposeLength: 0 // 用途文本长度
        },
        
        // 获取星期几
        getWeekDay: function(date) {
            return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()]
        },
        
        // 格式化日期（包含星期几）
        formatDateWithWeekDay: function(date) {
            if (!date) return "";
            var weekDay = this.getWeekDay(date);
            return "".concat(this.formatDate(date), " ").concat(weekDay)
        },
        
        // 更新日期显示
        updateDateDisplay: function() {
            var startDate = this.data.startDate ? new Date(this.data.startDate) : new Date,
                endDate = this.data.endDate ? new Date(this.data.endDate) : new Date;
            this.setData({
                startDateDisplay: this.formatDateWithWeekDay(startDate),
                endDateDisplay: this.formatDateWithWeekDay(endDate)
            })
        },
        
        // 页面加载时执行
        onLoad: function() {
            var that = this,
                currentDate = new Date,
                maxDate = new Date;
            maxDate.setDate(currentDate.getDate() + 30);
            var hours = currentDate.getHours(),
                minutes = currentDate.getMinutes(),
                formattedDate = this.formatDate(currentDate),
                startTime = "".concat(String(hours).padStart(2, "0"), ":").concat(String(minutes).padStart(2, "0")),
                endTimeDate = new Date(currentDate);
            endTimeDate.setMinutes(endTimeDate.getMinutes() + 45);
            var endTime = "".concat(String(endTimeDate.getHours()).padStart(2, "0"), ":").concat(String(endTimeDate.getMinutes()).padStart(2, "0"));
            
            // 设置默认日期和时间
            this.setData({
                minDate: this.formatDate(currentDate),
                maxDate: this.formatDate(maxDate),
                startDate: formattedDate,
                endDate: this.formatDate(endTimeDate),
                startTime: startTime,
                endTime: endTime
            }, (function() {
                that.updateDateDisplay()
            })), this.loadItems()
        },
        
        // 页面显示时执行
        onShow: function() {
            var app = getApp();
            // 检查用户信息，如果不存在则检查
            app.globalData.hasUserInfo || app.checkUserInfo(), this.loadItems()
        },
        // 加载物品和分类数据
        async loadItems() {
  try {
    this.setData({ loading: true });
    const db = wx.cloud.database();
    const [categories, rows] = await Promise.all([getAll(db.collection('categories').orderBy('_id', 'asc')), getAll(db.collection('items').orderBy('_id', 'asc'))]);
    const selectedItems = this.data.selectedItems.filter(id => rows.some(item => item._id === id));
    const items = rows.map(item => ({ ...item, categoryName: (categories.find(cat => cat._id === item.categoryId) || {}).name || '未分类', selected: selectedItems.includes(item._id) }));
    const currentCategory = categories.some(cat => cat._id === this.data.currentCategory) ? this.data.currentCategory : null;
    this.setData({ categories, items, selectedItems, currentCategory, selectedItemsDetails: items.filter(item => selectedItems.includes(item._id)), filteredItems: currentCategory === null ? items : items.filter(item => item.categoryId === currentCategory) });
    this.updateMaxBookingDate(selectedItems, items);
  } catch (error) { console.error('加载物品失败', error); wx.showToast({title:'加载失败',icon:'none'}); }
  finally { this.setData({loading:false}); }
},
        updateMaxBookingDate(selectedItems, allItems) {
            if (selectedItems.length === 0) {
                const maxDate = new Date();
                maxDate.setDate(new Date().getDate() + 30);
                this.setData({
                    maxDate: this.formatDate(maxDate)
                });
                return;
            }

            const minAdvanceDays = Math.min(...selectedItems.map(itemId => {
                const item = allItems.find(item => item._id === itemId);
                return item && item.advanceBookingDays || 30;
            }));

            const maxDate = new Date();
            maxDate.setDate(new Date().getDate() + minAdvanceDays);
            
            this.setData({
                maxDate: this.formatDate(maxDate)
            });
        },
        switchCategory(event) {
            const rawCategoryId = event.currentTarget.dataset.id;
            const categoryId = rawCategoryId === 'null' || rawCategoryId == null ? null : rawCategoryId;
            const { items, selectedItems } = this.data;
            

            // 过滤项目
            let filteredItems = categoryId === null 
                ? items 
                : items.filter(item => {
                    return item.categoryId === categoryId;
                });


            // 标记选中状态
            filteredItems = filteredItems.map(item => ({
                ...item,
                selected: selectedItems.includes(item._id)
            }));

            this.setData({
                currentCategory: categoryId,
                filteredItems
            }, () => {
                if (filteredItems.length === 0) {
                    wx.showToast({
                        title: categoryId ? "该分类下暂无可预约项目" : "暂无可预约项目",
                        icon: "none",
                        duration: 2000
                    });
                }
            });
        },
        onPullDownRefresh: function() {
            this.loadItems().then((function() {
                wx.stopPullDownRefresh()
            }))
        },
        onItemSelect(event) {
            const itemId = event.currentTarget.dataset.id;
            const selectedItems = [...this.data.selectedItems];
            const itemIndex = selectedItems.indexOf(itemId);

            if (itemIndex > -1) {
                selectedItems.splice(itemIndex, 1);
            } else {
                selectedItems.push(itemId);
            }

            const selectedItemsDetails = selectedItems.map(id => {
                const item = this.data.items.find(item => item._id === id);
                return {
                    _id: id,
                    name: item.name,
                    categoryName: item.categoryName,
                    requireApproval: item.requireApproval,
                    advanceBookingDays: item.advanceBookingDays
                };
            });

            this.updateMaxBookingDate(selectedItems, this.data.items);

            this.setData({
                selectedItems,
                selectedItemsDetails,
                filteredItems: this.data.filteredItems.map(item => ({
                    ...item,
                    selected: selectedItems.includes(item._id)
                }))
            }, () => {
                this.loadExistingReservations();
            });
        },
        removeSelectedItem(event) {
            const itemId = event.currentTarget.dataset.id;
            const selectedItems = this.data.selectedItems.filter(id => id !== itemId);
            
            const selectedItemsDetails = selectedItems.map(id => {
                const item = this.data.items.find(item => item._id === id);
                return {
                    _id: id,
                    name: item.name,
                    categoryName: item.categoryName,
                    requireApproval: item.requireApproval,
                    advanceBookingDays: item.advanceBookingDays
                };
            });

            const filteredItems = this.data.filteredItems.map(item => ({
                ...item,
                selected: selectedItems.includes(item._id)
            }));

            this.updateMaxBookingDate(selectedItems, this.data.items);
            this.setData({
                selectedItems,
                selectedItemsDetails,
                filteredItems
            }, () => {
                this.loadExistingReservations();
            });
        },
        onStartDateChange: function(t) {
            var e = this,
                a = t.detail.value;
            this.setData({
                startDate: a,
                endDate: a
            }, (function() {
                e.updateDateDisplay(), e.checkExistingReservations()
            }))
        },
        onStartTimeChange(event) {
            const startTime = event.detail.value;
            const [hours, minutes] = startTime.split(":").map(Number);
            
            const endTimeDate = new Date();
            endTimeDate.setHours(hours);
            endTimeDate.setMinutes(minutes + 45);
            
            const endTime = `${String(endTimeDate.getHours()).padStart(2, "0")}:${String(endTimeDate.getMinutes()).padStart(2, "0")}`;
            
            this.setData({
                startTime,
                endTime
            });
        },
        onEndDateChange: function(t) {
            var e = this;
            this.setData({
                endDate: t.detail.value
            }, (function() {
                e.updateDateDisplay(), e.checkExistingReservations()
            }))
        },
        onEndTimeChange: function(t) {
            var e = new Date("".concat(this.data.startDate, " ").concat(this.data.startTime)),
                a = new Date("".concat(this.data.endDate, " ").concat(t.detail.value));
            this.data.startDate === this.data.endDate && a <= e ? wx.showToast({
                title: "结束时间必须晚于开始时间",
                icon: "none"
            }) : this.setData({
                endTime: t.detail.value
            })
        },
        async checkUserInfo() {
            try {
                const db = wx.cloud.database();
                const result = await db.collection("users").where({
                    _openid: await getApp().getOpenId()
                }).get();

                if (result.data && result.data.length > 0 && result.data[0].realName) {
                    return true;
                }

                wx.showModal({
                    title: "完善信息",
                    content: "请先填写真实姓名才能进行预约",
                    confirmText: "去填写",
                    success: (res) => {
                        if (res.confirm) {
                            wx.navigateTo({
                                url: "/pages/userInfo/userInfo"
                            });
                        }
                    }
                });
                return false;
            } catch (error) {
                console.error("检查用户信息失败：", error);
                return false;
            }
        },
        async checkTimeConflict(startTime, endTime, selectedItems) {
            try {
                const db = wx.cloud.database();
                const _ = db.command;
                const itemIds = selectedItems.map(item => item._id);
                
                const result = await db.collection("reservations").where({
                    status: _.in(["pending", "approved", "using"]),
                    startTime: _.lt(endTime),
                    endTime: _.gt(startTime),
                    "items._id": _.in(itemIds)
                }).get();

                if (!result.data || result.data.length === 0) {
                    return true;
                }

                const conflictItems = [];
                result.data.forEach(reservation => {
                    reservation.items.forEach(item => {
                        if (itemIds.includes(item._id) && !conflictItems.find(conflict => conflict._id === item._id)) {
                            conflictItems.push(item);
                        }
                    });
                });

                if (conflictItems.length > 0) {
                    const itemNames = conflictItems.map(item => item.name).join("、");
                    await wx.showModal({
                        title: "预约冲突提示",
                        content: `${itemNames} 在所选时间段内已被预约，请选择其他时间或更换项目`,
                        showCancel: false
                    });
                    return false;
                }

                return true;
            } catch (error) {
                console.error("检查时间冲突失败：", error);
                wx.showToast({
                    title: "检查预约冲突失败",
                    icon: "none"
                });
                return false;
            }
        },
        async submitReservation() {
            try {
                const userInfoValid = await this.checkUserInfo();
                if (!userInfoValid) {
                    return;
                }

                if (!this.validateForm()) {
                    return;
                }

                wx.showLoading({
                    title: "提交中",
                    mask: true
                });

                try {
                    const startDateTime = new Date(`${this.data.startDate} ${this.data.startTime}`);
                    const endDateTime = new Date(`${this.data.endDate} ${this.data.endTime}`);

                    const result = await wx.cloud.callFunction({
                        name: "submitReservation",
                        data: {
                            items: this.data.selectedItemsDetails,
                            startTime: startDateTime.toISOString(),
                            endTime: endDateTime.toISOString(),
                            purpose: this.data.purpose.trim()
                        }
                    });

                    wx.hideLoading();

                    if (!result.result.success) {
                        switch (result.result.error) {
                            case "TIME_CONFLICT":
                                const conflictNames = result.result.conflictItems.map(item => item.name).join("、");
                                await wx.showModal({
                                    title: "预约冲突提示",
                                    content: `${conflictNames} 在所选时间段内已被预约，请选择其他时间或更换项目`,
                                    showCancel: false
                                });
                                break;
                            case "USER_NOT_FOUND":
                                await wx.showModal({
                                    title: "提示",
                                    content: "请先完善个人信息",
                                    success: (res) => {
                                        if (res.confirm) {
                                            wx.navigateTo({
                                                url: "/pages/userInfo/userInfo"
                                            });
                                        }
                                    }
                                });
                                break;
                            default:
                                wx.showToast({
                                    title: "预约失败，请重试",
                                    icon: "none"
                                });
                        }
                        return;
                    }

                    await this.loadExistingReservations();

                    wx.showToast({
                        title: result.result.requireApproval ? "预约已提交，等待审核" : "预约成功",
                        icon: "success"
                    });

                    setTimeout(() => {
                        wx.navigateBack();
                    }, 1500);

                } catch (error) {
                    wx.hideLoading();
                    console.error("提交预约失败：", error);
                    wx.showToast({
                        title: "系统错误，请重试",
                        icon: "none"
                    });
                }
            } catch (error) {
                console.error("提交预约失败：", error);
                wx.showToast({
                    title: "系统错误，请重试",
                    icon: "none"
                });
            }
        },
        validateForm() {
            if (this.data.selectedItems.length === 0) {
                wx.showToast({
                    title: "请选择预约项目",
                    icon: "none"
                });
                return false;
            }

            if (!this.data.purpose.trim()) {
                wx.showToast({
                    title: "请填写使用用途",
                    icon: "none"
                });
                return false;
            }

            const startDateTime = new Date(`${this.data.startDate} ${this.data.startTime}`);
            const endDateTime = new Date(`${this.data.endDate} ${this.data.endTime}`);

            if (startDateTime < new Date()) {
                wx.showToast({
                    title: "开始时间不能早于当前时间",
                    icon: "none"
                });
                return false;
            }

            if (endDateTime <= startDateTime) {
                wx.showToast({
                    title: "结束时间必须晚于开始时间",
                    icon: "none"
                });
                return false;
            }

            return true;
        },
        async loadExistingReservations() {
            this.setData({
                existingReservations: [],
                showReservationList: false
            });

            if (this.data.selectedItems.length === 0) {
                return;
            }

            try {
                wx.showLoading({
                    title: "加载预约信息..."
                });

                const db = wx.cloud.database();
                const _ = db.command;

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                const endDate = new Date(today);
                endDate.setDate(today.getDate() + 7);
                endDate.setHours(23, 59, 59, 999);


                let allReservations = [];
                const pageSize = 20;
                let skip = 0;
                let hasMore = true;

                while (hasMore) {
                    const result = await db.collection("reservations").where({
                        status: _.in(["pending", "approved", "using"]),
                        startTime: _.gte(today).and(_.lte(endDate)),
                        "items._id": _.in(this.data.selectedItems)
                    }).skip(skip).limit(pageSize).orderBy("startTime", "asc").get();


                    if (result.data && result.data.length > 0) {
                        allReservations = allReservations.concat(result.data);
                    }

                    if (result.data.length < pageSize) {
                        hasMore = false;
                    } else {
                        skip += pageSize;
                    }
                }

                if (allReservations.length === 0) {
                    this.setData({
                        showReservationList: false
                    });
                    return;
                }

                const processedReservations = allReservations.map(reservation => {
                    const startTime = new Date(reservation.startTime);
                    const endTime = new Date(reservation.endTime);
                    const items = reservation.items.filter(item => 
                        this.data.selectedItems.includes(item._id)
                    );

                    return {
                        ...reservation,
                        dateStr: this.formatDate(startTime),
                        timeStr: `${this.formatTime(startTime)} - ${this.formatTime(endTime)}`,
                        items,
                        userName: reservation.userInfo ? reservation.userInfo.realName : "未知用户"
                    };
                }).filter(reservation => reservation.items.length > 0);


                const groupedByDate = {};
                processedReservations.forEach(reservation => {
                    const date = reservation.dateStr;
                    if (!groupedByDate[date]) {
                        groupedByDate[date] = [];
                    }
                    groupedByDate[date].push(reservation);
                });

                const sortedDates = Object.keys(groupedByDate).sort();
                const finalData = sortedDates.map(date => ({
                    date,
                    items: groupedByDate[date].sort((a, b) => 
                        new Date(a.startTime) - new Date(b.startTime)
                    )
                }));


                if (finalData.length > 0) {
                    this.setData({
                        existingReservations: finalData,
                        showReservationList: true
                    });
                }

            } catch (error) {
                console.error("加载已有预约失败：", error);
                wx.showToast({
                    title: "加载预约信息失败",
                    icon: "none",
                    duration: 2000
                });
            } finally {
                wx.hideLoading();
            }
        },
        formatDate(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        },
        formatTime(time) {
            const hours = String(time.getHours()).padStart(2, "0");
            const minutes = String(time.getMinutes()).padStart(2, "0");
            return `${hours}:${minutes}`;
        },
        onPurposeInput(event) {
            const value = event.detail.value;
            this.setData({
                purpose: value,
                purposeLength: value.length
            });
        }
    });
