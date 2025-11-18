// 解析频道名称（修复版 - 更精确）
function parseChannelName(channelName, logo) {
  const logoFileName = logo.split('/').pop();
  const result = {
    originalName: channelName,
    dateTime: '',
    competitionName: '',
    title: '',
    teams: '',
    nodeName: ''
  };
  
  if (logoFileName === '爱奇艺体育.png') {
    // 爱奇艺格式: 11月17日00:45世欧预_阿尔巴尼亚vs英格兰
    const match = channelName.match(/^(\d{1,2}月\d{1,2}日\d{1,2}:\d{2})([^_]+)_(.+)$/);
    if (match) {
      result.dateTime = match[1];
      result.competitionName = match[2];
      
      const content = match[3];
      // 检查是否包含"vs"来判断是否为比赛队伍
      if (content.includes('vs')) {
        result.teams = content;
        result.title = content;
      } else {
        result.title = content;
      }
    }
  } else if (logoFileName === '腾讯体育.png') {
    // 腾讯格式: 11月19日08:00_NBA常规赛_勇士vs魔术 柯凡 殳海 炼炼
    // 或: 11月19日08:00_NBA常规赛_勇士vs魔术 英文原音
    // 或: 11月19日11:30_NBA常规赛_爵士vs湖人 二路_皓篮球
    
    // 使用更精确的匹配模式：日期时间_赛事名_比赛队伍 节点名
    const match = channelName.match(/^(\d{1,2}月\d{1,2}日\d{1,2}:\d{2})_([^_]+)_([^ ]+)(?: (.+))?$/);
    if (match) {
      result.dateTime = match[1];
      result.competitionName = match[2];
      result.teams = match[3];
      result.title = match[3];
      
      // 如果有节点名（第4个匹配组）
      if (match[4]) {
        result.nodeName = match[4].trim();
      }
    }
  }
  
  return result;
}
