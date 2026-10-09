import unittest

from build import build_chatbot_index


class ChatbotIndexTests(unittest.TestCase):
    def test_index_contains_retrieval_fields_and_hash_route(self):
        data = {
            "categories": [{"id": 3, "title": "Order Mods", "short": "Order Mods"}],
            "articles": [{
                "id": 42,
                "cat": 3,
                "title": "Grant & amendment",
                "tags": ["SLI", "Grant"],
                "html": "<p>Use &amp; check <strong>SLI</strong>.</p>",
                "images": ["data:image/png;base64,SHOULD_NOT_APPEAR"],
            }],
        }
        result = build_chatbot_index(data)
        self.assertEqual(result["version"], 1)
        self.assertEqual(len(result["articles"]), 1)
        article = result["articles"][0]
        self.assertEqual(article["category"], "Order Mods")
        self.assertEqual(article["url"], "#/article/42")
        self.assertEqual(article["text"], "Use & check SLI .")
        self.assertNotIn("images", article)
        self.assertNotIn("SHOULD_NOT_APPEAR", str(result))

    def test_empty_articles_are_skipped(self):
        data = {
            "categories": [],
            "articles": [{"id": 1, "cat": 99, "title": "", "tags": [], "html": "", "images": []}],
        }
        self.assertEqual(build_chatbot_index(data)["articles"], [])


if __name__ == "__main__":
    unittest.main()
