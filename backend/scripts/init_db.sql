-- ============================================
-- 春考伴学系统 - 完整数据库初始化脚本
-- 包含：知识库、题库、AI配置、答题卡、学生画像
-- ============================================

-- ----------------------------
-- 1. 学科表
-- ----------------------------
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------
-- 2. 版本表
-- ----------------------------
CREATE TABLE IF NOT EXISTS versions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------
-- 3. 专题表
-- ----------------------------
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (version_id) REFERENCES versions(id)
);

-- ----------------------------
-- 4. 知识点表
-- ----------------------------
CREATE TABLE IF NOT EXISTS knowledge_points (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ----------------------------
-- 5. 专题-知识点关联表
-- ----------------------------
CREATE TABLE IF NOT EXISTS topic_knowledge_points (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    knowledge_point_id TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'manual',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (topic_id) REFERENCES topics(id),
    FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
);

-- ----------------------------
-- 6. 资料来源表
-- ----------------------------
CREATE TABLE IF NOT EXISTS source_files (
    id TEXT PRIMARY KEY,
    file_path TEXT NOT NULL,
    file_name TEXT,
    subject_id TEXT,
    version_id TEXT,
    page_start INTEGER,
    page_end INTEGER,
    extracted_text TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (version_id) REFERENCES versions(id)
);

-- ----------------------------
-- 7. 题库表
-- ----------------------------
CREATE TABLE IF NOT EXISTS question_banks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    version_id TEXT,
    year INTEGER,
    total_score REAL,
    total_questions INTEGER,
    paper_type TEXT,
    source_format TEXT,
    source_path TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (version_id) REFERENCES versions(id)
);

-- ----------------------------
-- 8. 题目表
-- ----------------------------
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL,
    number INTEGER NOT NULL,
    type TEXT,                      -- fill, choice, qa
    content TEXT NOT NULL,
    source_answer TEXT,             -- 资料原始答案
    my_answer TEXT,                 -- 我的最终答案
    peer_answers TEXT,              -- JSON 存储同学答案
    ai_answers TEXT,                -- JSON 存储各模型答案
    discussion TEXT,                -- 讨论记录
    analysis TEXT,                  -- 解析
    score REAL,                     -- 分值
    difficulty REAL,                -- 难度系数（0-1）
    year INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
);

-- ----------------------------
-- 9. 题目资源表（截图、公式图片等）
-- ----------------------------
CREATE TABLE IF NOT EXISTS question_assets (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    bank_id TEXT NOT NULL,
    asset_type TEXT,                -- screenshot, formula, figure
    file_path TEXT NOT NULL,
    page_number INTEGER,
    bbox_json TEXT,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
);

-- ----------------------------
-- 10. 题目-知识点关联表（最终确认）
-- ----------------------------
CREATE TABLE IF NOT EXISTS question_knowledge_points (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    knowledge_point_id TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    source TEXT DEFAULT 'manual',
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
);

-- ----------------------------
-- 11. 树状知识图谱节点表
-- ----------------------------
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id TEXT PRIMARY KEY,
    node_type TEXT,                 -- course, topic, knowledge_point, sub_point
    title TEXT NOT NULL,
    content_json TEXT,
    subject_id TEXT,
    version_id TEXT,
    parent_id TEXT,                 -- 父节点ID（如果是根节点则为 NULL）
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (subject_id) REFERENCES subjects(id),
    FOREIGN KEY (version_id) REFERENCES versions(id)
);

-- ----------------------------
-- 12. 知识图谱边关系表（前置/后续/包含等）
-- ----------------------------
CREATE TABLE IF NOT EXISTS knowledge_edges (
    id TEXT PRIMARY KEY,
    source_node_id TEXT NOT NULL,
    target_node_id TEXT NOT NULL,
    relation_type TEXT,             -- prerequisite, subsequent, contains, part_of
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (source_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);

-- ----------------------------
-- 13. 命题分析表
-- ----------------------------
CREATE TABLE IF NOT EXISTS exam_insights (
    id TEXT PRIMARY KEY,
    knowledge_point_id TEXT,
    title TEXT,
    summary TEXT,
    year INTEGER,
    score REAL,
    question_number TEXT,
    note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points(id)
);

-- ----------------------------
-- 14. AI 提供商配置表（原 api_configs.sql）
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
-- 15. 系统配置表
-- ----------------------------
CREATE TABLE IF NOT EXISTS system_configs (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认系统配置（优先使用本地 Ollama）
INSERT OR IGNORE INTO system_configs (key, value) VALUES ('ai_priority', 'local_first');

-- ----------------------------
-- 16. 答题卡：学生答题批改记录表
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
-- 17. 错题知识点映射表
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
-- 18. 学生画像汇总表
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
-- 索引优化（可选）
-- ----------------------------
CREATE INDEX IF NOT EXISTS idx_questions_bank_id ON questions(bank_id);
CREATE INDEX IF NOT EXISTS idx_question_knowledge_points_question ON question_knowledge_points(question_id);
CREATE INDEX IF NOT EXISTS idx_student_answer_sheets_student ON student_answer_sheets(student_id);
CREATE INDEX IF NOT EXISTS idx_student_wrong_knowledge_student ON student_wrong_knowledge(student_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_parent ON knowledge_nodes(parent_id);