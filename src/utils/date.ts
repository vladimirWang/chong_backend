import dayjs from 'dayjs';


// 转换成当天00时00分00秒
export function getBeijingStartOfDay(date: Date) {
  const startOfDay = dayjs(date)
    // .tz('Asia/Shanghai') // 指定时区
    // .tz('Europe/London')
    .startOf('day')
    .utc() // 转回UTC（数据库通常存储UTC时间）
    .toDate();
  
//   console.log('北京时区当天零点（UTC）：', startOfDay);
  return startOfDay;
}

export function getBeijingEndOfDay(date: Date) {
  const startOfDay = dayjs(date)
    // .tz('Asia/Shanghai') // 指定时区
    // .tz('Europe/London')
    .endOf('day')
    .utc() // 转回UTC（数据库通常存储UTC时间）
    .toDate();
  
//   console.log('北京时区当天零点（UTC）：', startOfDay);
  return startOfDay;
}