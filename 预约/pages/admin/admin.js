const { getAll, formatDateTime } = require('../../utils/data');
// 管理员页面 - 管理分类、物品和预约记录
Page({
        // 页面数据定义
        data: {
            currentTab: "categories", // 当前选中的标签页：categories/items/reservations
            categories: [], // 分类列表
            items: [], // 物品列表
            reservations: [], // 预约记录列表
            categoryIndex: 0, // 当前选中的分类索引
            newCategory: "", // 新增分类名称
            searchKeyword: "", // 搜索关键词
            searchTimeout: null, // 搜索防抖定时器
            newItem: { // 新增物品信息
                name: "",
                description: "",
                categoryId: ""
            },
            // 预约状态映射表
            statusMap: {
                pending: "待审核",
                approved: "已通过",
                rejected: "已拒绝",
                using: "使用中",
                returned: "已归还",
                cancelled: "已取消"
            },
            // 工具函数集合
            
            pageSize: 20, // 每页显示数量
            loading: false, // 加载状态
            hasMore: true, // 是否还有更多数据
            currentPage: 1, // 当前页码
            showBatchModal: false, // 是否显示批量设置弹窗
            isDefaultSettings: false, // 是否使用默认设置
            batchSettings: { // 批量设置
                requireApproval: true,
                advanceBookingDays: 30
            },
            defaultSettings: { // 默认设置
                requireApproval: true,
                advanceBookingDays: 30
            },
            selectedItems: [] // 选中的物品列表
        },
        
        // 页面加载时执行
        onLoad() { this.loadDefaultSettings(); },
        
        // 页面显示时执行
        onShow: function() {
            this.refreshCurrentTab()
        },
        // 加载初始数据
        async loadInitialData() { return this.loadData(); },
        
        // 刷新当前标签页数据
        refreshCurrentTab() {
            this.setData({
                currentPage: 1,
                hasMore: true,
                selectedItems: [],
                items: this.data.items.map(item => ({
                    ...item,
                    selected: false
                }))
            }, () => {
                this.loadData();
            });
        },
        
        // 加载当前标签页数据
        async loadData() {
  if (this.data.loading || !this.data.hasMore) return;
  this.setData({loading:true});
  const methods = {categories:'loadCategories',items:'loadItems',reservations:'loadReservations'};
  return this[methods[this.data.currentTab]]();
},
        
        // 切换标签页
        switchTab(event) {
            const tab = event.currentTarget.dataset.tab;
            if (tab !== this.data.currentTab) {
                this.setData({
                    currentTab: tab,
                    currentPage: 1,
                    hasMore: true
                }, () => {
                    this.loadData();
                });
            }
        },
        
        // 页面滚动到底部时触发（加载更多）
        onReachBottom() {
            if (!this.data.loading && this.data.hasMore) {
                this.setData({
                    currentPage: this.data.currentPage + 1
                }, () => {
                    this.loadData();
                });
            }
        },
        
        // 下拉刷新
        onPullDownRefresh() {
            this.refreshCurrentTab();
        },
        async loadCategories() {
            const db = wx.cloud.database();
            const { pageSize, currentPage } = this.data;
            
            try {
                const result = await db.collection("categories")
                    .orderBy("createTime", "desc")
                    .skip((currentPage - 1) * pageSize)
                    .limit(pageSize)
                    .get();
                
                const countPromises = result.data.map(category => 
                    db.collection("items").where({ categoryId: category._id }).count()
                );
                
                const counts = await Promise.all(countPromises);
                
                const categories = result.data.map((category, index) => ({
                    ...category,
                    itemCount: counts[index].total,
                    expanded: false,
                    items: []
                }));
                
                this.setData({
                    categories: currentPage === 1 ? categories : this.data.categories.concat(categories),
                    loading: false,
                    hasMore: categories.length === pageSize
                });
            } catch (error) {
                console.error("加载分类失败：", error);
                this.showError("加载分类失败");
            } finally {
                this.setData({ loading: false });
                wx.stopPullDownRefresh();
            }
        },
        async toggleCategoryExpand(event) {
            const categoryId = event.currentTarget.dataset.id;
            const categories = this.data.categories;
            const categoryIndex = categories.findIndex(cat => cat._id === categoryId);
            
            if (categoryIndex === -1) return;
            
            const category = categories[categoryIndex];
            const expanded = !category.expanded;
            
            this.setData({
                [`categories[${categoryIndex}].expanded`]: expanded
            });
            
            if (expanded && (!category.items || category.items.length === 0)) {
                await this.loadCategoryItems(categoryId, categoryIndex);
            }
        },
        async loadCategoryItems(categoryId, categoryIndex) {
  try {
    wx.showLoading({title:'加载中'});
    const items = await getAll(wx.cloud.database().collection('items').where({categoryId}).orderBy('createTime','desc'));
    this.setData({[`categories[${categoryIndex}].items`]:items});
  } catch(error) { this.showError('加载项目失败'); }
  finally { wx.hideLoading(); }
},
        async loadItems() {
            const db = wx.cloud.database();
            const { pageSize, currentPage, searchKeyword } = this.data;
            const command = db.command;
            
            try {
                let categoryIds = [];
                
                if (searchKeyword) {
                    const categoryResult = await db.collection("categories")
                        .where({
                            name: db.RegExp({
                                regexp: searchKeyword,
                                options: "i"
                            })
                        })
                        .field({ _id: true })
                        .get();
                    categoryIds = categoryResult.data.map(cat => cat._id);
                }
                
                let query = {};
                if (searchKeyword) {
                    const conditions = [
                        { name: db.RegExp({ regexp: searchKeyword, options: "i" }) },
                        { description: db.RegExp({ regexp: searchKeyword, options: "i" }) }
                    ];
                    
                    if (categoryIds.length > 0) {
                        conditions.push({ categoryId: command.in(categoryIds) });
                    }
                    
                    query = command.or(conditions.filter(Boolean));
                }
                
                const result = await db.collection("items")
                    .where(query)
                    .orderBy("createTime", "desc")
                    .skip((currentPage - 1) * pageSize)
                    .limit(pageSize)
                    .get();
                
                if (result.data.length === 0) {
                    this.setData({
                        loading: false,
                        hasMore: false,
                        items: currentPage === 1 ? [] : this.data.items
                    });
                    return;
                }
                
                const uniqueCategoryIds = Array.from(new Set(result.data.map(item => item.categoryId)));
                const categoryPromises = uniqueCategoryIds.map(categoryId => 
                    db.collection("categories").doc(categoryId).get()
                );
                
                const categories = await Promise.all(categoryPromises);
                
                const items = result.data.map(item => {
                    const category = categories.find(cat => cat.data && cat.data._id === item.categoryId);
                    return Object.assign({}, item, {
                        selected: false,
                        createTimeStr: formatDateTime(item.createTime),
                        categoryName: (category && category.data && category.data.name) || "未分类"
                    });
                });
                
                this.setData({
                    items: currentPage === 1 ? items : this.data.items.concat(items),
                    loading: false,
                    hasMore: items.length === pageSize
                });
            } catch (error) {
                console.error("加载项目失败：", error);
                this.showError("加载项目失败");
            } finally {
                this.setData({ loading: false });
                wx.stopPullDownRefresh();
            }
        },
        async loadReservations() {
  const { pageSize, currentPage } = this.data;
  try {
    const response = await wx.cloud.callFunction({ name:'getReservations',data:{type:'admin',limit:pageSize,skip:(currentPage-1)*pageSize} });
    if (!Array.isArray(response.result)) throw new Error((response.result || {}).message || '获取预约失败');
    const reservations = response.result.map(row => ({...row,userInfo:{realName:row.userName},startTimeStr:formatDateTime(row.startTime),endTimeStr:formatDateTime(row.endTime),actualStartTimeStr:formatDateTime(row.actualStartTime),actualEndTimeStr:formatDateTime(row.actualEndTime)}));
    this.setData({reservations:currentPage === 1 ? reservations : this.data.reservations.concat(reservations),hasMore:reservations.length === pageSize});
  } catch(error) { console.error('加载预约失败',error); this.showError(error.message || '加载预约失败'); }
  finally { this.setData({loading:false}); wx.stopPullDownRefresh(); }
},
        async addCategory() {
            try {
                const categoryName = this.data.newCategory.trim();
                if (!categoryName) {
                    this.showError("请输入分类名称");
                    return;
                }
                
                wx.showLoading({ title: "添加中" });
                
                await wx.cloud.database().collection("categories").add({
                    data: {
                        name: categoryName,
                        createTime: wx.cloud.database().serverDate()
                    }
                });
                
                this.showSuccess("添加成功");
                this.setData({
                    newCategory: ""
                });
                this.refreshCurrentTab();
            } catch (error) {
                console.error("添加分类失败：", error);
                this.showError("添加失败");
            } finally {
                wx.hideLoading();
            }
        },
        deleteCategory(event) {
            const categoryId = event.currentTarget.dataset.id;
            const category = this.data.categories.find(cat => cat._id === categoryId);
            
            if (category && category.itemCount > 0) {
                this.showError("该分类下还有项目，请先删除或移动项目");
                return;
            }
            
            const that = this;
            
            wx.showModal({
                title: "确认删除",
                content: "确定要删除这个分类吗？",
                success: async function(result) {
                    if (result.confirm) {
                        try {
                            wx.showLoading({ title: "删除中" });
                            await wx.cloud.database().collection("categories").doc(categoryId).remove();
                            that.showSuccess("删除成功");
                            that.refreshCurrentTab();
                        } catch (error) {
                            console.error("删除分类失败：", error);
                            that.showError("删除失败");
                        } finally {
                            wx.hideLoading();
                        }
                    }
                }
            });
        },
        async addItem() {
            if (!this.data.newItem.name.trim()) {
                this.showError("请输入项目名称");
                return;
            }
            if (!this.data.newItem.categoryId) {
                this.showError("请选择分类");
                return;
            }
            
            try {
                wx.showLoading({ title: "添加中" });
                
                const db = wx.cloud.database();
                await db.collection("items").add({
                    data: Object.assign({}, this.data.newItem, {
                        createTime: db.serverDate(),
                        updateTime: db.serverDate()
                    })
                });
                
                this.showSuccess("添加成功");
                this.setData({
                    newItem: {
                        name: "",
                        description: "",
                        categoryId: ""
                    }
                });
                this.refreshCurrentTab();
            } catch (error) {
                console.error("添加项目失败：", error);
                this.showError("添加失败");
            } finally {
                wx.hideLoading();
            }
        },
        deleteItem(event) {
            const itemId = event.currentTarget.dataset.id;
            const that = this;
            
            wx.showModal({
                title: "确认删除",
                content: "确定要删除这个项目吗？",
                success: async function(result) {
                    if (result.confirm) {
                        try {
                            wx.showLoading({ title: "删除中" });
                            await wx.cloud.database().collection("items").doc(itemId).remove();
                            that.showSuccess("删除成功");
                            that.refreshCurrentTab();
                        } catch (error) {
                            console.error("删除项目失败：", error);
                            that.showError("删除失败");
                        } finally {
                            wx.hideLoading();
                        }
                    }
                }
            })
        },
        approveReservation(event) {
            const reservationId = event.currentTarget.dataset.id;
            const that = this;
            
            wx.showModal({
                title: "确认通过",
                content: "确定要通过这个预约吗？",
                success: async function(result) {
                    if (result.confirm) {
                        try {
                            wx.showLoading({ title: "处理中" });
                            const db = wx.cloud.database();
                            await db.collection("reservations").doc(reservationId).update({
                                data: {
                                    status: "approved",
                                    updateTime: db.serverDate()
                                }
                            });
                            that.showSuccess("已通过");
                            that.refreshCurrentTab();
                        } catch (error) {
                            console.error("通过预约失败：", error);
                            that.showError("操作失败");
                        } finally {
                            wx.hideLoading();
                        }
                    }
                }
            })
        },
        rejectReservation(event) {
            const reservationId = event.currentTarget.dataset.id;
            const that = this;
            
            wx.showModal({
                title: "确认拒绝",
                content: "确定要拒绝这个预约吗？",
                success: async function(result) {
                    if (result.confirm) {
                        try {
                            wx.showLoading({ title: "处理中" });
                            const db = wx.cloud.database();
                            await db.collection("reservations").doc(reservationId).update({
                                data: {
                                    status: "rejected",
                                    updateTime: db.serverDate()
                                }
                            });
                            that.showSuccess("已拒绝");
                            that.refreshCurrentTab();
                        } catch (error) {
                            console.error("拒绝预约失败：", error);
                            that.showError("操作失败");
                        } finally {
                            wx.hideLoading();
                        }
                    }
                }
            })
        },
        async updateReservationStatus(reservationId, status) {
            try {
                wx.showLoading({ title: "处理中" });
                const db = wx.cloud.database();
                await db.collection("reservations").doc(reservationId).update({
                    data: {
                        status: status,
                        updateTime: db.serverDate()
                    }
                });
                this.showSuccess("操作成功");
                this.refreshCurrentTab();
            } catch (error) {
                console.error("更新预约状态失败：", error);
                this.showError("操作失败");
            } finally {
                wx.hideLoading();
            }
        },
        onCategoryNameInput: function(e) {
            this.setData({
                newCategory: e.detail.value
            })
        },
        onCategoryChange: function(e) {
            var t = parseInt(e.detail.value);
            this.setData({
                categoryIndex: t,
                "newItem.categoryId": this.data.categories[t]._id
            })
        },
        onItemNameInput: function(e) {
            this.setData({
                "newItem.name": e.detail.value
            })
        },
        onItemDescInput: function(e) {
            this.setData({
                "newItem.description": e.detail.value
            })
        },
        validateItemForm: function() {
            return this.data.newItem.name && "" !== this.data.newItem.name.trim() ? 0 === this.data.categories.length ? (this.showError("请先添加分类"), !1) : !!this.data.categories[this.data.categoryIndex] || (this.showError("请选择有效的分类"), !1) : (this.showError("请输入项目名称"), !1)
        },
        resetItemForm: function() {
            var e, t = (null === (e = this.data.categories[this.data.categoryIndex]) || void 0 === e ? void 0 : e._id) || "";
            this.setData({
                newItem: {
                    name: "",
                    description: "",
                    categoryId: t
                }
            })
        },
        showError: function(e) {
            wx.showToast({
                title: e,
                icon: "none"
            })
        },
        showSuccess: function(e) {
            wx.showToast({
                title: e,
                icon: "success"
            })
        },
        formatDateTime(date) {
            if (!date) return "";
            if (typeof date === "string") date = new Date(date);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            return `${year}-${month}-${day} ${hours}:${minutes}`;
        },
        async loadDefaultSettings() {
            try {
                const db = wx.cloud.database();
                const result = await db.collection("settings").where({
                    _id: "default_item_settings"
                }).get();
                
                
                if (result.data && result.data.length > 0) {
                    const settings = result.data[0];
                    this.setData({
                        defaultSettings: settings,
                        "batchSettings.requireApproval": settings.requireApproval !== false,
                        "batchSettings.advanceBookingDays": settings.advanceBookingDays || 30
                    });
                } else {
                    this.setData({
                        defaultSettings: {
                            requireApproval: true,
                            advanceBookingDays: 30
                        }
                    });
                }
            } catch (error) {
                console.error("加载默认设置失败：", error);
            }
        },
        showDefaultSettings() {
            this.setData({
                showBatchModal: true,
                isDefaultSettings: true,
                batchSettings: {
                    requireApproval: this.data.defaultSettings.requireApproval !== false,
                    advanceBookingDays: this.data.defaultSettings.advanceBookingDays || 30
                }
            });
        },
        showBatchSettings() {
            if (this.data.selectedItems.length !== 0) {
                this.setData({
                    showBatchModal: true,
                    isDefaultSettings: false
                });
            } else {
                wx.showToast({
                    title: "请先选择项目",
                    icon: "none"
                });
            }
        },
        closeBatchModal() {
            this.setData({
                showBatchModal: false,
                isDefaultSettings: false
            });
        },
        toggleItemSelect(event) {
            const itemId = event.currentTarget.dataset.id;
            const items = this.data.items.map(item => 
                item._id === itemId ? Object.assign({}, item, { selected: !item.selected }) : item
            );
            const selectedItems = items.filter(item => item.selected).map(item => item._id);
            
            this.setData({
                items: items,
                selectedItems: selectedItems
            });
        },
        batchDelete() {
            const that = this;
            
            if (this.data.selectedItems.length === 0) {
                wx.showToast({
                    title: "请先选择项目",
                    icon: "none"
                });
                return;
            }
            
            wx.showModal({
                title: "确认删除",
                content: `是否删除选中的${this.data.selectedItems.length}个项目？`,
                success: async function(result) {
                    if (result.confirm) {
                        try {
                            wx.showLoading({ title: "删除中" });
                            const db = wx.cloud.database();
                            const command = db.command;
                            
                            await db.collection("items").where({
                                _id: command.in(that.data.selectedItems)
                            }).remove();
                            
                            wx.showToast({
                                title: "删除成功",
                                icon: "success"
                            });
                            
                            that.setData({
                                selectedItems: [],
                                items: that.data.items.map(item => Object.assign({}, item, { selected: false }))
                            }, () => {
                                that.refreshCurrentTab();
                            });
                        } catch (error) {
                            console.error("批量删除失败：", error);
                            wx.showToast({
                                title: "删除失败",
                                icon: "none"
                            });
                        } finally {
                            wx.hideLoading();
                        }
                    }
                }
            });
        },
        onBatchApprovalChange(event) {
            this.setData({
                "batchSettings.requireApproval": event.detail.value
            });
        },
        onBatchDaysChange(event) {
            this.setData({
                "batchSettings.advanceBookingDays": parseInt(event.detail.value) || 30
            });
        },
        async saveBatchSettings() {
            try {
                wx.showLoading({ title: "保存中" });
                
                const db = wx.cloud.database();
                const batchSettings = this.data.batchSettings;
                const requireApproval = batchSettings.requireApproval;
                const advanceBookingDays = batchSettings.advanceBookingDays;
                
                
                if (this.data.isDefaultSettings) {
                    
                    const result = await db.collection("settings").where({ _id: "default_item_settings" }).get();
                    
                    if (result.data && result.data.length > 0) {
                        await db.collection("settings").doc(result.data[0]._id).update({
                            data: {
                                requireApproval: requireApproval,
                                advanceBookingDays: advanceBookingDays,
                                updateTime: db.serverDate()
                            }
                        });
                    } else {
                        await db.collection("settings").add({
                            data: {
                                _id: "default_item_settings",
                                requireApproval: requireApproval,
                                advanceBookingDays: advanceBookingDays,
                                createTime: db.serverDate(),
                                updateTime: db.serverDate()
                            }
                        });
                    }
                    
                    this.setData({
                        defaultSettings: { requireApproval, advanceBookingDays }
                    });
                    
                    wx.showToast({
                        title: "默认设置已保存",
                        icon: "success",
                        duration: 2000
                    });
                } else {
                    const command = db.command;
                    await db.collection("items").where({
                        _id: command.in(this.data.selectedItems)
                    }).update({
                        data: {
                            requireApproval: requireApproval,
                            advanceBookingDays: advanceBookingDays,
                            updateTime: db.serverDate()
                        }
                    });
                    
                    wx.showToast({
                        title: "批量更新成功",
                        icon: "success",
                        duration: 2000
                    });
                    this.refreshCurrentTab();
                }
                
                this.closeBatchModal();
            } catch (error) {
                console.error("保存设置失败，详细错误：", error);
                wx.showToast({
                    title: `保存失败：${error.errMsg || error.message || "未知错误"}`,
                    icon: "none",
                    duration: 3000
                });
            } finally {
                wx.hideLoading();
            }
        },
        editItem(event) {
            const itemId = event.currentTarget.dataset.id;
            wx.navigateTo({
                url: `/pages/admin/content/content?itemId=${itemId}`
            });
        },
        editCategory(event) {
            const that = this;
            const { id: categoryId, name: categoryName } = event.currentTarget.dataset;
            
            wx.showModal({
                title: "编辑分类",
                content: "请输入新的分类名称",
                editable: true,
                placeholderText: "分类名称",
                value: categoryName,
                success: async function(result) {
                    if (!result.confirm || !result.content.trim()) {
                        return;
                    }
                    
                    try {
                        wx.showLoading({ title: "保存中" });
                        const db = wx.cloud.database();
                        
                        await db.collection("categories").doc(categoryId).update({
                            data: {
                                name: result.content.trim(),
                                updateTime: db.serverDate()
                            }
                        });
                        
                        that.showSuccess("更新成功");
                        that.refreshCurrentTab();
                    } catch (error) {
                        console.error("更新分类失败：", error);
                        that.showError("更新失败");
                    } finally {
                        wx.hideLoading();
                    }
                }
            });
        },
        onSearchInput(event) {
            const that = this;
            const keyword = event.detail.value;
            
            this.setData({
                searchKeyword: keyword
            });
            
            if (this.data.searchTimeout) {
                clearTimeout(this.data.searchTimeout);
            }
            
            const timeout = setTimeout(() => {
                that.onSearch();
            }, 500);
            
            this.setData({
                searchTimeout: timeout
            });
        },
        onSearch() {
            const that = this;
            this.setData({
                currentPage: 1,
                hasMore: true
            }, () => {
                that.loadItems();
            });
        }
    });
