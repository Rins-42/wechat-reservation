// 小程序端逐页读取，避免列表只显示默认返回的第一页。
async function getAll(query, pageSize = 20) {
  const data = [];
  for (let offset = 0; ; offset += pageSize) {
    const result = await query.skip(offset).limit(pageSize).get();
    const rows = result.data || [];
    data.push(...rows);
    if (rows.length < pageSize) return data;
  }
}
function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth()+1) + '-' + pad(date.getDate()) + ' ' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
module.exports = { getAll, formatDateTime };
