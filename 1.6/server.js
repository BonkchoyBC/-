const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 读取并解析配置文件
function parseConfigFile() {
    const configPath = path.join(__dirname, 'range.config');
    
    try {
        if (!fs.existsSync(configPath)) {
            // 创建默认配置文件
            console.log('range.config文件不存在，创建默认配置...');
            const defaultConfig = {
                "illumination_intensity": {
                    "normal_min": 500,
                    "normal_max": 1500,
                    "warning_min": 300,
                    "warning_max": 2000,
                    "unit": "lux",
                    "description": "光照强度"
                },
                "temperature": {
                    "normal_min": 20,
                    "normal_max": 30,
                    "warning_min": 15,
                    "warning_max": 35,
                    "unit": "℃",
                    "description": "温度"
                },
                "humidity": {
                    "normal_min": 40,
                    "normal_max": 80,
                    "warning_min": 30,
                    "warning_max": 90,
                    "unit": "%",
                    "description": "湿度"
                },
                "ph": {
                    "normal_min": 6.5,
                    "normal_max": 7.5,
                    "warning_min": 6.0,
                    "warning_max": 8.0,
                    "unit": "pH",
                    "description": "酸碱度"
                },
                "microbial_density": {
                    "normal_min": 800,
                    "normal_max": 1800,
                    "warning_min": 500,
                    "warning_max": 2500,
                    "unit": "CFU/mL",
                    "description": "微生物密度"
                }
            };
            
            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
            console.log('默认range.config文件已创建');
            return defaultConfig;
        }
        
        // 读取并解析配置文件
        const content = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(content);
        
    } catch (err) {
        console.error('读取或解析range.config文件时出错:', err.message);
        return null;
    }
}

// 根据配置检查数据状态（支持可选阈值）
function checkDataStatus(dataPoint, config) {
    if (!config) return {};
    
    const status = {};
    // 支持9个指标
    const allMetrics = ['illumination_intensity', 'temperature', 'humidity', 'ph', 'microbial_density', 'turbidity', 'COD', 'DO', 'EC'];
    
    allMetrics.forEach(metric => {
        const value = dataPoint[metric];
        const range = config[metric];
        
        if (range && value !== undefined) {
            let level = 'normal';
            let message = `${range.description || metric}正常`;
            
            // 检查是否有阈值设置
            const hasNormalMin = range.normal_min !== undefined && range.normal_min !== null;
            const hasNormalMax = range.normal_max !== undefined && range.normal_max !== null;
            const hasWarningMin = range.warning_min !== undefined && range.warning_min !== null;
            const hasWarningMax = range.warning_max !== undefined && range.warning_max !== null;
            
            let details = '';
            
            // 检查危险范围（warning范围）
            if ((hasWarningMin && value < range.warning_min) || 
                (hasWarningMax && value > range.warning_max)) {
                level = 'danger';
                if (hasWarningMin && value < range.warning_min) {
                    details = ` (低于危险下限 ${range.warning_min}${range.unit})`;
                } else if (hasWarningMax && value > range.warning_max) {
                    details = ` (高于危险上限 ${range.warning_max}${range.unit})`;
                }
            } 
            // 检查警告范围（normal范围）
            else if ((hasNormalMin && value < range.normal_min) || 
                     (hasNormalMax && value > range.normal_max)) {
                level = 'warning';
                if (hasNormalMin && value < range.normal_min) {
                    details = ` (低于正常范围 ${range.normal_min}${range.unit})`;
                } else if (hasNormalMax && value > range.normal_max) {
                    details = ` (高于正常范围 ${range.normal_max}${range.unit})`;
                }
            }
            
            message = `${range.description || metric}${details}`;
            
            status[metric] = {
                level: level,
                message: message,
                value: value,
                range: range
            };
        }
    });
    
    return status;
}

