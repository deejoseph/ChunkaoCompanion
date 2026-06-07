import argparse
import hashlib
import json
import re
import shutil
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

from init_knowledge_db import create_schema, upsert_seed_rows


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCS_ROOT = PROJECT_ROOT / "data" / "docs"
DB_PATH = PROJECT_ROOT / "data" / "knowledge" / "chunkao.db"

SUBJECT_NAMES = {
    "chinese": "语文",
    "math": "数学",
    "english": "英语",
}

SUBJECT_SORT = {
    "chinese": 1,
    "math": 2,
    "english": 3,
}

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def stable_id(*parts):
    raw = "::".join(str(part) for part in parts if part is not None)
    safe = re.sub(r"[^a-zA-Z0-9_\-\u4e00-\u9fff]+", "_", raw).strip("_")[:96]
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]
    return f"{safe or 'item'}_{digest}"


def topic_code(filename):
    match = re.search(r"专题\s*([0-9]+)", filename)
    return f"专题{int(match.group(1)):02d}" if match else None


def compact_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def extract_knowledge_point_candidates(payload):
    """
    只采集专题 JSON 的核心知识点：
    - category = 顶层字段 '专题'
    - name = 命题分析 中的 '高频考查内容'
    """
    topic_title = str(payload.get("专题") or "").strip()
    analysis = payload.get("命题分析") if isinstance(payload.get("命题分析"), dict) else {}
    high_freq = analysis.get("高频考查内容", [])

    if not isinstance(high_freq, list):
        return []

    candidates = []
    seen = set()
    for item in high_freq:
        name = str(item).strip()
        if not name or name in seen:
            continue
        seen.add(name)
        candidates.append({"name": name, "category": topic_title})
    return candidates


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_graph_schema(conn):
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS knowledge_nodes (
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

        CREATE TABLE IF NOT EXISTS knowledge_edges (
            id TEXT PRIMARY KEY,
            from_node_id TEXT NOT NULL,
            to_node_id TEXT NOT NULL,
            relation_type TEXT NOT NULL,
            note TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            FOREIGN KEY(from_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
            FOREIGN KEY(to_node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS exam_insights (
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

        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_topic ON knowledge_nodes(topic_id, parent_id, sort_order);
        CREATE INDEX IF NOT EXISTS idx_knowledge_nodes_subject ON knowledge_nodes(subject_id, version_id, node_type);
        CREATE INDEX IF NOT EXISTS idx_knowledge_edges_from ON knowledge_edges(from_node_id, relation_type);
        CREATE INDEX IF NOT EXISTS idx_exam_insights_topic ON exam_insights(topic_id, insight_type);
        """
    )


def clear_database(conn):
    tables = [
        "knowledge_edges",
        "knowledge_nodes",
        "exam_insights",
        "question_parse_logs",
        "question_assets",
        "question_knowledge_points",
        "questions",
        "question_banks",
        "topic_knowledge_points",
        "knowledge_points",
        "source_files",
        "topics",
    ]
    conn.execute("PRAGMA foreign_keys = OFF")
    for table in tables:
        conn.execute(f"DELETE FROM {table}")
    conn.execute("PRAGMA foreign_keys = ON")


def insert_node(conn, *, subject, version, topic_id, parent_id, node_type, title, content=None, source_file_id=None, sort_order=0, now):
    node_id = stable_id("node", subject, version, topic_id or "", parent_id or "", node_type, title, sort_order)
    conn.execute(
        """
        INSERT INTO knowledge_nodes(
            id, subject_id, version_id, topic_id, parent_id, node_type, title,
            content_json, source_file_id, sort_order, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            content_json=excluded.content_json,
            source_file_id=excluded.source_file_id,
            sort_order=excluded.sort_order,
            updated_at=excluded.updated_at
        """,
        (
            node_id,
            subject,
            version,
            topic_id,
            parent_id,
            node_type,
            title,
            compact_json(content or {}),
            source_file_id,
            sort_order,
            now,
            now,
        ),
    )
    return node_id


def insert_edge(conn, from_node_id, to_node_id, relation_type, now, note=""):
    edge_id = stable_id("edge", from_node_id, to_node_id, relation_type)
    conn.execute(
        """
        INSERT OR REPLACE INTO knowledge_edges(id, from_node_id, to_node_id, relation_type, note, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (edge_id, from_node_id, to_node_id, relation_type, note, now),
    )


def upsert_knowledge_point(conn, *, subject, topic_id, name, category, description, now, confidence=1.0):
    kp_id = stable_id("kp", subject, name)
    conn.execute(
        """
        INSERT INTO knowledge_points(id, subject_id, name, category, description, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(subject_id, name) DO UPDATE SET
            category=excluded.category,
            description=excluded.description,
            updated_at=excluded.updated_at
        """,
        (kp_id, subject, name, category, description, now, now),
    )
    conn.execute(
        """
        INSERT OR REPLACE INTO topic_knowledge_points(topic_id, knowledge_point_id, confidence, source)
        VALUES (?, ?, ?, ?)
        """,
        (topic_id, kp_id, confidence, "json-2026-confirmed"),
    )
    return kp_id


def find_related_pdfs(json_path):
    stem = json_path.stem
    prefix_match = re.match(r"(专题\s*\d+)", stem)
    prefix = prefix_match.group(1).replace(" ", "") if prefix_match else stem
    pdfs = []
    for pdf in sorted(json_path.parent.glob("*.pdf")):
        normalized = pdf.stem.replace(" ", "")
        if normalized.startswith(prefix):
            pdfs.append(pdf)
    return pdfs


def source_role(file_name):
    if "教师版" in file_name:
        return "teacher"
    if "学生版" in file_name:
        return "student"
    return "reference"


def file_topic_title(json_path):
    return re.sub(r"^专题\s*\d+\s*", "", json_path.stem).strip()


def titles_compatible(file_title, payload_title):
    if not payload_title:
        return True
    def normalize_title(value):
        normalized = re.sub(r"[\s、“”\"'（）()，,、：:；;《》<>]+", "", str(value))
        normalized = normalized.replace("与", "").replace("和", "")
        return normalized

    normalized_file = normalize_title(file_title)
    normalized_payload = normalize_title(payload_title)
    return normalized_file in normalized_payload or normalized_payload in normalized_file


def validate_knowledge_json_structure(payload):
    """
    知识点 JSON 结构防御校验。
    合法结构：必须包含 "专题"(string) + 至少一个核心结构字段（"考点体系" 或 "命题分析"）。
    返回 (ok: bool, reason: str|None)。
    """
    if not isinstance(payload, dict):
        return False, "JSON 根节点必须是对象（dict），不能是数组或基本类型"
    zhuanti = payload.get("专题")
    if not isinstance(zhuanti, str) or not zhuanti.strip():
        # 检查是否误传了题库 JSON
        looks_like_bank = (
            "exam_info" in payload or "examInfo" in payload
            or (isinstance(payload.get("sections"), list) and len(payload["sections"]) > 0)
            or (isinstance(payload.get("questions"), list) and len(payload["questions"]) > 0)
        )
        if looks_like_bank:
            return False, "该文件看起来是题库 JSON（包含 exam_info/sections/questions），不是知识点 JSON"
        return False, "缺少顶层字段 \"专题\"（string）"
    has_kaodian = isinstance(payload.get("考点体系"), dict)
    has_mingti  = isinstance(payload.get("命题分析"), dict)
    if not has_kaodian and not has_mingti:
        return False, f"必须至少包含 \"考点体系\" 或 \"命题分析\" 之一，当前字段：{', '.join(payload.keys())}"
    return True, None


def insert_topic_and_sources(conn, *, subject, version, json_path, payload, now):
    title = file_topic_title(json_path) or payload.get("专题") or json_path.stem
    code = topic_code(json_path.name)
    topic_id = stable_id("topic", subject, version, code or json_path.stem, title)
    source_dir = str(json_path.parent.relative_to(PROJECT_ROOT))
    teacher_file = None
    student_file = None

    pdfs = find_related_pdfs(json_path)
    for pdf in pdfs:
        if "教师版" in pdf.name:
            teacher_file = pdf.name
        elif "学生版" in pdf.name:
            student_file = pdf.name

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
        (topic_id, subject, version, code, title, teacher_file, student_file, source_dir, now, now),
    )

    source_files = [json_path, *pdfs]
    json_source_id = None
    for file_path in source_files:
        file_id = stable_id("source", subject, version, file_path.name)
        if file_path == json_path:
            json_source_id = file_id
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
                "knowledge_json" if file_path == json_path else source_role(file_path.name),
                rel_path,
                file_path.name,
                file_path.suffix.lower(),
                file_path.stat().st_size,
                now,
            ),
        )

    return topic_id, title, code, json_source_id


def insert_exam_insights(conn, *, topic_id, subject, version, analysis, now):
    count = 0
    if not isinstance(analysis, dict):
        return count

    for order, (key, value) in enumerate(analysis.items(), start=1):
        insight_id = stable_id("insight", topic_id, key)
        conn.execute(
            """
            INSERT OR REPLACE INTO exam_insights(
                id, topic_id, subject_id, version_id, insight_type, title,
                payload_json, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                insight_id,
                topic_id,
                subject,
                version,
                key,
                key,
                compact_json({"order": order, "value": value}),
                now,
                now,
            ),
        )
        count += 1
    return count


def insert_string_leaf(conn, *, subject, version, topic_id, parent_id, topic_title, value, node_type, source_file_id, sort_order, now):
    title = str(value).strip()
    if not title:
        return None
    return insert_node(
        conn,
        subject=subject,
        version=version,
        topic_id=topic_id,
        parent_id=parent_id,
        node_type=node_type,
        title=title,
        content={"source": "json", "topic": topic_title},
        source_file_id=source_file_id,
        sort_order=sort_order,
        now=now,
    )


def insert_named_group(conn, *, subject, version, topic_id, parent_id, topic_title, group_name, values, node_type, child_type, source_file_id, sort_order, now):
    group_node = insert_node(
        conn,
        subject=subject,
        version=version,
        topic_id=topic_id,
        parent_id=parent_id,
        node_type=node_type,
        title=group_name,
        content={"values": values},
        source_file_id=source_file_id,
        sort_order=sort_order,
        now=now,
    )
    if isinstance(values, list):
        for idx, value in enumerate(values, start=1):
            insert_string_leaf(
                conn,
                subject=subject,
                version=version,
                topic_id=topic_id,
                parent_id=group_node,
                topic_title=topic_title,
                value=value,
                node_type=child_type,
                source_file_id=source_file_id,
                sort_order=idx,
                now=now,
            )
    return group_node


def import_topic_payload(conn, *, subject, version, json_path, payload, course_node_id, now):
    topic_id, topic_title, code, json_source_id = insert_topic_and_sources(
        conn,
        subject=subject,
        version=version,
        json_path=json_path,
        payload=payload,
        now=now,
    )
    topic_order = int(re.search(r"\d+", code or "999").group(0)) if code and re.search(r"\d+", code) else 999
    topic_node_id = insert_node(
        conn,
        subject=subject,
        version=version,
        topic_id=topic_id,
        parent_id=course_node_id,
        node_type="topic",
        title=topic_title,
        content={
            "code": code,
            "json_file": str(json_path.relative_to(PROJECT_ROOT)),
            "json_topic_title": payload.get("专题"),
        },
        source_file_id=json_source_id,
        sort_order=topic_order,
        now=now,
    )
    insert_edge(conn, course_node_id, topic_node_id, "contains", now)

    insight_count = insert_exam_insights(
        conn,
        topic_id=topic_id,
        subject=subject,
        version=version,
        analysis=payload.get("命题分析", {}),
        now=now,
    )

    analysis = payload.get("命题分析", {})
    if isinstance(analysis, dict):
        analysis_node_id = insert_node(
            conn,
            subject=subject,
            version=version,
            topic_id=topic_id,
            parent_id=topic_node_id,
            node_type="exam_analysis",
            title="命题分析",
            content=analysis,
            source_file_id=json_source_id,
            sort_order=1,
            now=now,
        )
        for idx, (name, values) in enumerate(analysis.items(), start=1):
            insert_named_group(
                conn,
                subject=subject,
                version=version,
                topic_id=topic_id,
                parent_id=analysis_node_id,
                topic_title=topic_title,
                group_name=name,
                values=values,
                node_type="exam_focus_group",
                child_type="exam_focus",
                source_file_id=json_source_id,
                sort_order=idx,
                now=now,
            )

    point_count = 0
    for candidate in extract_knowledge_point_candidates(payload):
        upsert_knowledge_point(
            conn,
            subject=subject,
            topic_id=topic_id,
            name=candidate["name"],
            category=candidate["category"] or topic_title,
            description=f"来自专题 JSON 的高频考查内容：{candidate['name']}",
            now=now,
            confidence=1.0,
        )

    system = payload.get("考点体系", {})
    if isinstance(system, dict):
        for checkpoint_order, (checkpoint_name, checkpoint_data) in enumerate(system.items(), start=1):
            if not isinstance(checkpoint_data, dict):
                continue
            checkpoint_node_id = insert_node(
                conn,
                subject=subject,
                version=version,
                topic_id=topic_id,
                parent_id=topic_node_id,
                node_type="checkpoint",
                title=checkpoint_name,
                content=checkpoint_data,
                source_file_id=json_source_id,
                sort_order=checkpoint_order + 10,
                now=now,
            )
            point_count += 1

            abilities = checkpoint_data.get("核心能力", [])
            if isinstance(abilities, list):
                ability_group_id = insert_node(
                    conn,
                    subject=subject,
                    version=version,
                    topic_id=topic_id,
                    parent_id=checkpoint_node_id,
                    node_type="ability_group",
                    title="核心能力",
                    content={"values": abilities},
                    source_file_id=json_source_id,
                    sort_order=1,
                    now=now,
                )
                for idx, ability in enumerate(abilities, start=1):
                    if insert_string_leaf(
                        conn,
                        subject=subject,
                        version=version,
                        topic_id=topic_id,
                        parent_id=ability_group_id,
                        topic_title=topic_title,
                        value=ability,
                        node_type="ability",
                        source_file_id=json_source_id,
                        sort_order=idx,
                        now=now,
                    ):
                        point_count += 1

            for group_order, (field_name, node_type, child_type) in enumerate(
                [
                    ("命题重点", "sub_checkpoint", "knowledge_point"),
                    ("答题方法", "method", "method_detail"),
                ],
                start=2,
            ):
                field = checkpoint_data.get(field_name, {})
                if not isinstance(field, dict):
                    continue
                field_node_id = insert_node(
                    conn,
                    subject=subject,
                    version=version,
                    topic_id=topic_id,
                    parent_id=checkpoint_node_id,
                    node_type=f"{node_type}_group",
                    title=field_name,
                    content=field,
                    source_file_id=json_source_id,
                    sort_order=group_order,
                    now=now,
                )
                for idx, (group_name, values) in enumerate(field.items(), start=1):
                    insert_named_group(
                        conn,
                        subject=subject,
                        version=version,
                        topic_id=topic_id,
                        parent_id=field_node_id,
                        topic_title=topic_title,
                        group_name=group_name,
                        values=values,
                        node_type=node_type,
                        child_type=child_type,
                        source_file_id=json_source_id,
                        sort_order=idx,
                        now=now,
                    )
                    point_count += 1 + (len(values) if isinstance(values, list) else 0)

    for extra_order, extra_key in enumerate(["高频题型", "易错点"], start=100):
        extra = payload.get(extra_key)
        if not isinstance(extra, dict):
            continue
        extra_node_id = insert_node(
            conn,
            subject=subject,
            version=version,
            topic_id=topic_id,
            parent_id=topic_node_id,
            node_type="extra_group",
            title=extra_key,
            content=extra,
            source_file_id=json_source_id,
            sort_order=extra_order,
            now=now,
        )
        for idx, (group_name, values) in enumerate(extra.items(), start=1):
            insert_named_group(
                conn,
                subject=subject,
                version=version,
                topic_id=topic_id,
                parent_id=extra_node_id,
                topic_title=topic_title,
                group_name=group_name,
                values=values,
                node_type="extra_item",
                child_type="knowledge_point",
                source_file_id=json_source_id,
                sort_order=idx,
                now=now,
            )
            point_count += 1 + (len(values) if isinstance(values, list) else 0)

    return {
        "topic_id": topic_id,
        "topic": topic_title,
        "json_file": str(json_path.relative_to(PROJECT_ROOT)),
        "knowledge_items": point_count,
        "exam_insights": insight_count,
    }


def iter_json_files(subjects, version):
    for subject in subjects:
        subject_dir = DOCS_ROOT / subject / version
        for json_path in sorted(subject_dir.glob("*.json")):
            # 第一级防御：只接受以"专题"开头的 JSON 文件
            if not json_path.stem.startswith("专题"):
                continue
            yield subject, json_path


def rebuild(subjects, version, backup=True):
    if backup and DB_PATH.exists():
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        backup_path = DB_PATH.with_suffix(f".db.backup_before_json_rebuild.{timestamp}")
        shutil.copy2(DB_PATH, backup_path)
    else:
        backup_path = None

    conn = connect()
    now = datetime.now().isoformat(timespec="seconds")
    imported = []
    skipped = []
    try:
        create_schema(conn)
        create_graph_schema(conn)
        clear_database(conn)
        upsert_seed_rows(conn)

        course_nodes = {}
        for subject in subjects:
            course_nodes[subject] = insert_node(
                conn,
                subject=subject,
                version=version,
                topic_id=None,
                parent_id=None,
                node_type="course",
                title=SUBJECT_NAMES[subject],
                content={"version": version},
                sort_order=SUBJECT_SORT[subject],
                now=now,
            )

        for subject, json_path in iter_json_files(subjects, version):
            with json_path.open("r", encoding="utf-8") as f:
                payload = json.load(f)

            # ── JSON 结构防御校验 ──
            ok, reason = validate_knowledge_json_structure(payload)
            if not ok:
                skipped.append(
                    {
                        "subject": subject,
                        "json_file": str(json_path.relative_to(PROJECT_ROOT)),
                        "reason": f"JSON 结构防御校验失败：{reason}",
                    }
                )
                continue

            file_title = file_topic_title(json_path)
            payload_title = payload.get("专题")
            if not titles_compatible(file_title, payload_title):
                skipped.append(
                    {
                        "subject": subject,
                        "json_file": str(json_path.relative_to(PROJECT_ROOT)),
                        "file_title": file_title,
                        "json_topic_title": payload_title,
                        "reason": "JSON 顶层专题与文件名严重不一致，已跳过以避免污染知识库",
                    }
                )
                continue
            imported.append(
                import_topic_payload(
                    conn,
                    subject=subject,
                    version=version,
                    json_path=json_path,
                    payload=payload,
                    course_node_id=course_nodes[subject],
                    now=now,
                )
            )

        conn.commit()

        summary = {
            "topics": conn.execute("SELECT COUNT(*) AS c FROM topics").fetchone()["c"],
            "knowledge_points": conn.execute("SELECT COUNT(*) AS c FROM knowledge_points").fetchone()["c"],
            "knowledge_nodes": conn.execute("SELECT COUNT(*) AS c FROM knowledge_nodes").fetchone()["c"],
            "exam_insights": conn.execute("SELECT COUNT(*) AS c FROM exam_insights").fetchone()["c"],
            "source_files": conn.execute("SELECT COUNT(*) AS c FROM source_files").fetchone()["c"],
            "question_banks": conn.execute("SELECT COUNT(*) AS c FROM question_banks").fetchone()["c"],
            "questions": conn.execute("SELECT COUNT(*) AS c FROM questions").fetchone()["c"],
            "by_subject": [
                dict(row)
                for row in conn.execute(
                    """
                    SELECT subject_id AS subject, COUNT(*) AS topics
                    FROM topics
                    GROUP BY subject_id
                    ORDER BY subject_id
                    """
                )
            ],
        }
        return {
            "success": True,
            "db_path": str(DB_PATH),
            "backup_path": str(backup_path) if backup_path else None,
            "version": version,
            "imported_files": len(imported),
            "skipped_files": len(skipped),
            "skipped": skipped,
            "imported": imported,
            "summary": summary,
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def import_json_files(file_specs, version, backup=True, clear_existing=False):
    if backup and DB_PATH.exists():
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        backup_path = DB_PATH.with_suffix(f".db.backup_before_json_import.{timestamp}")
        shutil.copy2(DB_PATH, backup_path)
    else:
        backup_path = None

    conn = connect()
    now = datetime.now().isoformat(timespec="seconds")
    imported = []
    skipped = []
    try:
        create_schema(conn)
        create_graph_schema(conn)
        if clear_existing:
            clear_database(conn)
        upsert_seed_rows(conn)

        subjects = sorted({subject for subject, _ in file_specs})
        course_nodes = {}
        for subject in subjects:
            existing = conn.execute(
                """
                SELECT id FROM knowledge_nodes
                WHERE subject_id = ? AND version_id = ? AND node_type = 'course'
                """,
                (subject, version),
            ).fetchone()
            course_nodes[subject] = existing["id"] if existing else insert_node(
                conn,
                subject=subject,
                version=version,
                topic_id=None,
                parent_id=None,
                node_type="course",
                title=SUBJECT_NAMES[subject],
                content={"version": version},
                sort_order=SUBJECT_SORT[subject],
                now=now,
            )

        for subject, json_path in file_specs:
            json_path = Path(json_path).resolve()  # 确保转为绝对路径，避免 relative_to 失败
            with json_path.open("r", encoding="utf-8") as f:
                payload = json.load(f)
        
            # ── JSON 结构防御校验 ──
            ok, reason = validate_knowledge_json_structure(payload)
            if not ok:
                skipped.append(
                    {
                        "subject": subject,
                        "json_file": str(json_path),
                        "reason": f"JSON 结构防御校验失败：{reason}",
                    }
                )
                continue
        
            file_title = file_topic_title(json_path)
            payload_title = payload.get("\u4e13\u9898")
            if not titles_compatible(file_title, payload_title):
                skipped.append(
                    {
                        "subject": subject,
                        "json_file": str(json_path),
                        "file_title": file_title,
                        "json_topic_title": payload_title,
                        "reason": "JSON 顶层专题与文件名严重不一致，已跳过以避免污染知识库",
                    }
                )
                continue

            title = file_title or payload_title or json_path.stem
            code = topic_code(json_path.name)
            topic_id = stable_id("topic", subject, version, code or json_path.stem, title)
            conn.execute("DELETE FROM knowledge_nodes WHERE topic_id = ?", (topic_id,))
            conn.execute("DELETE FROM exam_insights WHERE topic_id = ?", (topic_id,))
            conn.execute("DELETE FROM topic_knowledge_points WHERE topic_id = ?", (topic_id,))
            conn.execute("DELETE FROM source_files WHERE topic_id = ?", (topic_id,))
            conn.execute("DELETE FROM topics WHERE id = ?", (topic_id,))

            imported.append(
                import_topic_payload(
                    conn,
                    subject=subject,
                    version=version,
                    json_path=json_path,
                    payload=payload,
                    course_node_id=course_nodes[subject],
                    now=now,
                )
            )

        # 清理孤立知识点（先删除子表引用，避免外键约束失败）
        conn.execute(
            """
            DELETE FROM student_wrong_knowledge
            WHERE knowledge_point_id NOT IN (
                SELECT id FROM knowledge_points
                WHERE id IN (SELECT knowledge_point_id FROM topic_knowledge_points)
            )
            """
        )
        conn.execute(
            """
            DELETE FROM knowledge_points
            WHERE id NOT IN (SELECT knowledge_point_id FROM topic_knowledge_points)
            """
        )
        conn.commit()

        return {
            "success": True,
            "db_path": str(DB_PATH),
            "backup_path": str(backup_path) if backup_path else None,
            "version": version,
            "imported_files": len(imported),
            "skipped_files": len(skipped),
            "skipped": skipped,
            "imported": imported,
            "summary": {
                "topics": conn.execute("SELECT COUNT(*) AS c FROM topics").fetchone()["c"],
                "knowledge_points": conn.execute("SELECT COUNT(*) AS c FROM knowledge_points").fetchone()["c"],
                "knowledge_nodes": conn.execute("SELECT COUNT(*) AS c FROM knowledge_nodes").fetchone()["c"],
                "exam_insights": conn.execute("SELECT COUNT(*) AS c FROM exam_insights").fetchone()["c"],
                "source_files": conn.execute("SELECT COUNT(*) AS c FROM source_files").fetchone()["c"],
            },
        }
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Rebuild knowledge DB from 2026 subject JSON files.")
    parser.add_argument("--version", default="2026")
    parser.add_argument("--subjects", nargs="+", choices=sorted(SUBJECT_NAMES), default=["chinese", "math", "english"])
    parser.add_argument("--subject", choices=sorted(SUBJECT_NAMES), help="subject for --input-files")
    parser.add_argument("--input-files", nargs="*", help="import specific JSON files instead of scanning data/docs")
    parser.add_argument("--clear-existing", action="store_true", help="clear knowledge/question tables before importing")
    parser.add_argument("--no-backup", action="store_true")
    args = parser.parse_args()

    if args.input_files:
        if not args.subject:
            raise SystemExit("--subject is required when --input-files is used")
        result = import_json_files(
            [(args.subject, Path(file_path)) for file_path in args.input_files],
            args.version,
            backup=not args.no_backup,
            clear_existing=args.clear_existing,
        )
    else:
        result = rebuild(args.subjects, args.version, backup=not args.no_backup)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
