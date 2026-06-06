import json
import unittest
from pathlib import Path

from rebuild_knowledge_from_json import extract_knowledge_point_candidates


class ExtractKnowledgePointCandidatesTest(unittest.TestCase):
    def test_extracts_only_topic_category_and_high_frequency_items(self):
        sample = json.loads('''
        {
          "专题": "名篇名句默写",
          "命题分析": {
            "题型": ["填空题"],
            "命题特点": ["直接默写与情景默写并重"],
            "高频考查内容": ["名句默写", "情景默写", "文学文化常识"]
          },
          "考点体系": {
            "考试篇目": {
              "核心能力": ["篇目识记"]
            }
          }
        }
        ''')

        candidates = extract_knowledge_point_candidates(sample)

        self.assertEqual(candidates, [
            {"name": "名句默写", "category": "名篇名句默写"},
            {"name": "情景默写", "category": "名篇名句默写"},
            {"name": "文学文化常识", "category": "名篇名句默写"},
        ])


if __name__ == '__main__':
    unittest.main()
