const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto'); // 引入crypto模块

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
  
  console.log(`开始过滤数据，模式: ${mode}，今天日期: ${todayStr}`);
  
  const filtered = channels.filter(channel => {
    // 过滤组名
    if (mode === 'all') {
      // 全部模式：保留冰茶体育和体育回看
      if (!['冰茶体育', '体育回看'].includes(channel.group)) {
        return false;
      }
    } else if (mode === 'today') {
      // 今天模式：只保留冰茶体育
      if (channel.group !== '冰茶体育') {
        return false;
      }
    }
    
    // 过滤logo
    if (!channel.logo) return false;
    const logoFileName = channel.logo.split('/').pop();
    if (!['爱奇艺体育.png', '腾讯体育.png'].includes(logoFileName)) {
      return false;
    }
    
    return true;
  });
  
  console.log(`过滤完成，剩余 ${filtered.length} 个频道`);
  return filtered;
}

// 解析频道名称（修复版 - 支持所有情况）
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
    // 或: 11月19日12:00_NBA常规赛_太阳vs开拓者 王嘉琦 沈知渝 泱泱
    // 或: 11月19日12:00_NBA常规赛_太阳vs开拓者 英文原音
    
    // 使用更精确的匹配模式
    const match = channelName.match(/^(\d{1,2}月\d{1,2}日\d{1,2}:\d{2})_([^_]+)_([^ ]+)(?:\s+(.+))?$/);
    if (match) {
      result.dateTime = match[1];
      result.competitionName = match[2];
      result.teams = match[3];
      result.title = match[3];
      
      // 如果有节点名（第4个匹配组）
      if (match[4]) {
        result.nodeName = match[4].trim();
      }
    } else {
      // 如果上面的正则不匹配，尝试备用方案
      console.log(`备用解析: ${channelName}`);
      const dateTimeMatch = channelName.match(/^(\d{1,2}月\d{1,2}日\d{1,2}:\d{2})/);
      if (dateTimeMatch) {
        result.dateTime = dateTimeMatch[1];
        let remaining = channelName.substring(dateTimeMatch[0].length);
        
        if (remaining.startsWith('_')) {
          remaining = remaining.substring(1);
          const parts = remaining.split('_');
          if (parts.length >= 2) {
            result.competitionName = parts[0];
            // 最后一个部分可能是比赛队伍+节点名
            const lastPart = parts[parts.length - 1];
            const spaceIndex = lastPart.indexOf(' ');
            if (spaceIndex !== -1) {
              result.teams = lastPart.substring(0, spaceIndex);
              result.title = result.teams;
              result.nodeName = lastPart.substring(spaceIndex + 1).trim();
            } else {
              result.teams = lastPart;
              result.title = result.teams;
            }
          }
        }
      }
    }
  }
  
  return result;
}

// 格式化日期时间为MM月DD日HH:MM格式
function formatDateTime(dateTimeStr) {
  const match = dateTimeStr.match(/(\d{1,2})月(\d{1,2})日(\d{1,2}):(\d{2})/);
  if (!match) return dateTimeStr;
  
  const month = match[1].padStart(2, '0');
  const day = match[2].padStart(2, '0');
  const hour = match[3].padStart(2, '0');
  const minute = match[4];
  
  return `${month}月${day}日${hour}:${minute}`;
}

