import json
import os
import tempfile
import unittest
from unittest.mock import patch

from import_tally import load_tally_articles


CATEGORIES = [
    {"id": 3, "title": "Order Mods", "short": "Order Mods"},
    {"id": 7, "title": "Vehicle Delays", "short": "Delays"},
    {"id": 13, "title": "Reference Info", "short": "Reference"},
]


class TallyImporterTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.submissions_dir = self.temp_dir.name

    def write_submission(self, filename, payload):
        with open(os.path.join(self.submissions_dir, filename), "w", encoding="utf-8") as f:
            json.dump(payload, f)

    def write_raw_submission(self, filename, raw):
        with open(os.path.join(self.submissions_dir, filename), "w", encoding="utf-8") as f:
            f.write(raw)

    def load(self):
        with patch("import_tally.SUBMISSIONS_DIR", self.submissions_dir):
            return load_tally_articles(CATEGORIES)

    def test_normalized_zapier_json_still_formats(self):
        self.write_submission("legacy.json", {
            "response_id": "response-123",
            "title": "Tip about SLI",
            "body": "First paragraph.\n\n## Next step\n- Check SLI",
            "category": "Delays",
            "tags": "SLI, Transport",
            "source_url": "https://example.com/help",
        })

        articles, warnings = self.load()

        self.assertEqual(warnings, [])
        self.assertEqual(len(articles), 1)
        article = articles[0]
        self.assertEqual(article["cat"], 7)
        self.assertEqual(article["source"], "tally")
        self.assertIn("<h3>Next step</h3>", article["html"])
        self.assertIn("<ul><li>Check SLI</li></ul>", article["html"])
        self.assertIn("SLI", article["tags"])
        self.assertEqual(article["source_url"], "https://example.com/help")


    def test_unescaped_newlines_in_body_are_recovered(self):
        # Simulate a GitHub file created by a mapping that inserted literal
        # newlines inside the JSON body string instead of escaping them.
        raw = '{"response_id":"bad-json-1","title":"Multiline tip","body":"First line.

Second line.
Third line","category":"Delays","tags":"SLI"}'
        self.write_raw_submission("bad-json.json", raw)

        articles, warnings = self.load()

        self.assertEqual(warnings, [])
        self.assertEqual(len(articles), 1)
        self.assertIn("First line.", articles[0]["html"])
        self.assertIn("Second line.", articles[0]["html"])

    def test_raw_tally_fields_are_mapped_inside_repository(self):
        self.write_submission("raw-response.json", {
            "eventId": "evt-1",
            "data": {
                "responseId": "tally-response-456",
                "fields": [
                    {"key": "question_a", "label": "Article Title", "type": "INPUT_TEXT",
                     "value": "Tip: No transport order on SLI"},
                    {"key": "question_b", "label": "Article Content", "type": "TEXTAREA",
                     "value": "If there is no order.\n\n1. Ask the retailer to retry.\n2. Check SLI."},
                    {"key": "question_c", "label": "Category", "type": "DROPDOWN",
                     "value": {"label": "Delays"}},
                    {"key": "question_d", "label": "Tags", "type": "INPUT_TEXT",
                     "value": ["Transport", "SLI"]},
                    {"key": "question_e", "label": "Source link", "type": "INPUT_TEXT",
                     "value": "https://example.com/source"},
                ],
            },
        })

        articles, warnings = self.load()

        self.assertEqual(warnings, [])
        self.assertEqual(len(articles), 1)
        article = articles[0]
        self.assertEqual(article["title"], "Tip: No transport order on SLI")
        self.assertEqual(article["cat"], 7)
        self.assertIn("<ol><li>Ask the retailer to retry.</li><li>Check SLI.</li></ol>", article["html"])
        self.assertIn("Transport", article["tags"])
        self.assertEqual(article["source_url"], "https://example.com/source")

    def test_missing_required_fields_are_skipped(self):
        self.write_submission("incomplete.json", {
            "data": {"fields": [{"label": "Article Title", "value": "Title only"}]}
        })

        articles, warnings = self.load()

        self.assertEqual(articles, [])
        self.assertTrue(any("title or body missing" in warning for warning in warnings))

    def test_unrecognised_category_falls_back_with_warning(self):
        self.write_submission("unknown-category.json", {
            "response_id": "response-789",
            "title": "A useful tip",
            "body": "Read the reference guide.",
            "category": "Not a real category",
        })

        articles, warnings = self.load()

        self.assertEqual(len(articles), 1)
        self.assertEqual(articles[0]["cat"], 13)
        self.assertTrue(any("not recognised" in warning for warning in warnings))


if __name__ == "__main__":
    unittest.main()
