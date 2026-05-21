function srtToVtt(srtContent) {
    // SRT 转 VTT 格式
    let vtt = 'WEBVTT\n\n';
    
    // 移除 BOM 头
    srtContent = srtContent.replace(/^\uFEFF/, '');
    
    // 按块分割
    const blocks = srtContent.trim().split(/\n\s*\n/);
    
    for (const block of blocks) {
        const lines = block.split('\n');
        if (lines.length >= 2) {
            // 跳过序号行（第一行是序号）
            const timeLine = lines[1];
            const textLines = lines.slice(2);
            
            // 转换时间格式：00:00:00,000 -> 00:00:00.000
            const timeLineVtt = timeLine.replace(/,/g, '.');
            
            vtt += `${timeLineVtt}\n`;
            vtt += `${textLines.join('\n')}\n\n`;
        }
    }
    
    return vtt;
}

module.exports = { srtToVtt };