// 读取并解析data.csv文件
function parseDataFile() {
    const filePath = path.join(__dirname, 'data.csv');
    const config = parseConfigFile();
    
    try {
        if (!fs.existsSync(filePath)) {
            // 如果文件不存在，创建CSV格式的示例数据文件
            console.log('data.csv文件不存在，创建示例数据...');
            const sampleData = `# 环境监测数据
# 时间,光照强度(lux),温度(℃),湿度(%),pH值,微生物密度(CFU/mL)
# 数据格式: YYYY-MM-DD HH:MM,数值1,数值2,数值3,数值4,数值5

2023-10-01 08:00,850.5,25.3,65.2,6.8,1200
2023-10-01 09:00,1200.2,26.1,63.8,6.9,1350
2023-10-01 10:00,1500.7,27.5,61.4,7.0,1450
2023-10-01 11:00,1800.3,28.9,59.2,7.1,1600
2023-10-01 12:00,2100.8,30.2,57.8,7.2,1750
2023-10-01 13:00,1900.1,29.8,58.3,7.1,1680
2023-10-01 14:00,1600.6,28.3,60.1,7.0,1520
2023-10-01 15:00,1300.4,26.8,62.5,6.9,1400
2023-10-01 16:00,950.9,25.1,64.9,6.8,1250
2023-10-01 17:00,700.2,23.8,67.3,6.7,1100`;
            
            fs.writeFileSync(filePath, sampleData, 'utf8');
            console.log('data.csv文件已创建');
        }
        
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        
        // 解析数据
        const parsedData = {
            rawData: content,
            config: config,
            headers: ['时间', '光照强度', '温度', '湿度', 'pH值', '微生物密度'],
            data: [],
            arrays: {
                time: [],
                illumination_intensity: [],
                temperature: [],
                humidity: [],
                ph: [],
                microbial_density: [],
                turbidity: [],
                COD: [],
                DO: [],
                EC: []
            },
            statistics: {},
            statusSummary: {
                normal: 0,
                warning: 0,
                danger: 0
            },
            hasAlerts: false
        };
        
        // 处理每一行数据
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('#')) continue; // 跳过空行和注释
            
            // CSV格式解析
            const parts = line.split(',');
            if (parts.length >= 6) {
                try {
                    const dataPoint = {
                        id: parsedData.data.length + 1,
                        time: parts[0],
                        illumination_intensity: parseFloat(parts[1]),
                        temperature: parseFloat(parts[2]),
                        humidity: parseFloat(parts[3]),
                        ph: parseFloat(parts[4]),
                        microbial_density: parseFloat(parts[5]),
                        turbidity: parts[6] ? parseFloat(parts[6]) : undefined,
                        COD: parts[7] ? parseFloat(parts[7]) : undefined,
                        DO: parts[8] ? parseFloat(parts[8]) : undefined,
                        EC: parts[9] ? parseFloat(parts[9]) : undefined
                    };
                    
                    // 检查必要的数据有效性
                    if (!isNaN(dataPoint.illumination_intensity) && !isNaN(dataPoint.temperature)) {
                        dataPoint.status = checkDataStatus(dataPoint, config);
                        
                        // 检查是否有任何异常
                        let hasAnyAlert = false;
                        Object.values(dataPoint.status).forEach(status => {
                            if (status.level === 'normal') {
                                parsedData.statusSummary.normal++;
                            } else if (status.level === 'warning') {
                                parsedData.statusSummary.warning++;
                                hasAnyAlert = true;
                            } else if (status.level === 'danger') {
                                parsedData.statusSummary.danger++;
                                hasAnyAlert = true;
                            }
                        });
                        
                        // 标记是否有告警
                        if (hasAnyAlert) {
                            parsedData.hasAlerts = true;
                        }
                        
                        parsedData.data.push(dataPoint);
                        
                        // 填充各个数组
                        parsedData.arrays.time.push(dataPoint.time);
                        parsedData.arrays.illumination_intensity.push(dataPoint.illumination_intensity);
                        parsedData.arrays.temperature.push(dataPoint.temperature);
                        parsedData.arrays.humidity.push(dataPoint.humidity);
                        parsedData.arrays.ph.push(dataPoint.ph);
                        parsedData.arrays.microbial_density.push(dataPoint.microbial_density);
                    }
                } catch (err) {
                    console.warn(`解析第 ${i+1} 行时出错: ${err.message}`);
                }
            }
        }
        
        // 计算统计数据
        if (parsedData.data.length > 0) {
            const arrays = parsedData.arrays;
            
            const calculateStats = (arr) => {
                const sum = arr.reduce((a, b) => a + b, 0);
                const avg = sum / arr.length;
                const min = Math.min(...arr);
                const max = Math.max(...arr);
                
                // 计算标准差
                const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
                const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / arr.length;
                const stdDev = Math.sqrt(avgSquareDiff);
                
                return { avg, min, max, sum, count: arr.length, stdDev };
            };
            
            parsedData.statistics = {
                totalRecords: parsedData.data.length,
                timeRange: {
                    start: arrays.time[0],
                    end: arrays.time[arrays.time.length - 1]
                },
                illumination_intensity: calculateStats(arrays.illumination_intensity),
                temperature: calculateStats(arrays.temperature),
                humidity: calculateStats(arrays.humidity),
                ph: calculateStats(arrays.ph),
                microbial_density: calculateStats(arrays.microbial_density)
            };
        }
        
        console.log(`成功解析 ${parsedData.data.length} 行数据`);
        console.log(`状态汇总: 正常 ${parsedData.statusSummary.normal}, 警告 ${parsedData.statusSummary.warning}, 危险 ${parsedData.statusSummary.danger}`);
        if (parsedData.hasAlerts) {
            console.log('⚠️  发现数据异常！');
        }
        return parsedData;
        
    } catch (err) {
        console.error('读取或解析data.csv文件时出错:', err.message);
        return {
            error: true,
            message: '读取文件失败: ' + err.message,
            data: [],
            arrays: {},
            statistics: {},
            statusSummary: { normal: 0, warning: 0, danger: 0 },
            hasAlerts: false,
            config: config
        };
    }
}

