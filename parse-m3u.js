const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
// 移除了crypto模块，因为generateStableMatchId已移除

// 获取上海时区的当前时间
function getShanghaiTime() {
  const now = new Date();
  // 上海时区是 UTC+8
  const shanghaiOffset = 8 * 60; // 分钟
  const localOffset = now.getTimezoneOffset(); // 本地时区偏移（分钟）
  const shanghaiTime = new Date(now.getTime() + (shanghaiOffset + localOffset) * 60 * 1000);
  return shanghaiTime;
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
          timeout: 30000 // 30秒超时
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
    const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/);
    if (!match) return dateTimeStr;
    
    const month = match[2];
    const day = match[3];
    const hour = match[4];
    const minute = match[5];
    
    // 保持所有部分为两位数
    return `${month}月${day}日${hour}:${minute}`;
  } catch (error) {
    console.error(`格式化日期时间错误: ${dateTimeStr}`, error);
    return dateTimeStr;
  }
}

// 获取上海时区的当前日期（YYYY-MM-DD格式）
function getShanghaiDateString() {
  const shanghaiTime = getShanghaiTime();
  const year = shanghaiTime.getFullYear();
  const month = String(shanghaiTime.getMonth() + 1).padStart(2, '0');
  const day = String(shanghaiTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 转换CBA回放数据格式（添加mode参数和日期检查）
function convertCBAReplyData(cbaData, mode = 'all') {
  if (!cbaData || !cbaData.matches || !Array.isArray(cbaData.matches)) {
    return [];
  }
  
  console.log(`开始转换CBA回放数据，模式: ${mode}，共 ${cbaData.matches.length} 场比赛`);
  
  const convertedMatches = [];
  const currentShanghaiDate = getShanghaiDateString();
  
  cbaData.matches.forEach((match, index) => {
    try {
      // 如果是today模式，检查比赛日期是否与当前日期一致
      if (mode === 'today') {
        // 从match_time中提取日期部分（YYYY-MM-DD）
        const matchDate = match.match_time ? match.match_time.split(' ')[0] : null;
        console.log(`比赛 ${match.title} 日期: ${matchDate}, 当前日期: ${currentShanghaiDate}`);
        
        if (matchDate !== currentShanghaiDate) {
          console.log(`日期不匹配，跳过比赛: ${match.title}`);
          return; // 跳过这场比赛
        }
      }          
      
      // 格式化日期时间
      const formattedDateTime = formatStandardDateTime(match.match_time);
      
      // 构建节点：如果有nodes就用，没有就用原来的方式添加
      let nodes = [];
      
      if (match.nodes && Array.isArray(match.nodes) && match.nodes.length > 0) {
        // 使用已有的nodes数据
        console.log(`比赛 ${match.title} 使用已有的nodes数据`);
        nodes = match.nodes;
      } else {
        // 如果没有nodes，按原来的方式构建节点
        console.log(`比赛 ${match.title} 使用原始方式构建节点`);
        nodes = [{
          name: `${match.title || ''} ${match.score || ''}`.trim() || 'CBA回放',
          urls: [match.play_url]
        }];
      }
      
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
  
  console.log(`CBA回放数据转换完成，模式: ${mode}，共 ${convertedMatches.length} 场比赛`);
  return convertedMatches;
}

// 获取抖音直播间重定向地址
async function getDouyinLiveUrl() {
  const ridList = ['983488708402', '339638082961', '330698468897'];
  
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
          timeout: 20000,
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
    
    // 初始化合并结果数组，现在只包含CBA相关数据
    let mergedMatches = [];
    
    // ============ 根据模式处理CBA回放数据 ============
    console.log(`开始获取CBA回放数据 (模式: ${mode})...`);

    // 获取当前北京时间（上海时区）
    const shanghaiTime = getShanghaiTime();
    const currentHour = shanghaiTime.getHours();

    // 判断当前时间是否在19:00:00以后
    const isAfter1900 = currentHour >= 19;
    
    // 获取CBA回放数据（根据条件执行）
    if (mode === 'all' || (mode === 'today' && isAfter1900)) {
      try {
        const cbaReplyData = await fetchCBAReplyData();
        if (cbaReplyData && cbaReplyData.matches && cbaReplyData.matches.length > 0) {
          // 传递mode参数到转换函数
          const convertedCBAMatches = convertCBAReplyData(cbaReplyData, mode);
          if (convertedCBAMatches.length > 0) {
            console.log(`添加 ${convertedCBAMatches.length} 场CBA回放比赛到结果中`);
            mergedMatches = mergedMatches.concat(convertedCBAMatches);
          } else {
            console.log('转换后的CBA回放数据为空（可能是日期不匹配）');
          }
        } else {
          console.log('CBA回放数据为空或获取失败，跳过');
        }
      } catch (cbaError) {
        console.error('处理CBA回放数据时出错，跳过:', cbaError.message);
      }
    } else if (mode === 'today') {
      console.log('当前时间未到19:00:00，不获取CBA回放数据');
    }
    
    // 2. 添加固定CBA直播间数据
    try {
      console.log('开始添加固定CBA直播间数据...');
      
      // 获取当前日期并格式化
      const shanghaiTime = getShanghaiTime();
      const month = String(shanghaiTime.getMonth() + 1).padStart(2, '0');
      const day = String(shanghaiTime.getDate()).padStart(2, '0');
      const formattedDateTime = `${month}月${day}日19:30`;
      
      // 先尝试从cbalive.php获取nodes数据
      let nodes = [];
      let useFallback = false;
      
      try {
        console.log('尝试从http://ikuai.168957.xyz:9080/cbalive.php获取nodes数据...');
        const cbaLiveUrl = 'http://ikuai.168957.xyz:9080/cbalive.php';
        
        const cbaLiveData = await new Promise((resolve, reject) => {
          const parsedUrl = new URL(cbaLiveUrl);
          const req = http.request({
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 80,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            timeout: 15000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'application/json',
              'Connection': 'keep-alive'
            }
          }, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              try {
                if (res.statusCode === 200) {
                  const jsonData = JSON.parse(data);
                  console.log(`CBA直播数据获取成功，共 ${jsonData.matches?.length || 0} 个直播`);
                  resolve(jsonData);
                } else {
                  console.log(`CBA直播API返回状态码: ${res.statusCode}`);
                  resolve(null);
                }
              } catch (parseError) {
                console.error('解析CBA直播数据失败:', parseError.message);
                resolve(null);
              }
            });
          });
          
          req.on('error', (error) => {
            console.error(`请求CBA直播数据失败: ${error.message}`);
            resolve(null);
          });
          
          req.on('timeout', () => {
            console.error('请求CBA直播数据超时');
            req.destroy();
            resolve(null);
          });
          
          req.end();
        });
        
        if (cbaLiveData && cbaLiveData.success === true && 
            cbaLiveData.matches && Array.isArray(cbaLiveData.matches) && 
            cbaLiveData.matches.length > 0) {
          
          console.log(`成功获取到 ${cbaLiveData.matches.length} 个CBA直播节点`);
          
          // 处理每个直播比赛作为节点
          let validNodeCount = 0;
          cbaLiveData.matches.forEach((match, index) => {
            try {
              // 确保有title和originFlvUrl字段，并且originFlvUrl不为空
              if (match.title && match.originFlvUrl && match.originFlvUrl.trim() !== '') {
                nodes.push({
                  name: match.title,
                  urls: [match.originFlvUrl]
                });
                validNodeCount++;
                console.log(`添加CBA直播节点: ${match.title}`);
              } else {
                console.log(`CBA直播数据第${index + 1}项缺少必要字段或originFlvUrl为空`);
              }
            } catch (matchError) {
              console.error(`处理CBA直播数据第${index + 1}项时出错:`, matchError.message);
            }
          });
          
          console.log(`有效CBA直播节点数量: ${validNodeCount}`);
          
          // 如果没有有效的节点，设置标记使用备选方法
          if (validNodeCount === 0) {
            console.log('没有有效的CBA直播节点，将使用备选方法');
            useFallback = true;
          }
          
        } else {
          console.log('CBA直播数据为空或获取失败，将使用备选方法获取节点');
          useFallback = true;
        }
        
      } catch (cbaLiveError) {
        console.error('从cbalive.php获取数据失败，使用备选方法获取节点:', cbaLiveError.message);
        useFallback = true;
      }
      
      // 如果需要使用备选方法
      if (useFallback && nodes.length === 0) {
        console.log('执行备选方法获取节点...');
        // 备选方法：按原来的方法获取一个节点
        const liveUrl = await getDouyinLiveUrl();
        
        if (liveUrl) {
          nodes.push({
            name: "抖音CBA直播 [非直播时间为CCTV13直播]",
            urls: [liveUrl]
          });
          console.log(`使用备选方法添加CBA直播节点`);
        } else {
          console.log('获取直播间地址失败，跳过添加CBA直播间');
        }
      }
      
      // 如果nodes不为空，则添加CBA直播间条目
      if (nodes.length > 0) {
        // 构建固定直播间条目（保持原有字段不变）
        const cbaLiveItem = {
          mgdbId: "",
          pID: "983488708402", // 固定的直播间ID，保持不变
          title: "抖音CBA直播间", 
          keyword: formattedDateTime, // 当天日期 + 19:30
          sportItemId: "2", // 篮球
          matchStatus: "1", // 直播状态
          matchField: "",
          competitionName: "CBA联赛",
          padImg: "http://catvod.957.de5.net/抖音CBA.png",  
          competitionLogo: "",
          pkInfoTitle: "抖音CBA直播间",
          modifyTitle: "",
          presenters: "",
          matchInfo: { time: formattedDateTime },
          nodes: nodes // 使用从API获取的nodes数据
        };
        
        console.log(`添加固定CBA直播间: ${cbaLiveItem.title}, 包含 ${nodes.length} 个节点`);
        mergedMatches.push(cbaLiveItem);
      } else {
        console.log('CBA直播间节点为空，跳过添加');
      }
      
    } catch (liveError) {
      console.error('处理CBA直播间数据时出错，跳过:', liveError.message);
    }
    
    // 根据模式生成不同的文件名
    const outputFileName = `parse-m3u-data-${mode}.json`;
    const outputPath = path.join(__dirname, outputFileName);
    
    // 动态构建source字段
    const sourceTypes = [];
    
    // 根据实际获取的数据类型添加source
    if (mergedMatches.some(match => match.pID && match.pID.includes('cba_reply'))) {
      sourceTypes.push('cba_reply');
    }
    if (mergedMatches.some(match => match.pID === '983488708402')) {
      sourceTypes.push('cba_live');
    }
    
    // 如果没有数据，标记为no_data
    if (sourceTypes.length === 0) {
      sourceTypes.push('no_data');
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

// 导出仍被外部可能使用的函数
module.exports = {
  getShanghaiTime,
  getSportItemId,
  formatStandardDateTime,
  getShanghaiDateString,
  fetchCBAReplyData,
  convertCBAReplyData,
  getDouyinLiveUrl
};
