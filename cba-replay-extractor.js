const https = require('https');
const http = require('http');
const crypto = require('crypto');

/**
 * 提取抖音CBA比赛回放信息（Node.js版本）
 */
class DouyinCbaReplayExtractor {
    constructor() {
        this.current_episode_id = '';
        this.current_room_id = '';
        this.owner_user_id = '';
        this.season_id = '';
        this.current_date = '';
        this.yesterday_date = '';
    }

    /**
     * 初始化基础信息
     */
    async initBasicInfo() {
        const replayListUrl = "https://www.douyin.com/aweme/v1/web/show/episode/replay_list/?device_platform=webapp&aid=6383&channel=&episode_id=7584406015685301302&room_id=7584078467029846836&update_version_code=170400&pc_client_type=1&pc_libra_divert=Windows&support_h265=0&support_dash=0&cpu_core_num=4&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1536&screen_height=864&browser_language=zh-CN&browser_platform=Win32&browser_name=Edge&browser_version=143.0.0.0&browser_online=true&engine_name=Blink&engine_version=143.0.0.0&os_name=Windows&os_version=10&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=100&webid=7584425816164664842&uifid=29a1f63ec682dc0a0df227dd163e2b46e3a6390e403335fa4c2c6d1dc0ec5ffa7175313ce54eb1d59eb74b8f5d1cc0208219e6d1dbcb6f064d7942c5a1d2c8ae10d4379cc2d3c8d6c1bdc03aa89e46d8b6daedbb1e2edd22e03926e129f5e60884137684df3b9f819c1ba4fc792685aa7bfc4eef592c57a6a1933e724205d9318530ea8edaf72258df2546ec0cba3f0e6df9339bba6fdec81831091b9abe6975a0b4cf3cca19747df5f7824f402321fef19e0e0e36f3db38efa1c3919afab1e1&msToken=hUrglmPa_DEGHzA76Q0cbdJqijeckdRMtnIh8tqhNkmRnQIwf9XyH4BnhtN77Pvyx1nv43gP6cLa-Cmme8Ciqb-QjMVcEoJF9as0A3BNzCn_flCvxYZh_10ZsMMnffPQH5ChY5QLHJG4y5aZ4m-c1R7jXvjWlYs_0d7G_Q-PsSJu&a_bogus=OfUVkwSEYpAbFdKGYKn%2F7RZUsgylNsuyGeT%2FS7PTSPT6cH0az8PmOPtQbozNkn52jRpwwHV7Ndt%2FYExc0TUzZKHkomkvSsJfV4dnI8sL81HmbBJZn3gZebbxFi-bWCTPQAIGEni1l0lyZgOfpNczloFySAeiBKY8THrypNWlyxg5gaJYIo%2Fye-hn&verifyFp=verify_mj8je4vk_5XnquBCB_eXXu_4jsf_BCVZ_tJLg0UsK6EqS&fp=verify_mj8je4vk_5XnquBCB_eXXu_4jsf_BCVZ_tJLg0UsK6EqS";
        
        const replayData = await this.fetchData(replayListUrl);
        
        if (replayData && replayData.data && replayData.data.all_replay && 
            replayData.data.all_replay[0] && replayData.data.all_replay[0].info_list && 
            replayData.data.all_replay[0].info_list[0]) {
            
            const firstReplay = replayData.data.all_replay[0].info_list[0];
            
            this.current_episode_id = firstReplay.episode_id || '';
            this.current_room_id = firstReplay.room_id || '';
            this.owner_user_id = firstReplay.owner_user_id || '';
            this.season_id = firstReplay.season_id || '';
            
            // 获取比赛时间并计算日期
            if (firstReplay.episode_basic_info && firstReplay.episode_basic_info.match_data && 
                firstReplay.episode_basic_info.match_data.started_time_unix) {
                
                const currentTimestamp = firstReplay.episode_basic_info.match_data.started_time_unix * 1000;
                const currentDate = new Date(currentTimestamp);
                this.current_date = this.formatDate(currentDate);
                
                // 计算前一天
                const yesterdayDate = new Date(currentDate);
                yesterdayDate.setDate(yesterdayDate.getDate() - 1);
                this.yesterday_date = this.formatDate(yesterdayDate);
            } else {
                // 如果无法获取比赛时间，使用当前日期
                const now = new Date();
                this.current_date = this.formatDate(now);
                
                const yesterday = new Date(now);
                yesterday.setDate(yesterday.getDate() - 1);
                this.yesterday_date = this.formatDate(yesterday);
            }
        }
    }

