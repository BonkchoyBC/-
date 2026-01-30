// 全局变量
let environmentData = [];
let timeData = [];
let illuminationData = [];
let temperatureData = [];
let humidityData = [];
let phData = [];
let microbialData = [];
let dataStatistics = {};
let dataHeaders = [];
let dataChart = null;
let isTableView = true;
let currentConfig = {};
let hasAlerts = false;
let alertMetrics = [];
let turbidityData = [];
let CODData = [];
let DOData = [];
let ECData = [];
let totalAlerts = 0;

// 分页相关变量
let currentPage = 1;
let pageSize = 10;
let totalPages = 1;

// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // 显示服务器URL
    const serverUrl = window.location.origin;
    document.getElementById('serverUrl').textContent = serverUrl;
    
    // 开始加载数据
    loadData();
    
    // 加载配置
    loadConfig();
    
    // 设置自动刷新（每30秒）
    setInterval(loadData, 30000);
    
    // 初始化图表
    initializeChart();
    
    // 设置默认分页大小
    document.getElementById('pageSizeSelect').value = pageSize;
});

// 加载数据
function loadData() {
    showLoading();
    document.getElementById('errorMessage').style.display = 'none';
    document.getElementById('serverStatusText').textContent = '获取数据中...';
    document.getElementById('alertDetails').style.display = 'none';
    
    // 更新进度条
    updateProgress(30);
    
    fetch('/api/data')
        .then(response => {
            updateProgress(60);
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            updateProgress(80);
            
            if (data.error) {
                throw new Error(data.message);
            }
            
            // 更新服务器状态
            document.getElementById('serverStatus').className = 'status-dot active';
            document.getElementById('serverStatusText').textContent = '已连接';
            
            // 更新时间戳
            const now = new Date();
            document.getElementById('lastUpdate').textContent = now.toLocaleTimeString();
            document.getElementById('overviewTime').textContent = `更新时间: ${now.toLocaleString()}`;
            
            // 存储数据到全局变量
            environmentData = data.data || [];
            timeData = data.arrays.time || [];
            illuminationData = data.arrays.illumination_intensity || [];
            temperatureData = data.arrays.temperature || [];
            humidityData = data.arrays.humidity || [];
            phData = data.arrays.ph || [];
            microbialData = data.arrays.microbial_density || [];
            dataStatistics = data.statistics || {};
            dataHeaders = data.headers || [];
            hasAlerts = data.hasAlerts || false;
            currentConfig = data.config || {};
            turbidityData = data.arrays.turbidity || [];
            CODData = data.arrays.COD || [];
            DOData = data.arrays.DO || [];
            ECData = data.arrays.EC || [];
                        
            // 检查并更新页面头部状态
            updateHeaderStatus();
            
            // 更新UI
            updateOverview();
            updateDataTable();
            updateStatistics();
            updateConfigDisplay();
            updateChart();
            
            updateProgress(100);
            
            // 隐藏加载指示器
            setTimeout(() => {
                document.getElementById('loading').style.display = 'none';
                document.getElementById('dataTableContainer').style.display = 'block';
            }, 500);
            
            console.log('数据加载成功，共', environmentData.length, '条记录');
            if (hasAlerts) {
                console.log('⚠️ 发现数据异常');
            }
            
        })
        .catch(error => {
            console.error('加载数据失败:', error);
            document.getElementById('loading').style.display = 'none';
            document.getElementById('errorMessage').style.display = 'block';
            document.getElementById('errorMessage').textContent = '加载数据失败: ' + error.message;
            document.getElementById('serverStatus').className = 'status-dot';
            document.getElementById('serverStatusText').textContent = '连接失败';
            document.getElementById('serverStatus').style.background = '#e74c3c';
            
            updateProgress(0);
        });
}

