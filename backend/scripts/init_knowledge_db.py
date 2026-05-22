import argparse
import hashlib
import json
import re
import sqlite3
import sys
from datetime import datetime
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = PROJECT_ROOT / "data" / "docs"
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SUBJECT_NAMES = {
    "chinese": "语文",
    "math": "数学",
    "english": "英语",
}

KEYWORD_GROUPS = {
    "chinese": [
        ("文言文", ["文言文", "实词", "虚词", "断句", "翻译", "古文"]),
        ("现代文阅读", ["现代文", "文学类", "社科", "散文", "文本", "阅读"]),
        ("诗歌鉴赏", ["诗歌", "鉴赏", "情感"]),
        ("作文", ["作文", "审题", "立意", "选材", "思辨", "材料作文"]),
        ("积累运用", ["默写", "名篇", "名句", "语言积累", "表达", "积累运用"]),
    ],
    "math": [
        ("函数", ["函数", "导数", "单调", "指数", "对数", "三角"]),
        ("几何", ["几何", "向量", "圆", "直线", "立体"]),
        ("代数", ["代数", "方程", "不等式", "数列", "集合"]),
        ("概率统计", ["概率", "统计", "排列", "组合"]),
    ],
    "english": [
        ("语法", ["语法", "动词", "时态", "语态", "非谓语", "从句"]),
        ("词汇", ["词汇", "选词", "填空", "GVC"]),
        ("阅读", ["阅读", "长难句", "C篇"]),
        ("完形", ["完形"]),
        ("写作", ["写作", "作文", "概要", "邮件", "书信"]),
        ("听力口语", ["听力", "口语", "Speaking", "Listening"]),
    ],
}


def normalize_title(filename):
    title = re.sub(r"\.(pdf|docx)$", "", filename, flags=re.IGNORECASE)
    title = re.sub(r"[（(](学生版|教师版)[）)]", "", title)
    title = re.sub(r"(学生版|教师版)$", "", title)
    return re.sub(r"\s+", " ", title).strip()


def extract_topic_code(title):
    match = re.search(r"(专题\s*\d+|GVC[^（(]*\d+|\d{4}年)", title, re.IGNORECASE)
    if not match:
        return None
    return re.sub(r"\s+", "", match.group(1))