    /**
     * 获取所有比赛信息
     */
    async getAllMatches() {
        await this.initBasicInfo();
        
        const allMatches = [];
        
        // 获取本场回放
        const currentReplays = await this.getReplaysByEpisode(this.current_episode_id, this.current_room_id);
        allMatches.push(...currentReplays);
        
        // 获取前一天回放
        const yesterdayReplays = await this.getYesterdayReplays();
        allMatches.push(...yesterdayReplays);
        
        return allMatches;
    }

    /**
     * 根据episode_id和room_id获取回放列表
     */
    async getReplaysByEpisode(episode_id, room_id) {
        const replayListUrl = `https://www.douyin.com/aweme/v1/web/show/episode/replay_list/?device_platform=webapp&aid=6383&channel=&episode_id=${episode_id}&room_id=${room_id}&update_version_code=170400&pc_client_type=1&pc_libra_divert=Windows&support_h265=0&support_dash=0&cpu_core_num=4&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1536&screen_height=864&browser_language=zh-CN&browser_platform=Win32&browser_name=Edge&browser_version=143.0.0.0&browser_online=true&engine_name=Blink&engine_version=143.0.0.0&os_name=Windows&os_version=10&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=100&webid=7584425816164664842&uifid=29a1f63ec682dc0a0df227dd163e2b46e3a6390e403335fa4c2c6d1dc0ec5ffa7175313ce54eb1d59eb74b8f5d1cc0208219e6d1dbcb6f064d7942c5a1d2c8ae10d4379cc2d3c8d6c1bdc03aa89e46d8b6daedbb1e2edd22e03926e129f5e60884137684df3b9f819c1ba4fc792685aa7bfc4eef592c57a6a1933e724205d9318530ea8edaf72258df2546ec0cba3f0e6df9339bba6fdec81831091b9abe6975a0b4cf3cca19747df5f7824f402321fef19e0e0e36f3db38efa1c3919afab1e1&msToken=hUrglmPa_DEGHzA76Q0cbdJqijeckdRMtnIh8tqhNkmRnQIwf9XyH4BnhtN77Pvyx1nv43gP6cLa-Cmme8Ciqb-QjMVcEoJF9as0A3BNzCn_flCvxYZh_10ZsMMnffPQH5ChY5QLHJG4y5aZ4m-c1R7jXvjWlYs_0d7G_Q-PsSJu&a_bogus=OfUVkwSEYpAbFdKGYKn%2F7RZUsgylNsuyGeT%2FS7PTSPT6cH0az8PmOPtQbozNkn52jRpwwHV7Ndt%2FYExc0TUzZKHkomkvSsJfV4dnI8sL81HmbBJZn3gZebbxFi-bWCTPQAIGEni1l0lyZgOfpNczloFySAeiBKY8THrypNWlyxg5gaJYIo%2Fye-hn&verifyFp=verify_mj8je4vk_5XnquBCB_eXXu_4jsf_BCVZ_tJLg0UsK6EqS&fp=verify_mj8je4vk_5XnquBCB_eXXu_4jsf_BCVZ_tJLg0UsK6EqS`;
        
        const replayData = await this.fetchData(replayListUrl);
        
        const matches = [];
        
        if (replayData && replayData.data && replayData.data.all_replay && 
            replayData.data.all_replay[0] && replayData.data.all_replay[0].info_list) {
            
            for (const replay of replayData.data.all_replay[0].info_list) {
                const matchInfo = this.extractMatchInfo(replay);
                if (matchInfo) {
                    matches.push(matchInfo);
                }
            }
        }
        
        return matches;
    }