// 解析日期时间字符串为上海时区时间
function parseDateTime(dateTimeStr) {
  const formattedDateTime = formatDateTime(dateTimeStr);
  const match = formattedDateTime.match(/(\d{2})月(\d{2})日(\d{2}):(\d{2})/);
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
    
    // 格式化日期时间
    const formattedDateTime = formatDateTime(parsed.dateTime);
    
    // 生成匹配键（排除节点名）- 只使用日期时间+赛事名+比赛队伍
    const matchKey = `${formattedDateTime}_${parsed.competitionName}_${parsed.teams}`;
    
    if (!matchMap.has(matchKey)) {
      const shanghaiTime = getShanghaiTime();
      const matchDateTime = parseDateTime(parsed.dateTime);
      
      let matchStatus = "0";
      if (matchDateTime) {
        const matchTime = matchDateTime.getTime();
        const currentTime = shanghaiTime.getTime();
        const threeHoursLater = matchTime + 3 * 60 * 60 * 1000;
        
        if (currentTime > threeHoursLater) {
          matchStatus = "2"; // 已结束
        } else if (currentTime >= matchTime) {
          matchStatus = "1"; // 进行中
        } else {
          matchStatus = "0"; // 未开始
        }
      }
      
      // 修复 modifyTitle 格式：competitionName + 空格 + pkInfoTitle
      const modifyTitle = `${parsed.competitionName} ${parsed.teams}`;
      
      // 根据赛事名分配 sportItemId
      const sportItemId = getSportItemId(parsed.competitionName);
      
      // 生成固定唯一的ID：使用MD5确保100%唯一性
      const md5Id = generateStableMatchId(formattedDateTime, parsed.competitionName, parsed.teams);
      console.log(`生成固定ID: ${md5Id}`);
      
      // 根据logo文件名设置padImg
      let padImg = "";
      if (channel.logo) {
        const logoFileName = channel.logo.split('/').pop(); // 获取文件名
        if (logoFileName === '腾讯体育.png') {
          padImg = 'http://catvod.hxfrock.ggff.net/腾讯体育.png';
        } else if (logoFileName === '爱奇艺体育.png') {
          padImg = 'http://catvod.hxfrock.ggff.net/爱奇艺体育.png';
        }
      }
      
      matchMap.set(matchKey, {
        mgdbId: "",
        pID: md5Id, // 使用固定唯一ID
        title: parsed.teams, // title 应该是比赛队伍
        keyword: formattedDateTime, // 使用格式化后的日期时间
        sportItemId: sportItemId,
        matchStatus: matchStatus,
        matchField: "",
        competitionName: parsed.competitionName,
        padImg: padImg,  // 修改这里：使用条件判断后的padImg值
        competitionLogo: "",
        pkInfoTitle: parsed.teams, // pkInfoTitle 应该是比赛队伍
        modifyTitle: modifyTitle,
        presenters: "",
        matchInfo: { time: formattedDateTime }, // 使用格式化后的日期时间
        nodes: []
      });
    }
    
    const match = matchMap.get(matchKey);
    
    // 如果有节点名，添加到nodes
    if (parsed.nodeName) {
      // 检查是否已存在相同节点名
      const existingNode = match.nodes.find(node => node.name === parsed.nodeName);
      if (existingNode) {
        // 如果节点已存在，只添加URL
        if (!existingNode.urls.includes(channel.url)) {
          existingNode.urls.push(channel.url);
        }
      } else {
        // 如果节点不存在，创建新节点
        match.nodes.push({
          name: parsed.nodeName,
          urls: [channel.url]
        });
      }
      console.log(`添加节点: ${parsed.nodeName} 到比赛 ${matchKey}`);
    } else {
      // 如果没有节点名，也要创建默认节点，name为title，urls对应url
      const defaultNodeName = parsed.teams;
      const existingNode = match.nodes.find(node => node.name === defaultNodeName);
      if (existingNode) {
        if (!existingNode.urls.includes(channel.url)) {
          existingNode.urls.push(channel.url);
        }
      } else {
        match.nodes.push({
          name: defaultNodeName,
          urls: [channel.url]
        });
      }
      console.log(`添加默认节点: ${parsed.teams} 到比赛 ${matchKey}`);
    }
  });
  
  const merged = Array.from(matchMap.values());
  console.log(`合并完成，共 ${merged.length} 个比赛条目`);
  
  // 输出所有pID用于调试
  //console.log('所有比赛的pID:', merged.map(match => match.pID));

  // 过滤掉 title、keyword、competitionName 同时为空的记录
  const finalMerged = merged.filter(match => {
    const isEmpty = !match.title && !match.keyword && !match.competitionName;
    if (isEmpty) {
      console.log(`移除空记录: ${match.pID}`);
    }
    return !isEmpty;
  });
  
  console.log(`过滤后剩余 ${finalMerged.length} 个有效比赛条目`);
  return finalMerged;
}