def infer_knowledge_points(subject, title):
    points = []
    for group, keywords in KEYWORD_GROUPS.get(subject, []):
        if any(keyword.lower() in title.lower() for keyword in keywords):
            points.append(group)

    cleaned = re.sub(r"专题\s*\d+", "", title)
    cleaned = re.sub(r"GVC[^（(]*\d+", "", cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r"[（(].*?[）)]", "", cleaned)
    parts = re.split(r"[、，,之与及和：:（）()_\-—\s]+", cleaned)
    for part in parts:
        part = part.strip()
        if 2 <= len(part) <= 12 and part not in ("上海专用", "复习讲义", "知识梳理", "考点精讲精练", "实战训练"):
            points.append(part)

    deduped = []
    for point in points:
        if point and point not in deduped:
            deduped.append(point)
    return deduped[:8]


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def create_schema(conn):
    conn.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS subjects (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS versions (
            id TEXT PRIMARY KEY,
            label TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS topics (
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

        CREATE TABLE IF NOT EXISTS knowledge_points (
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

        CREATE TABLE IF NOT EXISTS topic_knowledge_points (
            topic_id TEXT NOT NULL,
            knowledge_point_id TEXT NOT NULL,
            confidence REAL NOT NULL DEFAULT 0.6,
            source TEXT NOT NULL DEFAULT 'filename',
            PRIMARY KEY(topic_id, knowledge_point_id),
            FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE CASCADE,
            FOREIGN KEY(knowledge_point_id) REFERENCES knowledge_points(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS source_files (
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

        CREATE TABLE IF NOT EXISTS question_banks (
            id TEXT PRIMARY KEY,
            topic_id TEXT,
            subject_id TEXT NOT NULL,
            version_id TEXT,
            title TEXT NOT NULL,
            source_path TEXT,
            total_questions INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL,
            FOREIGN KEY(subject_id) REFERENCES subjects(id),
            FOREIGN KEY(version_id) REFERENCES versions(id)
        );

        CREATE TABLE IF NOT EXISTS questions (
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
            FOREIGN KEY(bank_id) REFERENCES question_banks(id) ON DELETE CASCADE,
            FOREIGN KEY(topic_id) REFERENCES topics(id) ON DELETE SET NULL,
            FOREIGN KEY(subject_id) REFERENCES subjects(id),
            FOREIGN KEY(version_id) REFERENCES versions(id)
        );
        """
    )


def stable_id(*parts):
    raw = "::".join(str(part) for part in parts if part is not None)
    safe = re.sub(r"[^a-zA-Z0-9_\-\u4e00-\u9fff]+", "_", raw)
    safe = safe.strip("_")[:120] or "item"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]
    return f"{safe}_{digest}"


def upsert_seed_rows(conn):
    for subject, name in SUBJECT_NAMES.items():
        conn.execute(
            "INSERT OR REPLACE INTO subjects(id, name) VALUES (?, ?)",
            (subject, name),
        )
    for version in ("2025", "2026"):
        conn.execute(
            "INSERT OR REPLACE INTO versions(id, label) VALUES (?, ?)",
            (version, f"{version}版"),
        )


def scan_docs(conn):
    now = datetime.now().isoformat(timespec="seconds")
    stats = {"topics": 0, "knowledge_points": 0, "source_files": 0}

    for subject_dir in DOCS_ROOT.iterdir() if DOCS_ROOT.exists() else []:
        if not subject_dir.is_dir() or subject_dir.name not in SUBJECT_NAMES:
            continue

        subject = subject_dir.name
        for version_dir in subject_dir.iterdir():
            if not version_dir.is_dir() or version_dir.name not in ("2025", "2026"):
                continue

            version = version_dir.name
            grouped = {}
            for file_path in version_dir.iterdir():
                if not file_path.is_file() or file_path.suffix.lower() not in (".pdf", ".docx"):
                    continue
                if file_path.name.startswith("~$"):
                    continue

                title = normalize_title(file_path.name)
                grouped.setdefault(title, []).append(file_path)

            for title, files in grouped.items():
                topic_id = stable_id(subject, version, title)
                code = extract_topic_code(title)
                teacher_file = None
                student_file = None

                for file_path in files:
                    if "教师版" in file_path.name:
                        teacher_file = file_path.name
                    elif "学生版" in file_path.name:
                        student_file = file_path.name

                conn.execute(
                    """
                    INSERT INTO topics(id, subject_id, version_id, code, title, teacher_file, student_file, source_dir, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET
                        code=excluded.code,
                        title=excluded.title,
                        teacher_file=excluded.teacher_file,
                        student_file=excluded.student_file,
                        source_dir=excluded.source_dir,
                        updated_at=excluded.updated_at
                    """,
                    (
                        topic_id,
                        subject,
                        version,
                        code,
                        title,
                        teacher_file,
                        student_file,
                        str(version_dir.relative_to(PROJECT_ROOT)),
                        now,
                        now,
                    ),
                )
                stats["topics"] += 1

                for file_path in files:
                    role = "teacher" if "教师版" in file_path.name else "student" if "学生版" in file_path.name else "reference"
                    file_id = stable_id(subject, version, file_path.name)
                    rel_path = str(file_path.relative_to(PROJECT_ROOT))
                    conn.execute(
                        """
                        INSERT INTO source_files(id, topic_id, subject_id, version_id, role, file_path, file_name, file_ext, size_bytes, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(file_path) DO UPDATE SET
                            topic_id=excluded.topic_id,
                            role=excluded.role,
                            size_bytes=excluded.size_bytes,
                            updated_at=excluded.updated_at
                        """,
                        (
                            file_id,
                            topic_id,
                            subject,
                            version,
                            role,
                            rel_path,
                            file_path.name,
                            file_path.suffix.lower(),
                            file_path.stat().st_size,
                            now,
                        ),
                    )
                    stats["source_files"] += 1

                for point in infer_knowledge_points(subject, title):
                    kp_id = stable_id(subject, point)
                    conn.execute(
                        """
                        INSERT INTO knowledge_points(id, subject_id, name, category, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?)
                        ON CONFLICT(subject_id, name) DO UPDATE SET updated_at=excluded.updated_at
                        """,
                        (kp_id, subject, point, point, now, now),
                    )
                    conn.execute(
                        """
                        INSERT OR REPLACE INTO topic_knowledge_points(topic_id, knowledge_point_id, confidence, source)
                        VALUES (?, ?, ?, ?)
                        """,
                        (topic_id, kp_id, 0.6, "filename"),
                    )
                    stats["knowledge_points"] += 1

    return stats


def fetch_summary(conn):
    return {
        "db_path": str(DB_PATH),
        "subjects": [dict(row) for row in conn.execute("SELECT * FROM subjects ORDER BY id")],
        "topic_count": conn.execute("SELECT COUNT(*) AS c FROM topics").fetchone()["c"],
        "knowledge_point_count": conn.execute("SELECT COUNT(*) AS c FROM knowledge_points").fetchone()["c"],
        "source_file_count": conn.execute("SELECT COUNT(*) AS c FROM source_files").fetchone()["c"],
        "by_subject": [
            dict(row)
            for row in conn.execute(
                """
                SELECT s.id AS subject, s.name, COUNT(DISTINCT t.id) AS topics, COUNT(DISTINCT kp.id) AS knowledge_points
                FROM subjects s
                LEFT JOIN topics t ON t.subject_id = s.id
                LEFT JOIN knowledge_points kp ON kp.subject_id = s.id
                GROUP BY s.id, s.name
                ORDER BY s.id
                """
            )
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--scan", action="store_true", help="scan data/docs and upsert topics")
    args = parser.parse_args()

    conn = connect()
    try:
        create_schema(conn)
        upsert_seed_rows(conn)
        stats = scan_docs(conn) if args.scan else None
        conn.commit()
        print(json.dumps({"success": True, "scan": stats, "summary": fetch_summary(conn)}, ensure_ascii=False, indent=2))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
