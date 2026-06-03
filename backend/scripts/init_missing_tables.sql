-- ============================================
-- 春考伴学系统 - 补全缺失表（不影响现有数据）
-- 仅添加：AI配置表 + 答题卡相关表 + 学生画像表
-- ============================================

-- ----------------------------
-- 1. AI 提供商配置表（来自 api_configs.sql）
-- ----------------------------
CREATE TABLE IF NOT EXISTS api_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,           -- 'deepseek', 'openrouter', 'gemini', 'custom'
    api_key TEXT,                        -- 建议应用层加密存储
    api_url VARCHAR(500),                -- API 端点地址
    model_name VARCHAR(100),             -- 模型名称
    is_active BOOLEAN DEFAULT 0,         -- 是否启用
    priority INTEGER DEFAULT 0,          -- 优先级（数字越小优先级越高）
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- 2. 系统配置表
-- ----------------------------
CREATE TABLE IF NOT EXISTS system_configs (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认系统配置（如果表为空，则插入；否则忽略）
INSERT OR IGNORE INTO system_configs (key, value) VALUES ('ai_priority', 'local_first');

-- ----------------------------
-- 3. 答题卡：学生答题批改记录表
-- ----------------------------
CREATE TABLE IF NOT EXISTS student_answer_sheets (
    id TEXT PRIMARY KEY,
    student_id TEXT DEFAULT 'current_user',
    bank_id TEXT NOT NULL,
    total_score REAL,
    max_score REAL,
    wrong_count INTEGER,
    answers TEXT,                       -- JSON: { "question_id": "correct/wrong" }
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
);

-- ----------------------------
-- 4. 错题知识点映射表
-- ----------------------------
CREATE TABLE IF NOT EXISTS student_wrong_knowledge (
    id TEXT PRIMARY KEY,
    student_id TEXT DEFAULT 'current_user',
    question_id TEXT NOT NULL,
    knowledge_point_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    sheet_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id),
    FOREIGN KEY (bank_id) REFERENCES question_banks(id),
    FOREIGN KEY (sheet_id) REFERENCES student_answer_sheets(id) ON DELETE CASCADE
);

-- ----------------------------
-- 5. 学生画像汇总表
-- ----------------------------
CREATE TABLE IF NOT EXISTS student_profile (
    student_id TEXT PRIMARY KEY,
    total_questions_answered INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    average_score REAL DEFAULT 0,
    weak_knowledge_points TEXT,        -- JSON: [{ "id": "kp_id", "name": "知识点名", "accuracy": 0.3 }]
    updated_at TEXT NOT NULL
);

-- ----------------------------
-- 可选：索引优化（如果不存在则创建，不影响已有）
-- ----------------------------
CREATE INDEX IF NOT EXISTS idx_student_answer_sheets_student ON student_answer_sheets(student_id);
CREATE INDEX IF NOT EXISTS idx_student_wrong_knowledge_student ON student_wrong_knowledge(student_id);