// 生成稳定且唯一的比赛ID（使用MD5确保100%唯一性）
function generateStableMatchId(dateTimeStr, competitionName, teams) {
  // 1. 标准化日期时间：11月17日00:45 → 11170045
  const dateTimePart = dateTimeStr.replace(/(\d{2})月(\d{2})日(\d{2}):(\d{2})/, (match, month, day, hour, minute) => {
    return `${month}${day}${hour}${minute}`;
  });
  
  // 2. 创建基础字符串
  const baseString = `${dateTimePart}_${competitionName}_${teams}`;
  
  // 3. 使用MD5生成哈希（取前16位）
  const md5Hash = crypto.createHash('md5').update(baseString).digest('hex');
  const shortHash = md5Hash.substring(0, 16);
  
  //console.log(`生成MD5 ID: 基础字符串="${baseString}", MD5="${md5Hash}", 短哈希="${shortHash}"`);
  
  return shortHash;
}

// 根据赛事名获取 sportItemId
function getSportItemId(competitionName) {
  if (!competitionName) return "";
  
  const lowerName = competitionName.toLowerCase();
  
  // 1: 足球相关
  if (lowerName.includes('英超') || lowerName.includes('意甲') || lowerName.includes('德甲') || 
      lowerName.includes('巴甲') || lowerName.includes('西甲') || lowerName.includes('中超') ||
      lowerName.includes('甲a') || lowerName.includes('世欧预') || lowerName.includes('世亚预') ||
      lowerName.includes('苏超') || lowerName.includes('湘超') || lowerName.includes('足球') ||
      lowerName.includes('法甲') || lowerName.includes('荷甲') || lowerName.includes('葡超') ||
      lowerName.includes('欧冠') || lowerName.includes('欧联') || lowerName.includes('亚冠') ||
      lowerName.includes('足总杯') || lowerName.includes('国王杯') || lowerName.includes('德国杯') ||
      lowerName.includes('意大利杯') || lowerName.includes('法国杯') || lowerName.includes('联赛杯') ||
      lowerName.includes('世界杯') || lowerName.includes('欧洲杯') || lowerName.includes('亚洲杯') ||
      lowerName.includes('美洲杯') || lowerName.includes('非洲杯') || lowerName.includes('联合会杯') ||
      lowerName.includes('社区盾') || lowerName.includes('超级杯') || lowerName.includes('友谊赛') ||
      lowerName.includes('男足') || lowerName.includes('女足')) {
    return "1";
  }
  
  // 2: 篮球相关
  if (lowerName.includes('nba') || lowerName.includes('cba') || lowerName.includes('篮球') ||
      lowerName.includes('三人篮球') || lowerName.includes('wcba') || lowerName.includes('wnba') ||
      lowerName.includes('aba') || lowerName.includes('欧洲篮球') || lowerName.includes('篮球世界杯') ||
      lowerName.includes('篮球亚洲杯') || lowerName.includes('篮球欧锦赛') || lowerName.includes('篮球美洲杯') ||
      lowerName.includes('ncaa') || lowerName.includes('篮球联赛') || lowerName.includes('男篮') || lowerName.includes('女篮')) {
    return "2";
  }
  
  // 3: 网球相关
  if (lowerName.includes('网球') || lowerName.includes('法网') || lowerName.includes('澳网') ||
      lowerName.includes('美网') || lowerName.includes('温网') || lowerName.includes('中网') ||
      lowerName.includes('wta') || lowerName.includes('atp') || lowerName.includes('戴维斯杯') ||
      lowerName.includes('联合会杯') || lowerName.includes('大师赛') || lowerName.includes('公开赛')) {
    return "3";
  }
  
  // 4: 排球相关
  if (lowerName.includes('排球') || lowerName.includes('女排') || lowerName.includes('男排') ||
      lowerName.includes('沙排')) {
    return "4";
  }
  
  // 5: 格斗相关
  if (lowerName.includes('格斗') || lowerName.includes('ufc') || lowerName.includes('wwe') ||
      lowerName.includes('wbc') || lowerName.includes('拳击') || lowerName.includes('mma') ||
      lowerName.includes('综合格斗') || lowerName.includes('自由搏击') || lowerName.includes('散打') ||
      lowerName.includes('泰拳') || lowerName.includes('跆拳道') || lowerName.includes('空手道') ||
      lowerName.includes('柔道') || lowerName.includes('摔跤') || lowerName.includes('拳王') ||
      lowerName.includes('金腰带')) {
    return "5";
  }
  
  // 6: 羽毛球相关
  if (lowerName.includes('羽毛球') || lowerName.includes('羽球') || lowerName.includes('世锦赛') ||
      lowerName.includes('汤姆斯杯') || lowerName.includes('尤伯杯') || lowerName.includes('苏迪曼杯') ||
      lowerName.includes('公开赛') || lowerName.includes('大师赛') || lowerName.includes('超级赛')) {
    return "6";
  }
  
  // 7: 乒乓球相关
  if (lowerName.includes('乒乓球') || lowerName.includes('乒乓') || lowerName.includes('世乒赛') ||
      lowerName.includes('世界杯') || lowerName.includes('公开赛') || lowerName.includes('亚锦赛') ||
      lowerName.includes('全运会') || lowerName.includes('联赛')) {
    return "7";
  }
  
  // 8: 台球相关
  if (lowerName.includes('台球') || lowerName.includes('斯诺克') || lowerName.includes('九球') ||
      lowerName.includes('中式台球') || lowerName.includes('美式台球') || lowerName.includes('世锦赛') ||
      lowerName.includes('大师赛') || lowerName.includes('公开赛') || lowerName.includes('冠军赛')) {
    return "8";
  }
  
  // 9: 田径相关
  if (lowerName.includes('田径') || lowerName.includes('跑步') || lowerName.includes('短跑') ||
      lowerName.includes('长跑') || lowerName.includes('跨栏') || lowerName.includes('跳高') ||
      lowerName.includes('跳远') || lowerName.includes('铅球') || lowerName.includes('标枪') ||
      lowerName.includes('铁饼') || lowerName.includes('世锦赛') || lowerName.includes('钻石联赛')) {
    return "9";
  }
   
  // 10: 电竞相关
  if (lowerName.includes('电竞') || lowerName.includes('英雄联盟') || lowerName.includes('lol') ||
      lowerName.includes('dota') || lowerName.includes('csgo') || lowerName.includes('王者荣耀') ||
      lowerName.includes('pubg') || lowerName.includes('守望先锋') || lowerName.includes('星际争霸') ||
      lowerName.includes('魔兽争霸') || lowerName.includes('炉石传说') || lowerName.includes('valorant')) {
    return "10";
  }

  return "";

}

