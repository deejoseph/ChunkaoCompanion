import argparse
import hashlib
import json
import re
import sqlite3
import sys
from datetime import datetime

from init_knowledge_db import DB_PATH, create_schema


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

SUBJECT_NAMES = {
    "chinese": "语文",
    "math": "数学",
    "english": "英语",
}

RULE_GROUPS = {
    "chinese": [
        ("积累运用", [r"默写|名篇|名句|语言积累|表达|成语|病句"]),
        ("现代文阅读", [r"阅读下文|现代文|甲文|乙文|散文|社科"]),
        ("文言文", [r"文言文|阅读下面的文言文|实词|虚词|翻译"]),
        ("诗歌鉴赏", [r"诗歌|诗词|鉴赏"]),
        ("作文", [r"作文|写作|立意|材料"]),
    ],
    "math": [
        ("函数", [r"函数|导数|log|ln|指数|对数|三角|sin|cos|tan"]),
        ("几何", [r"几何|向量|圆|直线|椭圆|双曲线|抛物线|立体|三角形"]),
        ("代数", [r"方程|不等式|数列|集合|复数|二项式|矩阵"]),
        ("概率统计", [r"概率|统计|排列|组合|随机|样本"]),
    ],
    "english": [
        ("听力口语", [r"Listening Comprehension|Section A|Section B|conversation|passage"]),
        ("语法", [r"Grammar and Vocabulary|grammar|tense|clause|verb|blank"]),
        ("词汇", [r"Vocabulary|word|phrase|proper form|选词"]),
        ("完形", [r"Cloze|cloze"]),
        ("阅读", [r"Reading Comprehension|read the following|passage|questions are based on"]),
        ("写作", [r"Guided Writing|Writing|write an English composition|essay"]),
        ("翻译", [r"Translation|translate"]),
    ],
}


def connect():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def stable_id(*parts):
    raw = "::".join(str(part) for part in parts if part is not None)
    safe = re.sub(r"[^a-zA-Z0-9_\-\u4e00-\u9fff]+", "_", raw)
    safe = safe.strip("_")[:120] or "item"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:10]
    return f"{safe}_{digest}"


def compact(text):
    return re.sub(r"\s+", "", str(text or "")).lower()


def ensure_rule_points(conn):
    now = datetime.now().isoformat(timespec="seconds")
    for subject, name in SUBJECT_NAMES.items():
        conn.execute(
            "INSERT OR REPLACE INTO subjects(id, name) VALUES (?, ?)",
            (subject, name),
        )

    for subject, rules in RULE_GROUPS.items():
        for point_name, _patterns in rules:
            kp_id = stable_id(subject, point_name)
            conn.execute(
                """
                INSERT INTO knowledge_points(id, subject_id, name, category, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(subject_id, name) DO UPDATE SET
                    category=excluded.category,
                    updated_at=excluded.updated_at
                """,
                (kp_id, subject, point_name, point_name, now, now),
            )


def get_point_id(conn, subject, point_name):
    row = conn.execute(
        "SELECT id FROM knowledge_points WHERE subject_id = ? AND name = ?",
        (subject, point_name),
    ).fetchone()
    return row["id"] if row else None


def upsert_link(conn, question_id, knowledge_point_id, confidence, source, note, now):
    existing = conn.execute(
        """
        SELECT confidence, source, note
        FROM question_knowledge_points
        WHERE question_id = ? AND knowledge_point_id = ?
        """,
        (question_id, knowledge_point_id),
    ).fetchone()

    if existing and float(existing["confidence"] or 0) > confidence:
        return False

    conn.execute(
        """
        INSERT INTO question_knowledge_points(question_id, knowledge_point_id, confidence, source, note, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(question_id, knowledge_point_id) DO UPDATE SET
            confidence=excluded.confidence,
            source=excluded.source,
            note=excluded.note,
            updated_at=excluded.updated_at
        """,
        (question_id, knowledge_point_id, confidence, source, note, now, now),
    )
    return True


