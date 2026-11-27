const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const openid = wxContext.OPENID
    const unionid = wxContext.UNIONID
    const appid = wxContext.APPID


    const result = {
      openid,
      unionid,
      appid,
      success: true
    }

    return result
  } catch (error) {
    console.error('登录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