// 创建HTTP服务器
const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);
    
    // 设置CORS头部
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }
    
    // 路由处理
    if (pathname === '/') {
        res.writeHead(302, { 'Location': '/read.html' });
        res.end();
        return;
    }
    
    // 静态文件服务
    const extname = path.extname(pathname).toLowerCase();
    const staticFiles = ['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg'];
    
    if (staticFiles.includes(extname)) {
        const filePath = path.join(__dirname, pathname);
        
        fs.exists(filePath, (exists) => {
            if (!exists) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('文件未找到');
                return;
            }
            
            const mimeTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon'
            };
            
            const contentType = mimeTypes[extname] || 'application/octet-stream';
            
            fs.readFile(filePath, (err, content) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
                    res.end('服务器错误: ' + err.message);
                    return;
                }
                
                res.writeHead(200, { 
                    'Content-Type': contentType + '; charset=utf-8'
                });
                res.end(content);
            });
        });
        return;
    }
    
    // API路由
    if (pathname === '/api/data') {
        const parsedData = parseDataFile();
        res.writeHead(200, { 
            'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(JSON.stringify(parsedData, null, 2));
        return;
    }
    
    if (pathname === '/api/raw') {
        const filePath = path.join(__dirname, 'data.csv');
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
                res.end('文件未找到');
            } else {
                res.writeHead(200, { 
                    'Content-Type': 'text/plain; charset=utf-8'
                });
                res.end(data);
            }
        });
        return;
    }
    
    if (pathname === '/api/config') {
        if (req.method === 'GET') {
            const config = parseConfigFile();
            res.writeHead(200, { 
                'Content-Type': 'application/json; charset=utf-8'
            });
            res.end(JSON.stringify(config, null, 2));
        } else if (req.method === 'PUT') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const newConfig = JSON.parse(body);
                    const configPath = path.join(__dirname, 'range.config');
                    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf8');
                    
                    res.writeHead(200, { 
                        'Content-Type': 'application/json; charset=utf-8'
                    });
                    res.end(JSON.stringify({
                        success: true,
                        message: '配置文件已更新',
                        config: newConfig
                    }));
                } catch (err) {
                    res.writeHead(500, { 
                        'Content-Type': 'application/json; charset=utf-8'
                    });
                    res.end(JSON.stringify({
                        success: false,
                        error: err.message
                    }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('方法不允许');
        }
        return;
    }
    
    if (pathname === '/api/check-status') {
        const config = parseConfigFile();
        const parsedData = parseDataFile();
        
        if (parsedData.error) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(parsedData));
            return;
        }
        
        // 检查所有数据的健康状况
        const healthReport = {
            overallHealth: 'healthy',
            timestamp: new Date().toISOString(),
            totalRecords: parsedData.data.length,
            hasAlerts: parsedData.hasAlerts,
            metrics: {},
            alerts: []
        };
        
        const metrics = ['illumination_intensity', 'temperature', 'humidity', 'ph', 'microbial_density'];
        if (parsedData.data.length > 0) {
            const lastData = parsedData.data[parsedData.data.length - 1];
            metrics.forEach(metric => {
                const status = checkDataStatus(lastData, config)[metric];
                
                if (status) {
                    healthReport.metrics[metric] = {
                        current: lastData[metric],
                        status: status.level,
                        message: status.message,
                        config: config[metric]
                    };
                    
                    if (status.level !== 'normal') {
                        healthReport.alerts.push({
                            metric: metric,
                            level: status.level,
                            message: status.message,
                            value: lastData[metric],
                            timestamp: lastData.time
                        });
                    }
                }
            });
        }
        
        // 更新整体健康状态
        if (healthReport.alerts.some(alert => alert.level === 'danger')) {
            healthReport.overallHealth = 'critical';
        } else if (healthReport.alerts.length > 0) {
            healthReport.overallHealth = 'warning';
        }
        
        res.writeHead(200, { 
            'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(JSON.stringify(healthReport, null, 2));
        return;
    }
    
    if (pathname === '/api/update') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    const parsedData = parseDataFile();
                    res.writeHead(200, { 
                        'Content-Type': 'application/json; charset=utf-8'
                    });
                    res.end(JSON.stringify({
                        success: true,
                        message: '数据已更新',
                        timestamp: new Date().toISOString(),
                        hasAlerts: parsedData.hasAlerts,
                        ...parsedData
                    }));
                } catch (err) {
                    res.writeHead(500, { 
                        'Content-Type': 'application/json; charset=utf-8'
                    });
                    res.end(JSON.stringify({
                        success: false,
                        error: err.message
                    }));
                }
            });
        } else {
            res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('方法不允许');
        }
        return;
    }
    
    if (pathname === '/api/report') {
        const parsedData = parseDataFile();
        
        if (parsedData.error) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(parsedData));
            return;
        }
        
        const report = {
            generatedAt: new Date().toISOString(),
            summary: {
                totalDataPoints: parsedData.data.length,
                timePeriod: `${parsedData.statistics.timeRange.start} 到 ${parsedData.statistics.timeRange.end}`,
                dataHealth: parsedData.statusSummary,
                hasAlerts: parsedData.hasAlerts
            },
            statistics: parsedData.statistics,
            configRanges: parsedData.config,
            recentData: parsedData.data.slice(-5)
        };
        
        res.writeHead(200, { 
            'Content-Type': 'application/json; charset=utf-8'
        });
        res.end(JSON.stringify(report, null, 2));
        return;
    }
    
    // 默认404
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h1>404 - 页面未找到</h1>');
});