// 获取CBA回放数据
async function fetchCBAReplyData(retries = 3, delay = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`尝试获取CBA回放数据 (第 ${attempt} 次)...`);
      const url = 'http://ikuai.168957.xyz:9080/cbareplay.php';
      
      const data = await new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        
        const options = {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80, // 明确指定端口
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Connection': 'keep-alive'
          },
          timeout: 15000 // 15秒超时
        };
        
        const req = http.request(options, (res) => {
          console.log(`CBA回放数据 HTTP 状态码: ${res.statusCode}`);
          
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }

          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            console.log(`CBA回放数据获取成功，数据长度: ${data.length} 字符`);
            resolve(data);
          });
        });
        
        req.on('error', (error) => {
          reject(new Error(`CBA回放请求错误: ${error.message}`));
        });
        
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('CBA回放请求超时'));
        });
        
        req.end();
      });
      
      const jsonData = JSON.parse(data);
      console.log(`CBA回放数据解析成功，共 ${jsonData.total_matches || 0} 场比赛`);
      return jsonData;
      
    } catch (error) {
      console.error(`第 ${attempt} 次尝试获取CBA回放数据失败: ${error.message}`);
      
      if (attempt < retries) {
        console.log(`等待 ${delay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 1.5; // 每次重试延迟增加1.5倍
      } else {
        console.error(`所有 ${retries} 次尝试都失败了: ${error.message}`);
        return null;
      }
    }
  }
}

// 将标准日期时间字符串转换为MM月DD日HH:MM格式
function formatStandardDateTime(dateTimeStr) {
  try {
    // 解析标准格式：2025-12-16 19:35:00
    const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return dateTimeStr;
    
    const year = match[1];
    const month = match[2];
    const day = match[3];
    const hour = match[4];
    const minute = match[5];
    
    // 去掉前导0
    const monthNum = parseInt(month, 10);
    const dayNum = parseInt(day, 10);
    const hourNum = parseInt(hour, 10);
    
    return `${monthNum}月${dayNum}日${hourNum}:${minute}`;
  } catch (error) {
    console.error(`格式化日期时间错误: ${dateTimeStr}`, error);
    return dateTimeStr;
  }
}

// 转换CBA回放数据格式
function convertCBAReplyData(cbaData) {
  if (!cbaData || !cbaData.matches || !Array.isArray(cbaData.matches)) {
    return [];
  }
  
  console.log(`开始转换CBA回放数据，共 ${cbaData.matches.length} 场比赛`);
  
  const convertedMatches = [];
  
  cbaData.matches.forEach((match, index) => {
    try {
      // 格式化日期时间
      const formattedDateTime = formatStandardDateTime(match.match_time);
      
      // 构建节点
      const nodes = [{
        name: `${match.title || ''} ${match.score || ''}`.trim() || 'CBA回放',
        urls: [match.play_url]
      }];
      
      // 构建比赛条目
      const convertedMatch = {
        mgdbId: "",
        pID: match.episode_id ? match.episode_id.toString() : `cba_reply_${index}`,
        title: `${match.title || ''} ${match.score || ''}`.trim(),
        keyword: formattedDateTime,
        sportItemId: "2", // CBA是篮球
        matchStatus: "2", // 回放都是已结束
        matchField: "",
        competitionName: "抖音CBA联赛",
        padImg: match.cover_url || "",
        competitionLogo: "",
        pkInfoTitle: match.teams || "",
        modifyTitle: "",
        presenters: "",
        matchInfo: { time: formattedDateTime },
        nodes: nodes
      };
      
      convertedMatches.push(convertedMatch);
      console.log(`转换CBA回放比赛: ${convertedMatch.title}, ID: ${convertedMatch.pID}`);
    } catch (error) {
      console.error(`转换CBA回放数据出错 (索引 ${index}):`, error);
    }
  });
  
  console.log(`CBA回放数据转换完成，共 ${convertedMatches.length} 场比赛`);
  return convertedMatches;
}

// 获取抖音直播间重定向地址
async function getDouyinLiveUrl() {
  const ridList = ['983488708402', '339638082961'];
  
  for (const rid of ridList) {
    try {
      console.log(`尝试获取直播间 ${rid} 的地址...`);
      const url = `http://ikuai.168957.xyz:9080/douyin.php?type=rid&rid=${rid}`;
      
      const response = await new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const req = http.request({
          hostname: parsedUrl.hostname,
          port: parsedUrl.port || 80,
          path: parsedUrl.pathname + parsedUrl.search,
          method: 'GET',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            // 检查是否返回错误信息
            if (data.includes('该直播间未开播')) {
              console.log(`直播间 ${rid} 未开播`);
              resolve(null);
            } else if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              // 获取重定向地址
              console.log(`直播间 ${rid} 重定向地址: ${res.headers.location}`);
              resolve(res.headers.location);
            } else {
              // 其他情况
              console.log(`直播间 ${rid} 返回状态码: ${res.statusCode}`);
              resolve(null);
            }
          });
        });
        
        req.on('error', (error) => {
          console.error(`请求直播间 ${rid} 失败:`, error.message);
          resolve(null);
        });
        
        req.on('timeout', () => {
          console.error(`请求直播间 ${rid} 超时`);
          req.destroy();
          resolve(null);
        });
        
        req.end();
      });
      
      if (response) {
        return response; // 返回第一个成功的重定向地址
      }
    } catch (error) {
      console.error(`处理直播间 ${rid} 时出错:`, error.message);
      continue; // 继续尝试下一个
    }
  }
  
  console.log('所有直播间地址获取失败');
  return null; // 所有尝试都失败
}

