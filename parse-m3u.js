const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 获取M3U数据
async function fetchM3UData(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const parsedUrl = new URL(url);
    
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };
    
    const req = client.request(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.end();
  });
}

// 解析M3U数据
function parseM3U(m3uText) {
  const channels = [];
  const lines = m3uText.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line.startsWith('#EXTINF:')) {
      // 解析频道信息
      const channelInfo = parseExtinf(line);
      
      // 下一行是URL
      if (i + 1 < lines.length) {
        const url = lines[i + 1].trim();
        if (url && !url.startsWith('#')) {
          channels.push({
            ...channelInfo,
            url: url
          });
          i++; // 跳过URL行
        }
      }
    }
  }
  
  return channels;
}

// 解析EXTINF行
function parseExtinf(extinfLine) {
  const result = {};
  
  // 提取tvg-logo
  const logoMatch = extinfLine.match(/tvg-logo="([^"]+)"/);
  if (logoMatch) {
    result.logo = logoMatch[1];
  }
  
  // 提取group-title
  const groupMatch = extinfLine.match(/group-title="([^"]+)"/);
  if (groupMatch) {
    result.group = groupMatch[1];
  }
  
  // 提取频道名称（最后一个逗号后的内容）
  const lastCommaIndex = extinfLine.lastIndexOf(',');
  if (lastCommaIndex !== -1) {
    result.name = extinfLine.substring(lastCommaIndex + 1).trim();
  }
  
  return result;
}

// 过滤频道数据
function filterChannels(channels) {
  const today = new Date();
  const todayStr = `${(today.getMonth() + 1).toString().padStart(2, '0')}月${today.getDate().toString().padStart(2, '0')}日`;
  
  return channels.filter(channel => {
    // 过滤组名
    if (!['冰茶体育', '体育回看'].includes(channel.group)) {
      return false;
    }
    
    // 过滤logo
    if (!channel.logo) return false;
    const logoFileName = channel.logo.split('/').pop();
    if (!['爱奇艺体育.png', '腾讯体育.png'].includes(logoFileName)) {
      return false;
    }
    
    // 对于冰茶体育组，只保留当天的数据
    if (channel.group === '冰茶体育') {
      return channel.name.includes(todayStr);
    }
    
    return true;
  });
}

// 解析频道名称
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
    // 腾讯格式: 11月17日02:00_NFL常规赛_NFL常规赛第十一周redzone达阵区
    // 或: 11月17日02:00_NFL常规赛_海盗vs比尔 杨木
    const match = channelName.match(/^(\d{1,2}月\d{1,2}日\d{1,2}:\d{2})_([^_]+)_(.+)$/);
    if (match) {
      result.dateTime = match[1];
      result.competitionName = match[2];
      
      let content = match[3];
      
      // 检查是否有节点名（空格后的内容）
      const lastSpaceIndex = content.lastIndexOf(' ');
      if (lastSpaceIndex !== -1) {
        const possibleNode = content.substring(lastSpaceIndex + 1);
        // 简单的节点名判断（不包含vs且长度较短）
        if (!possibleNode.includes('vs') && possibleNode.length < 10) {
          result.nodeName = possibleNode;
          content = content.substring(0, lastSpaceIndex).trim();
        }
      }
      
      // 检查是否包含"vs"来判断是否为比赛队伍
      if (content.includes('vs')) {
        result.teams = content;
        result.title = content;
      } else {
        result.title = content;
      }
    }
  }
  
  return result;
}

// 解析日期时间字符串
function parseDateTime(dateTimeStr) {
  const match = dateTimeStr.match(/(\d{1,2})月(\d{1,2})日(\d{1,2}):(\d{2})/);
  if (!match) return null;
  
  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const hour = parseInt(match[3]);
  const minute = parseInt(match[4]);
  
  const now = new Date();
  const year = now.getFullYear();
  
  // 简单处理跨年情况（如果月份小于当前月份，认为是明年）
  const matchYear = month < now.getMonth() + 1 ? year + 1 : year;
  
  return new Date(matchYear, month - 1, day, hour, minute);
}

// 合并相同比赛
function mergeMatches(channels) {
  const matchMap = new Map();
  
  channels.forEach(channel => {
    const parsed = parseChannelName(channel.name, channel.logo);
    
    // 生成匹配键（排除节点名）
    const matchKey = `${parsed.dateTime}_${parsed.competitionName}_${parsed.title}`;
    
    if (!matchMap.has(matchKey)) {
      const now = new Date();
      const matchDateTime = parseDateTime(parsed.dateTime);
      
      let matchStatus = 0;
      if (matchDateTime) {
        const matchTime = matchDateTime.getTime();
        const currentTime = now.getTime();
        const threeHoursLater = matchTime + 3 * 60 * 60 * 1000;
        
        if (currentTime > threeHoursLater) {
          matchStatus = 2; // 已结束
        } else if (currentTime >= matchTime) {
          matchStatus = 1; // 进行中
        } else {
          matchStatus = 0; // 未开始
        }
      }
      
      matchMap.set(matchKey, {
        mgdbId: "",
        pID: channel.url,
        title: parsed.title,
        keyword: parsed.dateTime,
        sportItemId: "",
        matchStatus: matchStatus,
        matchField: "",
        competitionName: parsed.competitionName,
        padImg: channel.logo || "",
        competitionLogo: "",
        pkInfoTitle: parsed.teams || parsed.title,
        modifyTitle: `${parsed.title}${parsed.teams ? ' ' + parsed.teams : ''}`,
        presenters: "",
        matchInfo: { time: parsed.dateTime },
        nodes: []
      });
    }
    
    const match = matchMap.get(matchKey);
    
    // 如果有节点名，添加到nodes
    if (parsed.nodeName) {
      match.nodes.push({
        name: parsed.nodeName,
        url: channel.url
      });
    } else if (match.nodes.length === 0) {
      // 如果没有节点名，且还没有nodes，使用主URL
      match.pID = channel.url;
    }
  });
  
  // 转换Map为数组
  return Array.from(matchMap.values());
}

// 主函数
async function main() {
  try {
    console.log('开始获取M3U数据...');
    const m3uUrl = 'http://bingcha.hxfkof88.cloudns.ch/';
    const m3uText = await fetchM3UData(m3uUrl);
    
    console.log('解析M3U数据...');
    const channels = parseM3U(m3uText);
    
    console.log('过滤数据...');
    const filteredChannels = filterChannels(channels);
    
    console.log('合并相同比赛...');
    const mergedMatches = mergeMatches(filteredChannels);
    
    // 保存JSON文件到根目录
    const outputPath = path.join(__dirname, 'parse-m3u-data.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      success: true,
      data: mergedMatches,
      timestamp: new Date().toISOString(),
      count: mergedMatches.length
    }, null, 2));
    
    console.log(`数据处理完成！共生成 ${mergedMatches.length} 个比赛条目`);
    console.log(`数据已保存到: ${outputPath}`);
    
  } catch (error) {
    console.error('处理过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  fetchM3UData,
  parseM3U,
  filterChannels,
  parseChannelName,
  mergeMatches,
  parseDateTime
};
