import { useState } from 'react';
import axios from 'axios';

function AnswerSheetScanner({ bankId, onComplete }) {
    const [image, setImage] = useState(null);
    const [preview, setPreview] = useState(null);
    const [scanning, setScanning] = useState(false);
    const [result, setResult] = useState(null);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImage(file);
            setPreview(URL.createObjectURL(file));
            setResult(null);
        }
    };

    const handleScan = async () => {
        if (!image) {
            alert('请先选择答题卡图片');
            return;
        }

        setScanning(true);
        const formData = new FormData();
        formData.append('image', image);
        formData.append('bankId', bankId);

        try {
            const response = await axios.post('http://localhost:3001/api/answer-sheet/scan', formData);
            if (response.data.success) {
                setResult(response.data.data);
                if (onComplete) {
                    onComplete(response.data.data);
                }
            } else {
                alert('识别失败: ' + response.data.error);
            }
        } catch (error) {
            console.error('扫描失败:', error);
            alert('扫描失败，请重试');
        }
        setScanning(false);
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>📸 答题卡扫描</h2>
            
            <div style={{
                border: '2px dashed #ccc',
                borderRadius: '8px',
                padding: '20px',
                textAlign: 'center',
                marginBottom: '20px'
            }}>
                <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    style={{ marginBottom: '10px' }}
                />
                {preview && (
                    <div>
                        <img src={preview} alt="预览" style={{ maxWidth: '100%', maxHeight: '300px' }} />
                    </div>
                )}
            </div>
            
            <button
                onClick={handleScan}
                disabled={!image || scanning}
                style={{
                    width: '100%',
                    padding: '12px',
                    background: !image || scanning ? '#ccc' : '#1890ff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: !image || scanning ? 'not-allowed' : 'pointer',
                    fontSize: '16px'
                }}
            >
                {scanning ? '识别中...' : '🔍 开始识别'}
            </button>
            
            {result && (
                <div style={{
                    marginTop: '20px',
                    padding: '15px',
                    background: '#f6ffed',
                    borderRadius: '8px',
                    border: '1px solid #b7eb8f'
                }}>
                    <h3>📊 评分结果</h3>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', margin: '10px 0' }}>
                        {result.percentage}分
                    </div>
                    <div style={{ textAlign: 'center', color: '#666', marginBottom: '15px' }}>
                        得分：{result.totalScore} / {result.maxScore}
                    </div>
                    
                    <details>
                        <summary style={{ cursor: 'pointer', color: '#1890ff' }}>查看详细</summary>
                        <div style={{ marginTop: '10px' }}>
                            {result.results.map((r, idx) => (
                                <div key={idx} style={{
                                    padding: '8px',
                                    marginBottom: '5px',
                                    background: r.isCorrect ? '#f6ffed' : '#fff2f0',
                                    borderRadius: '4px'
                                }}>
                                    第 {r.number} 题：{r.userAnswer} {r.isCorrect ? '✓' : '✗'}（正确答案：{r.correctAnswer}）
                                </div>
                            ))}
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}

router.get('/generate', async (req, res) => {
    const bankId = req.query.bankId;
    const subject = req.query.subject;
    const title = req.query.title;
    
    let targetBankId = bankId;
    
    // 如果没有直接提供 bankId，通过 subject 和 title 查找
    if (!targetBankId && subject && title) {
        try {
            const sqlite3 = require('sqlite3').verbose();
            const { open } = require('sqlite');
            const path = require('path');
            
            const db = await open({
                filename: path.join(__dirname, '../../data/knowledge/chunkao.db'),
                driver: sqlite3.Database
            });
            
            // 清理标题
            let cleanTitle = title;
            cleanTitle = cleanTitle.replace(/（教师版）/, '');
            cleanTitle = cleanTitle.replace(/（学生版）/, '');
            cleanTitle = cleanTitle.replace(/（复习讲义）/, '');
            cleanTitle = cleanTitle.replace(/（上海专用）/, '');
            cleanTitle = cleanTitle.trim();
            
            // 查找匹配的题库
            const bank = await db.get(
                `SELECT id FROM question_banks 
                 WHERE subject_id = ? AND (title LIKE ? OR title LIKE ?)
                 LIMIT 1`,
                [subject, `%${cleanTitle}%`, `%${title}%`]
            );
            
            if (bank) {
                targetBankId = bank.id;
                console.log('找到题库:', targetBankId);
            }
            
            await db.close();
        } catch (err) {
            console.error('查找题库失败:', err);
        }
    }
    
    if (!targetBankId) {
        return res.status(400).send('缺少 bankId 参数，且未能通过 subject+title 找到匹配的题库\n\n请使用: ?bankId=题库ID 或 ?subject=学科&title=专题名称');
    }
    
    await generateAnswerSheet(targetBankId, res);
});

export default AnswerSheetScanner;