// 启动服务器
const PORT = 3000;
server.listen(PORT, () => {
    console.log('='.repeat(60));
    console.log('🌐 Node.js 环境数据监控服务器已启动！');
    console.log('='.repeat(60));
    console.log(`📡 服务器地址: http://localhost:${PORT}`);
    console.log(`📄 主页面: http://localhost:${PORT}/read.html`);
    console.log(`📊 数据API: http://localhost:${PORT}/api/data`);
    console.log(`📈 数据文件: data.csv`);
    console.log(`⚙️  配置文件: range.config`);
    console.log(`🏥 健康检查: http://localhost:${PORT}/api/check-status`);
    console.log(`📈 数据报告: http://localhost:${PORT}/api/report`);
    console.log(`📝 原始数据: http://localhost:${PORT}/api/raw`);
    console.log('='.repeat(60));
    
    // 显示当前目录文件
    console.log('📁 当前目录文件:');
    try {
        const files = fs.readdirSync(__dirname);
        files.forEach(file => {
            const stats = fs.statSync(path.join(__dirname, file));
            const icon = stats.isDirectory() ? '📁' : '📄';
            const size = stats.isFile() ? ` (${stats.size} bytes)` : '';
            console.log(`  ${icon} ${file}${size}`);
        });
    } catch (err) {
        console.error('读取目录出错:', err.message);
    }
    
    console.log('='.repeat(60));
    console.log('🔄 自动读取并解析文件...');
    
    // 读取配置文件
    const config = parseConfigFile();
    if (config) {
        console.log('✅ 配置文件加载成功');
        Object.entries(config).forEach(([key, value]) => {
            console.log(`   ${key}: ${value.normal_min || '-'}-${value.normal_max || '-'}${value.unit}`);
        });
    }
    
    // 解析数据文件
    const parsedData = parseDataFile();
    if (parsedData.error) {
        console.error('❌ 数据解析失败:', parsedData.message);
    } else {
        console.log(`✅ 成功解析 ${parsedData.data.length} 条记录`);
        console.log(`📈 数据时间范围: ${parsedData.statistics.timeRange.start} 到 ${parsedData.statistics.timeRange.end}`);
        console.log(`🏥 数据健康状态: 正常 ${parsedData.statusSummary.normal}, 警告 ${parsedData.statusSummary.warning}, 危险 ${parsedData.statusSummary.danger}`);
        if (parsedData.hasAlerts) {
            console.log('⚠️  发现数据异常！');
        }
    }
    
    console.log('='.repeat(60));
    console.log('🚀 服务器运行中... 按 Ctrl+C 停止');
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n🛑 正在关闭服务器...');
    server.close(() => {
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});