const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {

    const result = await db.collection('users').where({
      _openid: openid
    }).field({
      isAdmin: true
    }).get()

    let isAdmin = false

    if (result.data && result.data.length > 0) {
      isAdmin = result.data[0].isAdmin || false
    } else {
    }

    return {
      isAdmin,
      openid,
      success: true
    }
  } catch (error) {
    console.error('检查管理员权限失败:', error)
    return {
      isAdmin: false,
      success: false,
      error: error.message
    }
  }
}