    /**
     * 获取前一天回放
     */
    async getYesterdayReplays() {
        const yesterdayMatches = [];
        let cursor = 0;
        const maxPages = 5;
        const processedEpisodes = [];
        
        for (let page = 0; page < maxPages; page++) {
            const moreReplayUrl = `https://www.douyin.com/aweme/v1/web/show/episode/more_replay/?device_platform=webapp&aid=6383&channel=&episode_id=${this.current_episode_id}&cursor=${cursor}&page_size=10&relation_type=2&season_type=1&room_id=${this.current_room_id}&uid=${this.owner_user_id}&reverse=false&update_version_code=170400&pc_client_type=1&pc_libra_divert=Windows&support_h265=0&support_dash=0&cpu_core_num=4&version_code=170400&version_name=17.4.0&cookie_enabled=true&screen_width=1536&screen_height=864&browser_language=zh-CN&browser_platform=Win32&browser_name=Edge&browser_version=143.0.0.0&browser_online=true&engine_name=Blink&engine_version=143.0.0.0&os_name=Windows&os_version=10&device_memory=8&platform=PC&downlink=10&effective_type=4g&round_trip_time=100&webid=7584425816164664842&uifid=29a1f63ec682dc0a0df227dd163e2b46e3a6390e403335fa4c2c6d1dc0ec5ffa7175313ce54eb1d59eb74b8f5d1cc0208219e6d1dbcb6f064d7942c5a1d2c8ae10d4379cc2d3c8d6c1bdc03aa89e46d8b6daedbb1e2edd22e03926e129f5e60884137684df3b9f819c1ba4fc792685aa7bfc4eef592c57a6a1933e724205d9318530ea8edaf72258df2546ec0cba3f0e6df9339bba6fdec81831091b9abe6975a0b4cf3cca19747df5f7824f402321fef19e0e0e36f3db38efa1c3919afab1e1&msToken=hUrglmPa_DEGHzA76Q0cbdJqijeckdRMtnIh8tqhNkmRnQIwf9XyH4BnhtN77Pvyx1nv43gP6cLa-Cmme8Ciqb-QjMVcEoJF9as0A3BNzCn_flCvxYZh_10ZsMMnffPQH5ChY5QLHJG4y5aZ4m-c1R7jXvjWlYs_0d7G_Q-PsSJu&a_bogus=O6UVkqUEQp85Fd%2FGmOn%2F7fZUBg6ANTSyz-idSxFPyxT6OXtaz8PYOxbQnoznvfc2f8piwC3HideAYDxcszUiZoHpwmkfusvRn4QCI0mL%2F1HmYTkZV3gBejbEoi4Y8S4PQ5AtEaL110l7Z2cfqNcslFF99AeEBuY8sHrRpNRU9xgQ6aiYnx26t-2M&verifyFp=verify_mj8je4vk_5XnquBCB_eXXu_4jsf_BCVZ_tJLg0UsK6EqS&fp=verify_mj8je4vk_5XnquBCB_eXXu_4jsf_BCVZ_tJLg0UsK6EqS`;
            
            const moreReplayData = await this.fetchData(moreReplayUrl);
            
            if (!moreReplayData || !moreReplayData.data || !moreReplayData.data.info_list) {
                break;
            }
            
            let foundYesterday = false;
            
            for (const replay of moreReplayData.data.info_list) {
                // 检查比赛日期
                if (replay.episode_basic_info && replay.episode_basic_info.match_data && 
                    replay.episode_basic_info.match_data.started_time_unix) {
                    
                    const matchTimestamp = replay.episode_basic_info.match_data.started_time_unix * 1000;
                    const matchDate = this.formatDate(new Date(matchTimestamp));
                    
                    if (matchDate === this.yesterday_date) {
                        // 检查是否已处理过这个episode_id
                        const episodeId = replay.episode_id || '';
                        if (processedEpisodes.includes(episodeId)) {
                            continue;
                        }
                        
                        processedEpisodes.push(episodeId);
                        
                        // 获取这个episode下的所有比赛
                        const roomId = replay.room_id || 0;
                        if (roomId) {
                            const episodeMatches = await this.getReplaysByEpisode(episodeId, roomId);
                            yesterdayMatches.push(...episodeMatches);
                            foundYesterday = true;
                        } else {
                            // 如果没有room_id，只提取当前回放信息
                            const matchInfo = this.extractMatchInfo(replay);
                            if (matchInfo) {
                                yesterdayMatches.push(matchInfo);
                                foundYesterday = true;
                            }
                        }
                    } else if (matchDate < this.yesterday_date) {
                        // 如果比赛日期早于前一天，停止搜索
                        return yesterdayMatches;
                    }
                }
            }
            
            // 如果没有找到前一天的比赛，继续翻页
            if (!foundYesterday && moreReplayData.data.has_more) {
                cursor = moreReplayData.data.cursor || 0;
            } else {
                break;
            }
        }
        
        return yesterdayMatches;
    }

