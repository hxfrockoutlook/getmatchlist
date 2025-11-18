const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// 获取上海时区的当前时间
function getShanghaiTime() {
  const now = new Date();
  // 上海时区是 UTC+8
  const shanghaiOffset = 8 * 60; // 分钟
  const localOffset = now.getTimezoneOffset(); // 本地时区偏移（分钟）
  const shanghaiTime = new Date(now.getTime() + (shanghaiOffset + localOffset) * 60 * 1000);
  return shanghaiTime;
}

// 获取M3U数据（支持重定向）
async function fetchM3UData(url, retries = 3, delay = 1000, maxRedirects = 5) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`尝试获取M3U数据 (第 ${attempt} 次)... URL: ${url}`);
      
      const data = await new Promise((resolve, reject) => {
        let redirectCount = 0;
        
        const makeRequest = (currentUrl) => {
          const client = currentUrl.startsWith('https') ? https : http;
          const parsedUrl = new URL(currentUrl);
          
          const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': '*/*',
              'Connection': 'keep-alive'
            },
            timeout: 30000
          };
          
          const req = client.request(options, (res) => {
            console.log(`HTTP 状态码: ${res.statusCode}`);
            
            // 处理重定向
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              redirectCount++;
              if (redirectCount > maxRedirects) {
                reject(new Error(`重定向次数超过限制 (${maxRedirects} 次)`));
                return;
              }
              
              const redirectUrl = new URL(res.headers.location, currentUrl).href;
              console.log(`重定向到: ${redirectUrl}`);
              
              // 消耗响应体
              res.resume();
              
              // 跟随重定向
              makeRequest(redirectUrl);
              return;
            }
            
            if (res.statusCode !== 200) {
              reject(new Error(`HTTP ${res.statusCode}`));
              return;
            }

            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              console.log(`获取数据成功，数据长度: ${data.length} 字符`);
              resolve(data);
            });
          });
          
          req.on('error', (error) => {
            reject(new Error(`请求错误: ${error.message}`));
          });
          
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('请求超时'));
          });
          
          req.end();
        };
        
        makeRequest(url);
      });
      
      return data;
      
    } catch (error) {
      console.error(`第 ${attempt} 次尝试失败: ${error.message}`);
      
      if (attempt < retries) {
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      } else {
        throw new Error(`所有 ${retries} 次尝试都失败了: ${error.message}`);
      }
    }
  }
}

// 解析M3U数据
function parseM3U(m3uText) {
  const channels = [];
  const lines = m3uText.split('\n');
  
  console.log(`开始解析M3U数据，共 ${lines.length} 行`);
  
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
  
  console.log(`解析完成，共找到 ${channels.length} 个频道`);
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
function filterChannels(channels, mode = 'all') {
  const shanghaiTime = getShanghaiTime();
  const todayStr = `${(shanghaiTime.getMonth() + 1).toString().padStart(2, '0')}月${shanghaiTime.getDate().toString().padStart(2, '0')}日`;
  
  console.log(`开始过滤数据，模式: ${mode}，上海日期: ${todayStr}`);
  
  const filtered = channels.filter(channel => {
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
    
    // 根据模式过滤
    if (mode === 'today') {
      // 今天模式：只保留冰茶体育组且是今天的数据
      return channel.group === '冰茶体育' && channel.name.includes(todayStr);
    } else {
      // 全部模式：保留所有符合组名和logo的数据
      return true;
    }
  });
  
  console.log(`过滤完成，剩余 ${filtered.length} 个频道`);
  return filtered;
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

// 解析日期时间字符串为上海时区时间
function parseDateTime(dateTimeStr) {
  const match = dateTimeStr.match(/(\d{1,2})月(\d{1,2})日(\d{1,2}):(\d{2})/);
  if (!match) return null;
  
  const month = parseInt(match[1]);
  const day = parseInt(match[2]);
  const hour = parseInt(match[3]);
  const minute = parseInt(match[4]);
  
  const shanghaiTime = getShanghaiTime();
  const year = shanghaiTime.getFullYear();
  
  // 简单处理跨年情况（如果月份小于当前月份，认为是明年）
  const matchYear = month < shanghaiTime.getMonth() + 1 ? year + 1 : year;
  
  // 创建上海时区时间对象
  const matchTime = new Date(matchYear, month - 1, day, hour, minute);
  
  return matchTime;
}

// 合并相同比赛
function mergeMatches(channels) {
  const matchMap = new Map();
  
  console.log('开始合并相同比赛...');
  
  channels.forEach((channel, index) => {
    const parsed = parseChannelName(channel.name, channel.logo);
    
    // 生成匹配键（排除节点名）
    const matchKey = `${parsed.dateTime}_${parsed.competitionName}_${parsed.title}`;
    
    if (!matchMap.has(matchKey)) {
      const shanghaiTime = getShanghaiTime();
      const matchDateTime = parseDateTime(parsed.dateTime);
      
      let matchStatus = 0;
      if (matchDateTime) {
        const matchTime = matchDateTime.getTime();
        const currentTime = shanghaiTime.getTime();
        const threeHoursLater = matchTime + 3 * 60 * 60 * 1000;
        
        if (currentTime > threeHoursLater) {
          matchStatus = 2; // 已结束
        } else if (currentTime >= matchTime) {
          matchStatus = 1; // 进行中
        } else {
          matchStatus = 0; // 未开始
        }
      }
      
      // 修复 modifyTitle 格式：competitionName + 空格 + pkInfoTitle
      const modifyTitle = `${parsed.competitionName} ${parsed.teams || parsed.title}`;
      
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
        modifyTitle: modifyTitle,
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
  
  const merged = Array.from(matchMap.values());
  console.log(`合并完成，共 ${merged.length} 个比赛条目`);
  return merged;
}

// 主函数
async function main() {
  try {
    // 获取命令行参数
    const mode = process.argv[2] || 'all'; // 默认全部模式
    const validModes = ['all', 'today'];
    
    if (!validModes.includes(mode)) {
      console.error('错误: 无效的模式参数。请使用 "all" 或 "today"');
      console.error('示例: node parse-m3u.js all');
      console.error('示例: node parse-m3u.js today');
      process.exit(1);
    }
    
    console.log(`=== 开始处理体育数据 (模式: ${mode}) ===`);
    
    console.log('从真实API获取数据...');
    const m3uUrl = 'http://bingcha.hxfkof88.cloudns.ch/';
    const m3uText = await fetchM3UData(m3uUrl, 3, 2000);
    
    console.log('解析M3U数据...');
    const channels = parseM3U(m3uText);
    
    console.log('过滤数据...');
    const filteredChannels = filterChannels(channels, mode);
    
    console.log('合并相同比赛...');
    const mergedMatches = mergeMatches(filteredChannels);
    
    // 保存JSON文件到根目录
    const outputPath = path.join(__dirname, 'parse-m3u-data.json');
    const outputData = {
      success: true,
      data: mergedMatches,
      timestamp: new Date().toISOString(),
      shanghaiTime: getShanghaiTime().toISOString(),
      count: mergedMatches.length,
      mode: mode,
      source: 'real'
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`数据处理完成！共生成 ${mergedMatches.length} 个比赛条目`);
    console.log(`数据已保存到: ${outputPath}`);
    console.log(`运行模式: ${mode}`);
    
  } catch (error) {
    console.error('处理过程中发生错误:', error);
    
    // 生成错误状态文件
    const outputPath = path.join(__dirname, 'parse-m3u-data.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      success: false,
      data: [],
      timestamp: new Date().toISOString(),
      count: 0,
      error: error.message,
      mode: process.argv[2] || 'all'
    }, null, 2));
    
    console.log('已生成错误状态文件');
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = {
  getShanghaiTime,
  fetchM3UData,
  parseM3U,
  filterChannels,
  parseChannelName,
  mergeMatches,
  parseDateTime
};