// 主函数
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
    
    let mergedMatches;
    
    try {
      console.log('尝试从真实API获取数据...');
      const m3uUrl = 'http://bingcha.hxfkof88.cloudns.ch/';
      const m3uText = await fetchM3UData(m3uUrl, 3, 2000);
      
      console.log('解析M3U数据...');
      const channels = parseM3U(m3uText);
      
      console.log('过滤数据...');
      const filteredChannels = filterChannels(channels, mode);
      
      console.log('合并相同比赛...');
      mergedMatches = mergeMatches(filteredChannels);
      
    } catch (apiError) {
      console.error('从真实API获取数据失败:', apiError.message);
      throw apiError; // 直接抛出错误，不使用模拟数据
    }
    
    // ============ 根据模式处理CBA数据 ============
    console.log(`开始获取CBA数据 (模式: ${mode})...`);
    
    // 1. all模式：获取CBA回放数据
    if (mode === 'all') {
      try {
        const cbaReplyData = await fetchCBAReplyData();
        if (cbaReplyData && cbaReplyData.matches && cbaReplyData.matches.length > 0) {
          const convertedCBAMatches = convertCBAReplyData(cbaReplyData);
          if (convertedCBAMatches.length > 0) {
            console.log(`添加 ${convertedCBAMatches.length} 场CBA回放比赛到结果中`);
            mergedMatches = mergedMatches.concat(convertedCBAMatches);
          }
        } else {
          console.log('CBA回放数据为空或获取失败，跳过');
        }
      } catch (cbaError) {
        console.error('处理CBA回放数据时出错，跳过:', cbaError.message);
      }
    }
    
    // 2. 添加固定CBA直播间数据 (新增)
    try {
      console.log('开始添加固定CBA直播间数据...');
      
      // 获取当前日期并格式化
      const shanghaiTime = getShanghaiTime();
      const month = shanghaiTime.getMonth() + 1;
      const day = shanghaiTime.getDate();
      const formattedDateTime = `${month}月${day}日19:30`;
      
      // 获取直播间地址
      const liveUrl = await getDouyinLiveUrl();
      
      if (liveUrl) {
        // 构建固定直播间条目
        const cbaLiveItem = {
          mgdbId: "",
          pID: "983488708402", // 固定的直播间ID
          title: "抖音CBA直播间", 
          keyword: formattedDateTime, // 当天日期 + 19:30
          sportItemId: "2", // 篮球
          matchStatus: "1", // 直播状态
          matchField: "",
          competitionName: "CBA联赛",
          padImg: "http://catvod.hxfrock.ggff.net/抖音CBA.png",  
          competitionLogo: "",
          pkInfoTitle: "抖音CBA直播间",
          modifyTitle: "",
          presenters: "",
          matchInfo: { time: formattedDateTime },
          nodes: [{
            name: "抖音CBA直播间",
            urls: [liveUrl] // 动态获取的重定向地址
          }]
        };
        
        console.log(`添加固定CBA直播间: ${cbaLiveItem.title}`);
        mergedMatches.push(cbaLiveItem);
      } else {
        console.log('获取直播间地址失败，跳过添加CBA直播间');
      }
    } catch (liveError) {
      console.error('处理CBA直播间数据时出错，跳过:', liveError.message);
    }
    // ============ CBA数据处理结束 ============
    
    // 根据模式生成不同的文件名
    const outputFileName = `parse-m3u-data-${mode}.json`;
    const outputPath = path.join(__dirname, outputFileName);
    
    // 动态构建source字段
    const sourceTypes = ['real'];
    
    // 根据实际获取的数据类型添加source
    if (mode === 'all' && mergedMatches.some(match => match.pID && match.pID.includes('cba_reply'))) {
      sourceTypes.push('cba_reply');
    }
    if (mergedMatches.some(match => match.pID === '983488708402')) {
      sourceTypes.push('cba_live');
    }
    
    const outputData = {
      success: true,
      data: mergedMatches,
      timestamp: new Date().toISOString(),
      shanghaiTime: getShanghaiTime().toISOString(),
      count: mergedMatches.length,
      mode: mode,
      source: sourceTypes.join(' + ')
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));
    
    console.log(`数据处理完成！共生成 ${mergedMatches.length} 个比赛条目`);
    console.log(`数据已保存到: ${outputPath}`);
    console.log(`运行模式: ${mode}`);
    console.log(`数据来源: ${outputData.source}`);
    
  } catch (error) {
    console.error('处理过程中发生错误:', error);
    
    // 根据模式生成不同的错误文件名
    const mode = process.argv[2] || 'all';
    const outputFileName = `parse-m3u-data-${mode}.json`;
    const outputPath = path.join(__dirname, outputFileName);
    
    fs.writeFileSync(outputPath, JSON.stringify({
      success: false,
      data: [],
      timestamp: new Date().toISOString(),
      count: 0,
      mode: mode,
      error: error.message
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
