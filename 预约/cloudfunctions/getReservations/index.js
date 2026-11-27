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
    const { type, limit = 100, skip = 0 } = event


    let query = {}

    if (type === 'user') {
      const userResult = await db.collection('users').where({
        _openid: openid
      }).field({
        _id: true
      }).get()

      if (!userResult.data || userResult.data.length === 0) {
        return []
      }

      query = {
        userId: userResult.data[0]._id
      }
    } else if (type === 'admin') {
      const adminResult = await db.collection('users').where({
        _openid: openid,
        isAdmin: true
      }).field({
        _id: true
      }).get()

      if (!adminResult.data || adminResult.data.length === 0) {
        return {
          success: false,
          error: 'NOT_ADMIN',
          message: '无权访问'
        }
      }

      query = {}
    } else {
      return {
        success: false,
        error: 'INVALID_TYPE',
        message: '无效的请求类型'
      }
    }

    const result = await db.collection('reservations')
      .where(query)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(limit)
      .get()

    if (!result.data || result.data.length === 0) {
      return []
    }

    const userIds = [...new Set(result.data.map(reservation => reservation.userId))]

    const users = {}
    if (userIds.length > 0) {
      const usersResult = await db.collection('users')
        .where({
          _id: _.in(userIds)
        })
        .field({
          _id: true,
          realName: true,
          name: true,
          avatar: true
        })
        .get()

      if (usersResult.data) {
        usersResult.data.forEach(user => {
          users[user._id] = user
        })
      }
    }

    const reservations = result.data.map(reservation => {
      const user = users[reservation.userId] || {}
      return {
        _id: reservation._id,
        userId: reservation.userId,
        openid: reservation.openid,
        userName: user.realName || user.name || '未知用户',
        userAvatar: user.avatar || '',
        items: reservation.items || [],
        startTime: reservation.startTime,
        endTime: reservation.endTime,
        actualStartTime: reservation.actualStartTime,
        actualEndTime: reservation.actualEndTime,
        purpose: reservation.purpose || '',
        status: reservation.status || 'pending',
        createTime: reservation.createTime,
        updateTime: reservation.updateTime
      }
    })


    return reservations
  } catch (error) {
    console.error('获取预约记录失败:', error)
    return {
      success: false,
      error: 'SYSTEM_ERROR',
      message: '系统错误，请重试',
      detail: error.message
    }
  }
}