    /**
     * 提取比赛信息
     */
    extractMatchInfo(replay) {
        const matchInfo = {};
        
        // 基础信息
        matchInfo.episode_id = replay.episode_id || '';
        matchInfo.title = replay.title || '';
        
        // 比赛时间
        if (replay.episode_basic_info && replay.episode_basic_info.match_data && 
            replay.episode_basic_info.match_data.started_time_unix) {
            
            const timestamp = replay.episode_basic_info.match_data.started_time_unix * 1000;
            matchInfo.match_time = this.formatDateTime(new Date(timestamp));
            matchInfo.match_date = this.formatDate(new Date(timestamp));
            
        } else if (replay.episode_basic_info && replay.episode_basic_info.match_data && 
                   replay.episode_basic_info.match_data.started_time) {
            
            matchInfo.match_time = replay.episode_basic_info.match_data.started_time;
            
            // 尝试从字符串中提取日期
            const matchTimeStr = replay.episode_basic_info.match_data.started_time;
            const dateMatch = matchTimeStr.match(/(\d{4}-\d{2}-\d{2})/);
            matchInfo.match_date = dateMatch ? dateMatch[1] : '';
        } else {
            matchInfo.match_time = '';
            matchInfo.match_date = '';
        }
        
        // 对阵信息
        if (replay.episode_basic_info && replay.episode_basic_info.match_data && 
            replay.episode_basic_info.match_data.against) {
            
            const against = replay.episode_basic_info.match_data.against;
            matchInfo.left_team = against.left_name || '';
            matchInfo.right_team = against.right_name || '';
            matchInfo.left_score = against.left_goal || '';
            matchInfo.right_score = against.right_goal || '';
            matchInfo.score = `${matchInfo.left_score} - ${matchInfo.right_score}`;
        } else {
            matchInfo.left_team = '';
            matchInfo.right_team = '';
            matchInfo.left_score = '';
            matchInfo.right_score = '';
            matchInfo.score = '';
        }
        
        // 封面图片
        if (replay.cover && replay.cover.url_list && replay.cover.url_list[0]) {
            matchInfo.cover_url = replay.cover.url_list[0];
        } else {
            matchInfo.cover_url = '';
        }
        
        // 获取最高画质的MP4播放地址
        matchInfo.play_url = this.getBestQualityMp4Url(replay);
        
        return matchInfo;
    }