// 更新页面头部状态（根据是否有异常）
function updateHeaderStatus() {
    const header = document.getElementById('pageHeader');
    const alertIndicator = document.getElementById('alertIndicator');
    const alertCount = document.getElementById('alertCount');
    
    if (environmentData.length === 0) return;
    
    const lastData = environmentData[environmentData.length - 1];
    
    // 重新计算异常数量
    alertMetrics = [];
    totalAlerts = 0;
    
    if (lastData.status) {
        Object.entries(lastData.status).forEach(([metric, status]) => {
            if (status.level !== 'normal') {
                alertMetrics.push({
                    metric: metric,
                    level: status.level,
                    message: status.message
                });
                totalAlerts++;
            }
        });
    }
    
    // 更新hasAlerts标志
    hasAlerts = totalAlerts > 0;
    
    if (hasAlerts) {
        // 更新头部为红色
        header.className = 'alert-header';
        
        // 显示异常指示器
        alertIndicator.style.display = 'inline-block';
        alertIndicator.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${totalAlerts} 项异常`;
        alertIndicator.className = 'alert-indicator';
        
        // 显示异常数量
        alertCount.textContent = totalAlerts;
        alertCount.style.color = '#e74c3c';
        alertCount.style.fontWeight = 'bold';
        
        // 显示异常详情
        showAlertDetails();
        
    } else {
        // 恢复正常头部
        header.className = '';
        
        // 隐藏异常指示器
        alertIndicator.style.display = 'none';
        
        // 更新异常数量
        alertCount.textContent = '0';
        alertCount.style.color = '';
        alertCount.style.fontWeight = '';
        
        // 隐藏异常详情
        document.getElementById('alertDetails').style.display = 'none';
    }
}

// 显示异常详情
function showAlertDetails() {
    if (alertMetrics.length === 0) return;
    
    const alertDetails = document.getElementById('alertDetails');
    let html = '<div class="alert-details">';
    html += '<h4><i class="fas fa-exclamation-circle"></i> 发现以下数据异常：</h4>';
    html += '<ul>';
    
    alertMetrics.forEach(alert => {
        const icon = alert.level === 'danger' ? '🛑' : '⚠️';
        html += `<li><strong>${getMetricName(alert.metric)}</strong>: ${alert.message} ${icon}</li>`;
    });
    
    html += '</ul>';
    html += '<p style="margin-top: 10px; font-size: 0.9rem;"><i class="fas fa-info-circle"></i> 请检查相关设备或调整阈值设置</p>';
    html += '</div>';
    
    alertDetails.innerHTML = html;
    alertDetails.style.display = 'block';
}

// 获取指标中文名称
function getMetricName(metric) {
    const names = {
        'illumination_intensity': '光照强度',
        'temperature': '温度',
        'humidity': '湿度',
        'ph': 'pH值',
        'microbial_density': '微生物密度'
    };
    return names[metric] || metric;
}

// 更新概览（包含所有5个参数）
function updateOverview() {
    const container = document.getElementById('overviewGrid');
    if (!container || environmentData.length === 0) return;
    
    const lastData = environmentData[environmentData.length - 1];
    const stats = dataStatistics;
    
    container.innerHTML = '';
    
    // 9个指标
    const metrics = [
        'illumination_intensity', 
        'temperature', 
        'humidity', 
        'ph',
        'microbial_density',
        'turbidity',
        'COD', 
        'DO',
        'EC'
    ];
    
    metrics.forEach(metric => {
        const value = lastData[metric];
        const stat = stats[metric];
        const config = currentConfig[metric];
        const status = lastData.status?.[metric];
        
        let cardClass = '';
        if (status) {
            if (status.level === 'warning') cardClass = 'metric-alert';
            if (status.level === 'danger') cardClass = 'metric-danger';
        }
        
        const names = {
            'illumination_intensity': '光照强度',
            'temperature': '温度',
            'humidity': '湿度',
            'ph': 'pH值',
            'microbial_density': '微生物密度',
            'turbidity': '浊度',
            'COD': '化学需氧量',
            'DO': '溶解氧',
            'EC': '电导率'
        };
        
        const units = {
            'illumination_intensity': 'lux',
            'temperature': '℃',
            'humidity': '%',
            'ph': 'pH',
            'microbial_density': 'CFU/mL',
            'turbidity': 'NTU',
            'COD': 'mg/L',
            'DO': 'mg/L',
            'EC': 'μS/cm'
        };
        
        const icons = {
            'illumination_intensity': 'fas fa-sun',
            'temperature': 'fas fa-thermometer-half',
            'humidity': 'fas fa-tint',
            'ph': 'fas fa-flask',
            'microbial_density': 'fas fa-bacteria',
            'turbidity': 'fas fa-water',
            'COD': 'fas fa-vial',
            'DO': 'fas fa-wind',
            'EC': 'fas fa-bolt'
        };
        
        let thresholdInfo = '';
        if (config) {
            const hasMin = config.normal_min !== undefined && config.normal_min !== null;
            const hasMax = config.normal_max !== undefined && config.normal_max !== null;
            
            if (hasMin && hasMax) {
                thresholdInfo = `阈值: ${config.normal_min}-${config.normal_max}${config.unit}`;
            } else if (hasMin) {
                thresholdInfo = `阈值: ≥${config.normal_min}${config.unit}`;
            } else if (hasMax) {
                thresholdInfo = `阈值: ≤${config.normal_max}${config.unit}`;
            } else {
                thresholdInfo = '<span class="no-threshold">阈值未设置</span>';
            }
        }
        
        // 格式化显示值
        let displayValue;
        const numericValue = parseFloat(value);
        
        if (metric === 'microbial_density') {
            // 微生物密度显示为整数，千分位分隔
            displayValue = Math.round(numericValue).toLocaleString();
        } else if (metric === 'ph') {
            // pH值保留2位小数
            displayValue = numericValue.toFixed(2);
        } else if (['turbidity', 'COD', 'DO', 'EC'].includes(metric)) {
            // 新增指标保留2位小数
            displayValue = numericValue.toFixed(2);
        } else {
            // 其他值保留1位小数
            displayValue = numericValue.toFixed(1);
        }
        
        // 格式化范围显示
        let rangeText = '';
        if (stat) {
            let minValue, maxValue;
            if (metric === 'microbial_density') {
                minValue = Math.round(stat.min).toLocaleString();
                maxValue = Math.round(stat.max).toLocaleString();
            } else if (metric === 'ph' || ['turbidity', 'COD', 'DO', 'EC'].includes(metric)) {
                minValue = stat.min.toFixed(2);
                maxValue = stat.max.toFixed(2);
            } else {
                minValue = stat.min.toFixed(1);
                maxValue = stat.max.toFixed(1);
            }
            rangeText = `范围: ${minValue} - ${maxValue}`;
        }
        
        const card = document.createElement('div');
        card.className = `data-card ${cardClass}`;
        card.innerHTML = `
            <div>
                <h3><i class="${icons[metric]}"></i> ${names[metric]}</h3>
                <div class="data-value">${displayValue}</div>
                <div class="data-unit">${units[metric]}</div>
            </div>
            <div>
                <div class="data-change">
                    ${rangeText}
                </div>
                <div class="threshold-info">
                    ${thresholdInfo}
                </div>
            </div>
        `;
        
        // 添加点击事件
        card.addEventListener('click', () => {
            const chartSelect = document.getElementById('chartSelect');
            let chartValue = '';
            
            switch(metric) {
                case 'illumination_intensity':
                    chartValue = 'illumination';
                    break;
                case 'microbial_density':
                    chartValue = 'microbial';
                    break;
                case 'COD':
                    chartValue = 'COD';
                    break;
                case 'DO':
                    chartValue = 'DO';
                    break;
                case 'EC':
                    chartValue = 'EC';
                    break;
                default:
                    chartValue = metric;
            }
            
            chartSelect.value = chartValue;
            updateChart();
        });
        
        card.title = `点击查看${names[metric]}趋势图`;
        container.appendChild(card);
    });
    
    document.getElementById('totalRecords').textContent = environmentData.length;
}

// 更新数据表格（带分页功能）
function updateDataTable() {
    const tableBody = document.getElementById('dataTableBody');
    if (!tableBody) return;
    
    totalPages = Math.max(1, Math.ceil(environmentData.length / pageSize));
    currentPage = Math.min(currentPage, totalPages);
    
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = Math.min(startIndex + pageSize, environmentData.length);
    const pageData = environmentData.slice(startIndex, endIndex);
    
    tableBody.innerHTML = '';
    
    pageData.forEach((dataPoint, index) => {
        const row = document.createElement('tr');
        const rowNumber = startIndex + index + 1;
        
        let hasAlert = false;
        let hasWarning = false;
        let alertText = '';
        let alertCells = {};
        
        if (dataPoint.status) {
            Object.entries(dataPoint.status).forEach(([metric, status]) => {
                if (status.level === 'danger') {
                    hasAlert = true;
                    alertCells[metric] = 'danger';
                } else if (status.level === 'warning') {
                    hasWarning = true;
                    alertCells[metric] = 'warning';
                }
            });
            
            // 收集异常信息
            const alerts = [];
            Object.entries(dataPoint.status).forEach(([metric, status]) => {
                if (status.level !== 'normal') {
                    alerts.push(`${getMetricName(metric)}${status.message.split('(')[1] || ''}`);
                }
            });
            
            if (alerts.length > 0) {
                alertText = alerts.join(', ');
            }
        }
        
        // 设置行样式
        if (hasAlert) {
            row.className = 'alert-row';
        } else if (hasWarning) {
            row.className = 'warning-row';
        }
        
        // 创建所有指标单元格
        const timeCell = document.createElement('td');
        timeCell.textContent = dataPoint.time;
        
        const illuminationCell = document.createElement('td');
        illuminationCell.textContent = dataPoint.illumination_intensity.toFixed(1);
        if (alertCells.illumination_intensity === 'danger') illuminationCell.className = 'alert-cell';
        else if (alertCells.illumination_intensity === 'warning') illuminationCell.className = 'warning-cell';
        
        const temperatureCell = document.createElement('td');
        temperatureCell.textContent = dataPoint.temperature.toFixed(1);
        if (alertCells.temperature === 'danger') temperatureCell.className = 'alert-cell';
        else if (alertCells.temperature === 'warning') temperatureCell.className = 'warning-cell';
        
        const humidityCell = document.createElement('td');
        humidityCell.textContent = dataPoint.humidity.toFixed(1);
        if (alertCells.humidity === 'danger') humidityCell.className = 'alert-cell';
        else if (alertCells.humidity === 'warning') humidityCell.className = 'warning-cell';
        
        const phCell = document.createElement('td');
        phCell.textContent = dataPoint.ph.toFixed(2);
        if (alertCells.ph === 'danger') phCell.className = 'alert-cell';
        else if (alertCells.ph === 'warning') phCell.className = 'warning-cell';
        
        const microbialCell = document.createElement('td');
        microbialCell.textContent = dataPoint.microbial_density.toLocaleString();
        if (alertCells.microbial_density === 'danger') microbialCell.className = 'alert-cell';
        else if (alertCells.microbial_density === 'warning') microbialCell.className = 'warning-cell';
        
        const turbidityCell = document.createElement('td');
        turbidityCell.textContent = dataPoint.turbidity !== undefined ? dataPoint.turbidity.toFixed(2) : '-';
        if (alertCells.turbidity === 'danger') turbidityCell.className = 'alert-cell';
        else if (alertCells.turbidity === 'warning') turbidityCell.className = 'warning-cell';
        
        const CODCell = document.createElement('td');
        CODCell.textContent = dataPoint.COD !== undefined ? dataPoint.COD.toFixed(2) : '-';
        if (alertCells.COD === 'danger') CODCell.className = 'alert-cell';
        else if (alertCells.COD === 'warning') CODCell.className = 'warning-cell';
        
        const DOCell = document.createElement('td');
        DOCell.textContent = dataPoint.DO !== undefined ? dataPoint.DO.toFixed(2) : '-';
        if (alertCells.DO === 'danger') DOCell.className = 'alert-cell';
        else if (alertCells.DO === 'warning') DOCell.className = 'warning-cell';
        
        const ECCell = document.createElement('td');
        ECCell.textContent = dataPoint.EC !== undefined ? dataPoint.EC.toFixed(2) : '-';
        if (alertCells.EC === 'danger') ECCell.className = 'alert-cell';
        else if (alertCells.EC === 'warning') ECCell.className = 'warning-cell';
        
        const statusCell = document.createElement('td');
        let statusText = '正常';
        if (hasAlert) {
            statusText = '危险';
            statusCell.style.color = '#e74c3c';
            statusCell.style.fontWeight = 'bold';
        } else if (hasWarning) {
            statusText = '警告';
            statusCell.style.color = '#f39c12';
            statusCell.style.fontWeight = 'bold';
        }
        
        statusCell.innerHTML = statusText;
        if (alertText) {
            statusCell.innerHTML += `<br><small style="color: #${hasAlert ? 'e74c3c' : 'f39c12'}; font-size: 0.8rem;">${alertText}</small>`;
        }
        
        // 构建行
        row.innerHTML = `<td>${rowNumber}</td>`;
        row.appendChild(timeCell);
        row.appendChild(illuminationCell);
        row.appendChild(temperatureCell);
        row.appendChild(humidityCell);
        row.appendChild(phCell);
        row.appendChild(microbialCell);
        row.appendChild(turbidityCell);
        row.appendChild(CODCell);
        row.appendChild(DOCell);
        row.appendChild(ECCell);
        row.appendChild(statusCell);
        
        tableBody.appendChild(row);
    });
    
    updatePaginationInfo();
}

// 更新分页信息
function updatePaginationInfo() {
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, environmentData.length);
    
    document.getElementById('pageInfo').textContent = `第 ${currentPage} 页，共 ${totalPages} 页`;
    document.getElementById('displayStart').textContent = startIndex;
    document.getElementById('displayEnd').textContent = endIndex;
    document.getElementById('totalDisplay').textContent = environmentData.length;
    
    // 更新按钮状态
    document.getElementById('prevBtn').disabled = currentPage <= 1;
    document.getElementById('nextBtn').disabled = currentPage >= totalPages;
}

// 上一页
function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        updateDataTable();
    }
}

// 下一页
function nextPage() {
    if (currentPage < totalPages) {
        currentPage++;
        updateDataTable();
    }
}

// 改变每页显示数量
function changePageSize() {
    const newSize = parseInt(document.getElementById('pageSizeSelect').value);
    if (newSize !== pageSize) {
        pageSize = newSize;
        currentPage = 1; // 重置到第一页
        updateDataTable();
    }
}

// 高亮异常行
function highlightAlerts() {
    const rows = document.querySelectorAll('#dataTableBody tr');
    rows.forEach(row => {
        if (row.classList.contains('alert-row') || row.classList.contains('warning-row')) {
            row.style.animation = 'pulse 2s infinite';
        }
    });
    
    setTimeout(() => {
        rows.forEach(row => {
            row.style.animation = '';
        });
    }, 3000);
}

// 初始化图表
function initializeChart() {
    const ctx = document.getElementById('dataChart').getContext('2d');
    dataChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: '数据',
                data: [],
                borderColor: '#3498db',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                borderWidth: 2,
                fill: false,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: '时间序列'
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: '数值'
                    }
                }
            }
        }
    });
}

// 更新图表
function updateChart() {
    if (!dataChart || timeData.length === 0) return;
    
    const chartType = document.getElementById('chartSelect').value;
    let label = '';
    let data = [];
    let color = '#3498db';
    let configKey = '';
    
    switch(chartType) {
        case 'temperature':
            label = '温度(℃)';
            data = temperatureData;
            color = '#e74c3c';
            configKey = 'temperature';
            break;
        case 'illumination':
            label = '光照强度(lux)';
            data = illuminationData;
            color = '#f39c12';
            configKey = 'illumination_intensity';
            break;
        case 'humidity':
            label = '湿度(%)';
            data = humidityData;
            color = '#3498db';
            configKey = 'humidity';
            break;
        case 'ph':
            label = 'pH值';
            data = phData;
            color = '#9b59b6';
            configKey = 'ph';
            break;
        case 'microbial':
            label = '微生物密度(CFU/mL)';
            data = microbialData;
            color = '#2ecc71';
            configKey = 'microbial_density';
            break;
        case 'turbidity':
            label = '浊度(NTU)';
            data = turbidityData;
            color = '#1abc9c';
            configKey = 'turbidity';
            break;
        case 'COD':
            label = '化学需氧量(mg/L)';
            data = CODData;
            color = '#e67e22';
            configKey = 'COD';
            break;
        case 'DO':
            label = '溶解氧(mg/L)';
            data = DOData;
            color = '#34495e';
            configKey = 'DO';
            break;
        case 'EC':
            label = '电导率(μS/cm)';
            data = ECData;
            color = '#8e44ad';
            configKey = 'EC';
            break;
    }
    
    // 简化时间标签
    const displayLabels = timeData.map((time, index) => {
        if (timeData.length > 20) {
            if (index % Math.ceil(timeData.length / 10) === 0 || index === timeData.length - 1) {
                return time.split(' ')[1] || time;
            }
            return '';
        }
        return time;
    });
    
    // 更新图表数据
    dataChart.data.labels = displayLabels;
    dataChart.data.datasets = [{
        label: label,
        data: data,
        borderColor: color,
        backgroundColor: 'rgba(255, 255, 255, 0)',
        borderWidth: 2,
        fill: false,
        tension: 0.4
    }];
    
    // 添加阈值线
    const config = currentConfig[configKey];
    const thresholdLines = [];
    
    if (config) {
        if (config.normal_min !== undefined && config.normal_min !== null) {
            thresholdLines.push({
                type: 'line',
                label: '正常下限',
                data: Array(data.length).fill(config.normal_min),
                borderColor: '#27ae60',
                borderWidth: 1,
                borderDash: [5, 5],
                fill: false
            });
        }
        
        if (config.normal_max !== undefined && config.normal_max !== null) {
            thresholdLines.push({
                type: 'line',
                label: '正常上限',
                data: Array(data.length).fill(config.normal_max),
                borderColor: '#27ae60',
                borderWidth: 1,
                borderDash: [5, 5],
                fill: false
            });
        }
        
        if (config.warning_min !== undefined && config.warning_min !== null) {
            thresholdLines.push({
                type: 'line',
                label: '警告下限',
                data: Array(data.length).fill(config.warning_min),
                borderColor: '#f39c12',
                borderWidth: 2,
                borderDash: [10, 5],
                fill: false
            });
        }
        
        if (config.warning_max !== undefined && config.warning_max !== null) {
            thresholdLines.push({
                type: 'line',
                label: '警告上限',
                data: Array(data.length).fill(config.warning_max),
                borderColor: '#f39c12',
                borderWidth: 2,
                borderDash: [10, 5],
                fill: false
            });
        }
    }
    
    // 合并阈值线到数据集
    dataChart.data.datasets = [dataChart.data.datasets[0], ...thresholdLines];
    
    // 更新阈值信息显示
    updateChartThresholdInfo(configKey);
    
    dataChart.update();
}

// 更新图表阈值信息
function updateChartThresholdInfo(metric) {
    const container = document.getElementById('chartThresholdInfo');
    const config = currentConfig[metric];
    
    if (!config) {
        container.innerHTML = '<i class="fas fa-info-circle"></i> 未配置阈值';
        return;
    }
    
    let info = `<i class="fas fa-info-circle"></i> 阈值设置: `;
    
    if (config.normal_min !== undefined && config.normal_max !== undefined) {
        info += `正常范围: ${config.normal_min}-${config.normal_max}${config.unit}`;
    }
    
    if (config.warning_min !== undefined && config.warning_max !== undefined) {
        info += ` | 警告范围: ${config.warning_min}-${config.warning_max}${config.unit}`;
    }
    
    container.innerHTML = info;
}

// 导出图表
function exportChart() {
    if (!dataChart) {
        alert('图表未初始化');
        return;
    }
    
    const link = document.createElement('a');
    link.download = `chart_${new Date().toISOString().split('T')[0]}.png`;
    link.href = dataChart.toBase64Image();
    link.click();
}

// 切换数据视图
function toggleDataView() {
    isTableView = !isTableView;
    
    if (isTableView) {
        document.getElementById('dataTableContainer').style.display = 'block';
        document.getElementById('rawDataView').style.display = 'none';
    } else {
        document.getElementById('dataTableContainer').style.display = 'none';
        showRawData();
    }
}

// 显示原始数据
function showRawData() {
    fetch('/api/raw')
        .then(response => response.text())
        .then(data => {
            document.getElementById('rawDataView').textContent = data;
            document.getElementById('rawDataView').style.display = 'block';
        })
        .catch(error => {
            console.error('获取原始数据失败:', error);
            document.getElementById('rawDataView').textContent = '获取原始数据失败: ' + error.message;
            document.getElementById('rawDataView').style.display = 'block';
        });
}

// 导出数据
function exportData() {
    if (environmentData.length === 0) {
        alert('没有可导出的数据');
        return;
    }
    
    const exportObj = {
        metadata: {
            exportDate: new Date().toISOString(),
            source: 'data.csv',
            totalRecords: environmentData.length,
            hasAlerts: hasAlerts
        },
        config: currentConfig,
        statistics: dataStatistics,
        data: environmentData
    };
    
    const dataStr = JSON.stringify(exportObj, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `environment_data_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    alert('数据已导出为JSON文件');
}

// 加载配置
function loadConfig() {
    fetch('/api/config')
        .then(response => response.json())
        .then(config => {
            currentConfig = config;
            console.log('配置加载成功:', config);
            updateConfigDisplay();
        })
        .catch(error => {
            console.error('加载配置失败:', error);
        });
}

// 显示配置信息
function updateConfigDisplay() {
    const container = document.getElementById('configContainer');
    if (!container || !currentConfig) return;
    
    let html = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 15px;">';
    
    Object.entries(currentConfig).forEach(([key, config]) => {
        const hasNormalMin = config.normal_min !== undefined;
        const hasNormalMax = config.normal_max !== undefined;
        const hasWarningMin = config.warning_min !== undefined;
        const hasWarningMax = config.warning_max !== undefined;
        
        let normalRange = '未设置';
        let warningRange = '未设置';
        
        if (hasNormalMin && hasNormalMax) {
            normalRange = `${config.normal_min} - ${config.normal_max}`;
        } else if (hasNormalMin) {
            normalRange = `≥ ${config.normal_min}`;
        } else if (hasNormalMax) {
            normalRange = `≤ ${config.normal_max}`;
        }
        
        if (hasWarningMin && hasWarningMax) {
            warningRange = `${config.warning_min} - ${config.warning_max}`;
        } else if (hasWarningMin) {
            warningRange = `≥ ${config.warning_min}`;
        } else if (hasWarningMax) {
            warningRange = `≤ ${config.warning_max}`;
        }
        
        html += `
            <div style="background: white; padding: 15px; border-radius: 8px; border: 1px solid #eaeaea; box-shadow: 0 2px 5px rgba(0,0,0,0.05);">
                <div style="display: flex; align-items: center; margin-bottom: 10px;">
                    <div style="width: 12px; height: 12px; background: #3498db; border-radius: 50%; margin-right: 10px;"></div>
                    <strong>${config.description || key}</strong>
                </div>
                <div style="margin-bottom: 8px;">
                    <small style="color: #7f8c8d;">正常范围:</small><br>
                    <span style="color: #27ae60; font-weight: 500;">${normalRange} ${config.unit}</span>
                </div>
                <div>
                    <small style="color: #7f8c8d;">警告范围:</small><br>
                    <span style="color: #f39c12; font-weight: 500;">${warningRange} ${config.unit}</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}

// 更新统计数据
function updateStatistics() {
    const container = document.getElementById('statisticsContainer');
    if (!container) return;
    
    const stats = dataStatistics;
    
    container.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">温度统计</h4>
                <p>平均值: <strong>${stats.temperature?.avg?.toFixed(2) || 0}℃</strong></p>
                <p>最小值: ${stats.temperature?.min?.toFixed(2) || 0}℃</p>
                <p>最大值: ${stats.temperature?.max?.toFixed(2) || 0}℃</p>
                <p>标准差: ${stats.temperature?.stdDev?.toFixed(2) || 0}℃</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">湿度统计</h4>
                <p>平均值: <strong>${stats.humidity?.avg?.toFixed(2) || 0}%</strong></p>
                <p>最小值: ${stats.humidity?.min?.toFixed(2) || 0}%</p>
                <p>最大值: ${stats.humidity?.max?.toFixed(2) || 0}%</p>
                <p>标准差: ${stats.humidity?.stdDev?.toFixed(2) || 0}%</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">光照统计</h4>
                <p>平均值: <strong>${stats.illumination_intensity?.avg?.toFixed(2) || 0} lux</strong></p>
                <p>最小值: ${stats.illumination_intensity?.min?.toFixed(2) || 0} lux</p>
                <p>最大值: ${stats.illumination_intensity?.max?.toFixed(2) || 0} lux</p>
                <p>标准差: ${stats.illumination_intensity?.stdDev?.toFixed(2) || 0} lux</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">pH值统计</h4>
                <p>平均值: <strong>${stats.ph?.avg?.toFixed(2) || 0}</strong></p>
                <p>最小值: ${stats.ph?.min?.toFixed(2) || 0}</p>
                <p>最大值: ${stats.ph?.max?.toFixed(2) || 0}</p>
                <p>标准差: ${stats.ph?.stdDev?.toFixed(2) || 0}</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">微生物密度统计</h4>
                <p>平均值: <strong>${Math.round(stats.microbial_density?.avg || 0).toLocaleString()} CFU/mL</strong></p>
                <p>最小值: ${Math.round(stats.microbial_density?.min || 0).toLocaleString()} CFU/mL</p>
                <p>最大值: ${Math.round(stats.microbial_density?.max || 0).toLocaleString()} CFU/mL</p>
                <p>标准差: ${Math.round(stats.microbial_density?.stdDev || 0).toLocaleString()} CFU/mL</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">浊度统计</h4>
                <p>平均值: <strong>${stats.turbidity?.avg?.toFixed(2) || 0} NTU</strong></p>
                <p>最小值: ${stats.turbidity?.min?.toFixed(2) || 0} NTU</p>
                <p>最大值: ${stats.turbidity?.max?.toFixed(2) || 0} NTU</p>
                <p>标准差: ${stats.turbidity?.stdDev?.toFixed(2) || 0} NTU</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">COD统计</h4>
                <p>平均值: <strong>${stats.COD?.avg?.toFixed(2) || 0} mg/L</strong></p>
                <p>最小值: ${stats.COD?.min?.toFixed(2) || 0} mg/L</p>
                <p>最大值: ${stats.COD?.max?.toFixed(2) || 0} mg/L</p>
                <p>标准差: ${stats.COD?.stdDev?.toFixed(2) || 0} mg/L</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">溶解氧统计</h4>
                <p>平均值: <strong>${stats.DO?.avg?.toFixed(2) || 0} mg/L</strong></p>
                <p>最小值: ${stats.DO?.min?.toFixed(2) || 0} mg/L</p>
                <p>最大值: ${stats.DO?.max?.toFixed(2) || 0} mg/L</p>
                <p>标准差: ${stats.DO?.stdDev?.toFixed(2) || 0} mg/L</p>
            </div>
            
            <div>
                <h4 style="color: #7f8c8d; margin-bottom: 10px;">电导率统计</h4>
                <p>平均值: <strong>${stats.EC?.avg?.toFixed(2) || 0} μS/cm</strong></p>
                <p>最小值: ${stats.EC?.min?.toFixed(2) || 0} μS/cm</p>
                <p>最大值: ${stats.EC?.max?.toFixed(2) || 0} μS/cm</p>
                <p>标准差: ${stats.EC?.stdDev?.toFixed(2) || 0} μS/cm</p>
            </div>
        </div>
        
        <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #eaeaea;">
            <p><i class="fas fa-info-circle"></i> 数据时间范围: ${stats.timeRange?.start || '未知'} 至 ${stats.timeRange?.end || '未知'}</p>
            <p>总记录数: ${environmentData.length} 条</p>
            <p>监测指标: 9项 (温度、湿度、光照、pH、微生物密度、浊度、COD、溶解氧、电导率)</p>
        </div>
    `;
}

// 辅助函数
function showLoading() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('dataTableContainer').style.display = 'none';
}

function updateProgress(percent) {
    document.getElementById('dataProgress').style.width = percent + '%';
}