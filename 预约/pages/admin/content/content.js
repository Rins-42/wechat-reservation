const { getAll } = require('../../../utils/data');
// 管理员内容页面 - 添加/编辑物品信息
Page({
    // 页面数据定义
    data: {
        itemId: "", // 物品ID（编辑模式时使用）
        item: {
            name: "", // 物品名称
            description: "", // 物品描述
            categoryId: "", // 分类ID
            requireApproval: true, // 是否需要审批
            advanceBookingDays: 30 // 可提前预约天数
        },
        categories: [], // 分类列表
        categoryIndex: -1, // 当前选中的分类索引
        submitting: false // 提交状态（防止重复提交）
    },

    // 页面加载时执行
    onLoad: function(options) {
        // 加载分类数据
        this._categoriesReady = this.loadCategories();
        
        // 根据是否有itemId判断是编辑模式还是添加模式
        if (options.itemId) {
            this.setData({
                itemId: options.itemId
            });
            this.loadItem(options.itemId);
        } else {
            // 添加模式，监听默认设置
            this.getOpenerEventChannel().on("defaultSettings", (settings) => {
                if (settings) {
                    this.setData({
                        "item.requireApproval": settings.requireApproval !== false,
                        "item.advanceBookingDays": settings.advanceBookingDays || 30
                    });
                }
            });
        }
    },

    // 加载物品信息
    async loadItem(itemId) {
        try {
            const db = wx.cloud.database();
            const result = await db.collection("items").doc(itemId).get();
            const itemData = result.data;
            
            await this._categoriesReady;
            // 查找对应的分类索引
            const categoryIndex = this.data.categories.findIndex(
                category => category._id === itemData.categoryId
            );
            
            // 更新页面数据
            this.setData({
                item: {
                    ...itemData,
                    requireApproval: itemData.requireApproval !== false,
                    advanceBookingDays: itemData.advanceBookingDays || 30
                },
                categoryIndex
            });
            
        } catch (error) {
            console.error("加载项目失败：", error);
            wx.showToast({
                title: "加载失败",
                icon: "none"
            });
        }
    },

    // 加载分类列表
    async loadCategories() {
  try {
    const categories = await getAll(wx.cloud.database().collection('categories').orderBy('createTime','desc'));
    this.setData({categories,categoryIndex:categories.length ? 0 : -1});
  } catch(error) { console.error('加载分类失败',error); wx.showToast({title:'加载分类失败',icon:'none'}); }
},

    // 分类选择变化处理
    onCategoryChange(e) {
        this.setData({
            categoryIndex: parseInt(e.detail.value)
        });
    },

    // 物品名称输入处理
    onNameInput(e) {
        this.setData({
            "item.name": e.detail.value
        });
    },

    // 物品描述输入处理
    onDescriptionInput(e) {
        this.setData({
            "item.description": e.detail.value
        });
    },

    // 审批要求开关变化处理
    onApprovalChange(e) {
        this.setData({
            "item.requireApproval": e.detail.value
        });
    },

    // 预约天数输入处理
    onDaysInput(e) {
        this.setData({
            "item.advanceBookingDays": parseInt(e.detail.value) || 30
        });
    },

    // 提交表单处理
    async submitForm() {
        if (this.data.submitting) return;
        const { item, categories, categoryIndex } = this.data;
        
        // 表单验证：检查物品名称是否为空
        if (!item.name.trim()) {
            wx.showToast({
                title: "请输入项目名称",
                icon: "none"
            });
            return;
        }
        
        // 表单验证：检查是否选择了分类
        if (!categories[categoryIndex]) {
            wx.showToast({
                title: "请选择分类",
                icon: "none"
            });
            return;
        }
        
        // 表单验证：检查预约天数是否有效
        if (isNaN(item.advanceBookingDays) || item.advanceBookingDays < 1) {
            wx.showToast({
                title: "请输入有效的预约天数",
                icon: "none"
            });
            return;
        }
        
        // 设置提交状态为true，防止重复提交
        this.setData({
            submitting: true
        });
        
        try {
            const db = wx.cloud.database();
            const submitData = {
                name: item.name,
                description: item.description,
                categoryId: categories[categoryIndex]._id,
                requireApproval: item.requireApproval,
                advanceBookingDays: item.advanceBookingDays,
                updateTime: db.serverDate()
            };
            
            const itemsCollection = db.collection("items");
            
            // 根据是否有itemId决定是更新还是新增
            if (this.data.itemId) {
                // 更新现有物品
                await itemsCollection.doc(this.data.itemId).update({
                    data: submitData
                });
            } else {
                // 添加新物品
                await itemsCollection.add({
                    data: {
                        ...submitData,
                        createTime: db.serverDate()
                    }
                });
            }
            
            // 提交成功处理
            wx.showToast({
                title: this.data.itemId ? "更新成功" : "添加成功",
                icon: "success"
            });
            
            // 1.5秒后返回上一页
            setTimeout(() => {
                wx.navigateBack();
            }, 1500);
            
        } catch (error) {
            // 提交失败处理
            console.error("保存失败：", error);
            wx.showToast({
                title: "保存失败",
                icon: "none"
            });
        } finally {
            // 无论成功失败，重置提交状态
            this.setData({
                submitting: false
            });
        }
    }
});
