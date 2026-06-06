-- ============================================
-- 春考伴学系统 - 完整数据库初始化脚本（合并版）
-- 基于原有 chunkao.db 导出结构，包含所有表、索引、外键
-- ============================================

-- ----------------------------
-- 1. 学科表
-- ----------------------------
CREATE TABLE subjects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL
);

-- ----------------------------
-- 2. 版本表
-- ----------------------------
CREATE TABLE versions (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL
);

-- ----------------------------
-- 3. 专题表
-- ----------------------------
CREATE TABLE topics (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    code TEXT,
    title TEXT NOT NULL,
    teacher_file TEXT,
    student_file TEXT,
    source_dir TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(version_id) REFERENCES versions(id)
);

-- ----------------------------
-- 4. 知识点表
-- ----------------------------
CREATE TABLE knowledge_points (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(subject_id, name),
    FOREIGN KEY(subject_id) REFERENCES subjects(id)
);

-- ----------------------------
-- 5. 专题-知识点关联表
-- ----------------------------
CREATE TABLE topic_knowledge_points (
    topic_id TEXT NOT NULL,
    knowledge_point_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.6,
    source TEXT NOT NULL DEFAULT 'filename',
    PRIMARY KEY(topic_id, knowledge_point_id),
    FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY(knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE
);

-- ----------------------------
-- 6. 资料来源表
-- ----------------------------
CREATE TABLE source_files (
    id TEXT PRIMARY KEY,
    topic_id TEXT,
    subject_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    role TEXT NOT NULL,
    file_path TEXT NOT NULL UNIQUE,
    file_name TEXT NOT NULL,
    file_ext TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL
);

-- ----------------------------
-- 7. 题库表
-- ----------------------------
CREATE TABLE question_banks (
    id TEXT PRIMARY KEY,
    topic_id TEXT,
    subject_id TEXT NOT NULL,
    version_id TEXT,
    title TEXT NOT NULL,
    source_path TEXT,
    total_questions INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    source_title TEXT,
    source_format TEXT,
    paper_type TEXT,
    year INTEGER,
    FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(version_id) REFERENCES versions(id)
);

-- ----------------------------
-- 8. 题目表
-- ----------------------------
CREATE TABLE questions (
    id TEXT PRIMARY KEY,
    bank_id TEXT NOT NULL,
    topic_id TEXT,
    subject_id TEXT NOT NULL,
    version_id TEXT,
    number INTEGER,
    original_number TEXT,
    type TEXT NOT NULL DEFAULT 'qa',
    content TEXT NOT NULL,
    source_answer TEXT DEFAULT '',
    final_answer TEXT DEFAULT '',
    analysis TEXT DEFAULT '',
    score REAL,
    difficulty TEXT,
    source TEXT NOT NULL DEFAULT 'imported_bank',
    raw_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    page_number INTEGER,
    source_file_id TEXT,
    parse_confidence REAL,
    needs_review INTEGER NOT NULL DEFAULT 0,
    my_answer TEXT DEFAULT '',
    peer_answers TEXT DEFAULT '{}',
    ai_answers TEXT DEFAULT '{}',
    discussion TEXT DEFAULT '',
    FOREIGN KEY(bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
    FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(version_id) REFERENCES versions(id)
);

-- ----------------------------
-- 9. 题目-知识点关联表
-- ----------------------------
CREATE TABLE question_knowledge_points (
    question_id TEXT NOT NULL,
    knowledge_point_id TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 0.5,
    source TEXT NOT NULL DEFAULT 'rule',
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY(question_id, knowledge_point_id),
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY(knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE
);

-- ----------------------------
-- 10. 题目资源表（截图、公式图片等）
-- ----------------------------
CREATE TABLE question_assets (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    file_path TEXT NOT NULL,
    page_number INTEGER,
    bbox_json TEXT,
    description TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE
);

-- ----------------------------
-- 11. 题目解析日志表
-- ----------------------------
CREATE TABLE question_parse_logs (
    id TEXT PRIMARY KEY,
    bank_id TEXT,
    question_id TEXT,
    source_file_id TEXT,
    action TEXT NOT NULL,
    message TEXT DEFAULT '',
    payload_json TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
    FOREIGN KEY(question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY(source_file_id) REFERENCES source_files(id) ON DELETE SET NULL
);

-- ----------------------------
-- 12. 树状知识图谱节点表
-- ----------------------------
CREATE TABLE knowledge_nodes (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    topic_id TEXT,
    parent_id TEXT,
    node_type TEXT NOT NULL,
    title TEXT NOT NULL,
    content_json TEXT DEFAULT '{}',
    source_file_id TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(subject_id) REFERENCES subjects(id),
    FOREIGN KEY(version_id) REFERENCES versions(id),
    FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE,
    FOREIGN KEY(parent_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(source_file_id) REFERENCES source_files(id) ON DELETE SET NULL
);

-- ----------------------------
-- 13. 知识图谱边关系表
-- ----------------------------
CREATE TABLE knowledge_edges (
    id TEXT PRIMARY KEY,
    from_node_id TEXT NOT NULL,
    to_node_id TEXT NOT NULL,
    relation_type TEXT NOT NULL,
    note TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    FOREIGN KEY(from_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(to_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);

-- ----------------------------
-- 14. 命题分析表
-- ----------------------------
CREATE TABLE exam_insights (
    id TEXT PRIMARY KEY,
    topic_id TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

-- ----------------------------
-- 15. AI 提供商配置表
-- ----------------------------
CREATE TABLE api_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) NOT NULL,
    api_key TEXT,
    api_url VARCHAR(500),
    model_name VARCHAR(100),
    is_active BOOLEAN DEFAULT 0,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- 16. 系统配置表
-- ----------------------------
CREATE TABLE system_configs (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ----------------------------
-- 17. 答题卡记录表
-- ----------------------------
CREATE TABLE student_answer_sheets (
    id TEXT PRIMARY KEY,
    student_id TEXT DEFAULT 'current_user',
    bank_id TEXT NOT NULL,
    total_score REAL,
    max_score REAL,
    wrong_count INTEGER,
    answers TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (bank_id) REFERENCES question_banks(id) ON DELETE CASCADE
);

-- ----------------------------
-- 18. 错题知识点映射表
-- ----------------------------
CREATE TABLE student_wrong_knowledge (
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
-- 19. 学生画像汇总表
-- ----------------------------
CREATE TABLE student_profile (
    student_id TEXT PRIMARY KEY,
    total_questions_answered INTEGER DEFAULT 0,
    total_correct INTEGER DEFAULT 0,
    total_wrong INTEGER DEFAULT 0,
    average_score REAL DEFAULT 0,
    weak_knowledge_points TEXT,
    updated_at TEXT NOT NULL
);

-- ----------------------------
-- 索引（按原有顺序）
-- ----------------------------
CREATE INDEX idx_question_banks_subject ON question_banks(subject_id, version_id);
CREATE INDEX idx_questions_bank ON questions(bank_id, number);
CREATE INDEX idx_questions_topic ON questions(topic_id);
CREATE INDEX idx_questions_subject ON questions(subject_id, version_id);
CREATE INDEX idx_qkp_knowledge ON question_knowledge_points(knowledge_point_id);
CREATE INDEX idx_question_assets_question ON question_assets(question_id);
CREATE INDEX idx_knowledge_nodes_topic ON knowledge_nodes(topic_id, parent_id, sort_order);
CREATE INDEX idx_knowledge_nodes_subject ON knowledge_nodes(subject_id, version_id, node_type);
CREATE INDEX idx_knowledge_edges_from ON knowledge_edges(from_node_id, relation_type);
CREATE INDEX idx_exam_insights_topic ON exam_insights(topic_id, insight_type);
CREATE INDEX idx_student_answer_sheets_student ON student_answer_sheets(student_id);
CREATE INDEX idx_student_wrong_knowledge_student ON student_wrong_knowledge(student_id);

-- ----------------------------
-- 可选：插入默认系统配置（优先使用本地 Ollama）
-- ----------------------------
INSERT OR IGNORE INTO system_configs (key, value) VALUES ('ai_priority', 'local_first');