    /**
     * 获取最高画质的MP4播放地址
     */
    getBestQualityMp4Url(replay) {
        let bestUrl = '';
        
        // 优先从unfold_play_info中获取
        if (replay.video_info && replay.video_info.unfold_play_info && 
            replay.video_info.unfold_play_info.play_urls) {
            
            const playUrls = replay.video_info.unfold_play_info.play_urls;
            
            // 按画质优先级：1080p > 720p > 480p
            const qualityPriority = ['1080p', '720p', '480p'];
            
            for (const quality of qualityPriority) {
                for (const playUrl of playUrls) {
                    if (playUrl.definition === quality) {
                        bestUrl = playUrl.main || playUrl.backup || '';
                        if (bestUrl) {
                            return bestUrl;
                        }
                    }
                }
            }
        }
        
        // 如果unfold_play_info中没有，尝试从watermarked_encrypt中获取
        if (!bestUrl && replay.video_info && replay.video_info.watermarked_encrypt && 
            replay.video_info.watermarked_encrypt.json) {
            
            try {
                const watermarkedJson = JSON.parse(replay.video_info.watermarked_encrypt.json);
                
                if (watermarkedJson.video_list) {
                    const videoList = watermarkedJson.video_list;
                    
                    // 同样按画质优先级选择
                    const qualityPriority = ['1080p', '720p', '480p'];
                    
                    for (const quality of qualityPriority) {
                        for (const video of videoList) {
                            if (video.video_meta && video.video_meta.definition === quality && 
                                video.main_url) {
                                return video.main_url;
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('解析watermarked_encrypt JSON失败:', error);
            }
        }
        
        return bestUrl;
    }

    /**
     * 获取数据
     */
    async fetchData(url) {
        return new Promise((resolve, reject) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;
            
            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname + parsedUrl.search,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
                    'Referer': 'https://www.douyin.com/',
                    'Origin': 'https://www.douyin.com'
                },
                timeout: 30000,
                family: 4 // 强制使用IPv4，避免IPv6连接问题
            };
            
            const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            const jsonData = JSON.parse(data);
                            resolve(jsonData);
                        } catch (error) {
                            reject(new Error(`JSON解析失败: ${error.message}`));
                        }
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}`));
                    }
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
        });
    }

    /**
     * 格式化日期为 YYYY-MM-DD
     */
    formatDate(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * 格式化日期时间为 YYYY-MM-DD HH:MM:SS
     */
    formatDateTime(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }

    /**
     * 输出完整JSON格式结果
     */
    async outputJson(outputFull = false) {
        try {
            const allMatches = await this.getAllMatches();
            
            if (outputFull) {
                // 完整输出 - 按日期分组
                const matchesByDate = {};
                for (const match of allMatches) {
                    const matchDate = match.match_date || '';
                    if (matchDate) {
                        if (!matchesByDate[matchDate]) {
                            matchesByDate[matchDate] = [];
                        }
                        
                        const simplifiedMatch = {
                            episode_id: match.episode_id,
                            match_time: match.match_time,
                            title: match.title,
                            teams: match.left_team ? `${match.left_team} vs ${match.right_team}` : '',
                            score: match.score,
                            cover_url: match.cover_url,
                            play_url: match.play_url
                        };
                        
                        matchesByDate[matchDate].push(simplifiedMatch);
                    }
                }
                
                // 统计每个日期的比赛数量
                const dateStats = {};
                for (const date in matchesByDate) {
                    dateStats[date] = matchesByDate[date].length;
                }
                
                return JSON.stringify({
                    status: 'success',
                    current_date: this.current_date,
                    yesterday_date: this.yesterday_date,
                    total_matches: allMatches.length,
                    date_stats: dateStats,
                    matches_by_date: matchesByDate,
                    all_matches: allMatches
                }, null, 2);
            } else {
                // 简化输出
                const simplifiedMatches = [];
                
                for (const match of allMatches) {
                    simplifiedMatches.push({
                        episode_id: match.episode_id,
                        match_time: match.match_time,
                        title: match.title,
                        teams: match.left_team ? `${match.left_team} vs ${match.right_team}` : '',
                        score: match.score,
                        cover_url: match.cover_url,
                        play_url: match.play_url
                    });
                }
                
                return JSON.stringify({
                    status: 'success',
                    current_date: this.current_date,
                    yesterday_date: this.yesterday_date,
                    total_matches: simplifiedMatches.length,
                    matches: simplifiedMatches
                }, null, 2);
            }
        } catch (error) {
            return JSON.stringify({
                status: 'error',
                message: error.message,
                current_date: this.current_date || '',
                yesterday_date: this.yesterday_date || '',
                total_matches: 0,
                matches: []
            }, null, 2);
        }
    }
}

// 主执行函数
async function main() {
    const extractor = new DouyinCbaReplayExtractor();
    
    // 判断是否输出完整信息
    const outputFull = process.argv.includes('--full') || 
                      (process.env.TYPE && process.env.TYPE === 'full');
    
    try {
        const result = await extractor.outputJson(outputFull);
        console.log(result);
    } catch (error) {
        console.error('执行失败:', error);
        process.exit(1);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main();
}

// 导出类供其他模块使用
module.exports = DouyinCbaReplayExtractor;
