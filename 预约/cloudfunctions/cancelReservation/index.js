const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { reservationId, reason } = event


    if (!reservationId) {
      return {
        success: false,
        error: 'INVALID_RESERVATION_ID',
        message: '预约ID无效'
      }
    }

    const reservationResult = await db.collection('reservations').doc(reservationId).get()

    if (!reservationResult.data) {
      return {
        success: false,
        error: 'RESERVATION_NOT_FOUND',
        message: '预约记录不存在'
      }
    }

    const reservation = reservationResult.data

    if (reservation.openid !== openid) {
      const userResult = await db.collection('users').where({
        _openid: openid,
        isAdmin: true
      }).get()

      if (!userResult.data || userResult.data.length === 0) {
        return {
          success: false,
          error: 'NO_PERMISSION',
          message: '无权取消此预约'
        }
      }
    }

    if (reservation.status === 'cancelled') {
      return {
        success: false,
        error: 'ALREADY_CANCELLED',
        message: '预约已取消'
      }
    }

    if (reservation.status === 'returned') {
      return {
        success: false,
        error: 'ALREADY_RETURNED',
        message: '预约已归还，无法取消'
      }
    }

    if (reservation.status === 'using') {
      return {
        success: false,
        error: 'IN_USE',
        message: '预约正在使用中，无法取消'
      }
    }

    const updateData = {
      status: 'cancelled',
      cancelReason: reason || '',
      cancelTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    await db.collection('reservations').doc(reservationId).update({
      data: updateData
    })


    return {
      success: true,
      message: '预约已取消'
    }
  } catch (error) {
    console.error('取消预约失败:', error)
    return {
      success: false,
      error: 'SYSTEM_ERROR',
      message: '系统错误，请重试',
      detail: error.message
    }
  }
}