def link_questions(conn, subject=None, reset=False):
    now = datetime.now().isoformat(timespec="seconds")
    stats = {"questions_seen": 0, "links_upserted": 0, "topic_links": 0, "keyword_links": 0, "rule_links": 0}
    ensure_rule_points(conn)

    if reset:
        if subject:
            conn.execute(
                """
                DELETE FROM question_knowledge_points
                WHERE question_id IN (SELECT id FROM questions WHERE subject_id = ?)
                """,
                (subject,),
            )
        else:
            conn.execute("DELETE FROM question_knowledge_points")

    params = []
    where = ""
    if subject:
        where = "WHERE q.subject_id = ?"
        params.append(subject)

    questions = conn.execute(
        f"""
        SELECT q.id, q.topic_id, q.subject_id, q.content, q.analysis, qb.title AS bank_title
        FROM questions q
        JOIN question_banks qb ON qb.id = q.bank_id
        {where}
        ORDER BY q.subject_id, qb.title, q.number
        """,
        params,
    ).fetchall()

    points_by_subject = {}
    for row in conn.execute("SELECT id, subject_id, name, category FROM knowledge_points"):
        points_by_subject.setdefault(row["subject_id"], []).append(row)

    for question in questions:
        stats["questions_seen"] += 1
        question_text = compact(
            f"{question['bank_title']} {question['content']} {question['analysis']}"
        )
        raw_question_text = f"{question['bank_title']}\n{question['content']}\n{question['analysis']}"

        if question["topic_id"]:
            topic_points = conn.execute(
                """
                SELECT knowledge_point_id, confidence, source
                FROM topic_knowledge_points
                WHERE topic_id = ?
                """,
                (question["topic_id"],),
            ).fetchall()

            for point in topic_points:
                confidence = min(0.8, max(0.45, float(point["confidence"] or 0.55)))
                if upsert_link(
                    conn,
                    question["id"],
                    point["knowledge_point_id"],
                    confidence,
                    "topic",
                    "继承专题知识点",
                    now,
                ):
                    stats["links_upserted"] += 1
                    stats["topic_links"] += 1

        for point in points_by_subject.get(question["subject_id"], []):
            point_name = compact(point["name"])
            if len(point_name) < 2:
                continue
            if point_name in question_text:
                if upsert_link(
                    conn,
                    question["id"],
                    point["id"],
                    0.86,
                    "keyword",
                    f"题干或解析匹配关键词：{point['name']}",
                    now,
                ):
                    stats["links_upserted"] += 1
                    stats["keyword_links"] += 1

        for point_name, patterns in RULE_GROUPS.get(question["subject_id"], []):
            if not any(re.search(pattern, raw_question_text, flags=re.IGNORECASE) for pattern in patterns):
                continue
            point_id = get_point_id(conn, question["subject_id"], point_name)
            if not point_id:
                continue
            if upsert_link(
                conn,
                question["id"],
                point_id,
                0.72,
                "rule",
                f"规则匹配：{point_name}",
                now,
            ):
                stats["links_upserted"] += 1
                stats["rule_links"] += 1

    return stats


def summary(conn):
    return {
        "question_count": conn.execute("SELECT COUNT(*) AS c FROM questions").fetchone()["c"],
        "linked_question_count": conn.execute(
            "SELECT COUNT(DISTINCT question_id) AS c FROM question_knowledge_points"
        ).fetchone()["c"],
        "link_count": conn.execute("SELECT COUNT(*) AS c FROM question_knowledge_points").fetchone()["c"],
        "by_subject": [
            dict(row)
            for row in conn.execute(
                """
                SELECT q.subject_id AS subject,
                       COUNT(DISTINCT q.id) AS questions,
                       COUNT(DISTINCT qkp.question_id) AS linked_questions,
                       COUNT(qkp.knowledge_point_id) AS links
                FROM questions q
                LEFT JOIN question_knowledge_points qkp ON qkp.question_id = q.id
                GROUP BY q.subject_id
                ORDER BY q.subject_id
                """
            )
        ],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--subject")
    parser.add_argument("--reset", action="store_true")
    args = parser.parse_args()

    conn = connect()
    try:
        create_schema(conn)
        stats = link_questions(conn, args.subject, args.reset)
        conn.commit()
        print(json.dumps({"success": True, "link": stats, "summary": summary(conn)}, ensure_ascii=False, indent=2))
    finally:
        conn.close()


if __name__ == "__main__":
    main()
