const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { reservationId } = event


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
          message: '无权操作此预约'
        }
      }
    }

    if (reservation.status !== 'using') {
      const statusMap = {
        'pending': '预约待审核',
        'approved': '预约已通过但未开始使用',
        'rejected': '预约已被拒绝',
        'cancelled': '预约已取消',
        'returned': '预约已归还'
      }
      return {
        success: false,
        error: 'INVALID_STATUS',
        message: statusMap[reservation.status] || '预约状态不正确'
      }
    }

    const updateData = {
      status: 'returned',
      actualEndTime: db.serverDate(),
      updateTime: db.serverDate()
    }

    await db.collection('reservations').doc(reservationId).update({
      data: updateData
    })


    return {
      success: true,
      message: '归还成功'
    }
  } catch (error) {
    console.error('归还预约失败:', error)
    return {
      success: false,
      error: 'SYSTEM_ERROR',
      message: '系统错误，请重试',
      detail: error.message
    }
  }
}
