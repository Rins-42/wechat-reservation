const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { items, startTime, endTime, purpose } = event


    if (!items || !Array.isArray(items) || items.length === 0) {
      return {
        success: false,
        error: 'INVALID_ITEMS',
        message: '请选择预约项目'
      }
    }

    if (!startTime || !endTime) {
      return {
        success: false,
        error: 'INVALID_TIME',
        message: '请选择预约时间'
      }
    }

    if (!purpose || typeof purpose !== 'string' || purpose.trim() === '') {
      return {
        success: false,
        error: 'INVALID_PURPOSE',
        message: '请填写使用用途'
      }
    }

    const startDate = new Date(startTime)
    const endDate = new Date(endTime)

    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return { success: false, error: 'INVALID_TIME', message: '预约时间格式无效' }
    }

    if (startDate >= endDate) {
      return {
        success: false,
        error: 'INVALID_TIME_RANGE',
        message: '结束时间必须晚于开始时间'
      }
    }

    if (startDate < new Date()) {
      return {
        success: false,
        error: 'INVALID_START_TIME',
        message: '开始时间不能早于当前时间'
      }
    }

    const userResult = await db.collection('users').where({
      _openid: openid
    }).field({
      _id: true,
      realName: true,
      isAdmin: true
    }).get()

    if (!userResult.data || userResult.data.length === 0) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: '用户不存在，请先完善个人信息'
      }
    }

    const user = userResult.data[0]
    if (!user.realName) {
      return {
        success: false,
        error: 'USER_NOT_FOUND',
        message: '请先完善个人信息'
      }
    }

    const itemIds = items.map(item => item._id)
    const conflictResult = await db.collection('reservations').where({
      status: _.in(['pending', 'approved', 'using']),
      startTime: _.lt(endDate),
      endTime: _.gt(startDate),
      'items._id': _.in(itemIds)
    }).get()

    if (conflictResult.data && conflictResult.data.length > 0) {
      const conflictItems = new Set()
      conflictResult.data.forEach(reservation => {
        if (reservation.items && Array.isArray(reservation.items)) {
          reservation.items.forEach(item => {
            if (itemIds.includes(item._id)) {
              conflictItems.add(item.name)
            }
          })
        }
      })

      return {
        success: false,
        error: 'TIME_CONFLICT',
        message: '预约时间冲突',
        conflictItems: Array.from(conflictItems).map(name => ({ name }))
      }
    }

    const itemDetails = await Promise.all(items.map(async (item) => {
      const itemResult = await db.collection('items').doc(item._id).get()
      return {
        _id: item._id,
        name: item.name,
        categoryName: item.categoryName,
        requireApproval: itemResult.data && itemResult.data.requireApproval !== undefined ? itemResult.data.requireApproval : true,
        advanceBookingDays: itemResult.data && itemResult.data.advanceBookingDays !== undefined ? itemResult.data.advanceBookingDays : 30
      }
    }))

    const requireApproval = itemDetails.some(item => item.requireApproval)

    const reservationData = {
      userId: user._id,
      openid: openid,
      items: itemDetails,
      startTime: startDate,
      endTime: endDate,
      purpose: purpose.trim(),
      status: requireApproval ? 'pending' : 'approved',
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    const addResult = await db.collection('reservations').add({
      data: reservationData
    })


    return {
      success: true,
      reservationId: addResult._id,
      requireApproval,
      message: requireApproval ? '预约已提交，等待审核' : '预约成功'
    }
  } catch (error) {
    console.error('提交预约失败:', error)
    return {
      success: false,
      error: 'SYSTEM_ERROR',
      message: '系统错误，请重试',
      detail: error.message
    }
  }
}
