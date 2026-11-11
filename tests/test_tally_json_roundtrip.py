"""Regression tests for multiline Tally submissions and the real importer."""
import json
import os
import tempfile
import unittest
from unittest.mock import patch

import import_tally


class TallyJsonRoundTripTests(unittest.TestCase):
    def test_multiline_body_survives_json_serialization_and_import(self):
        # Mirrors the fields returned by the Code by Zapier step. The body
        # deliberately contains real newline characters, as Tally answers do.
        submission = {
            "response_id": "local-regression-test",
            "title": "Regression: multiline Tally article",
            "body": (
                "First paragraph with a line break.\n"
                "Second line of the same paragraph.\n\n"
                "Second paragraph.\n\n"
                "Important: keep this final instruction."
            ),
            "category": "Transfers",
            "tags": "Transfers, Multiline-test",
            "source_url": "",
        }

        # JavaScript JSON.stringify(article, null, 2) also escapes newlines
        # inside string values. Python's indented JSON serializer is the
        # equivalent serialization boundary for this regression test.
        serialized = json.dumps(submission, ensure_ascii=False, indent=2)
        self.assertIn(r"\n", serialized)
        decoded = json.loads(serialized)
        self.assertEqual(decoded, submission)
        self.assertEqual(decoded["body"], submission["body"])

        with tempfile.TemporaryDirectory() as temp_dir:
            submission_path = os.path.join(temp_dir, "local-regression-test.json")
            with open(submission_path, "w", encoding="utf-8") as file:
                file.write(serialized)

            with open(submission_path, "r", encoding="utf-8") as file:
                self.assertEqual(json.load(file), submission)

            repository_root = os.path.dirname(os.path.abspath(import_tally.__file__))
            with open(os.path.join(repository_root, "data", "site_data.json"),
                      "r", encoding="utf-8") as file:
                categories = json.load(file)["categories"]

            with patch.object(import_tally, "SUBMISSIONS_DIR", temp_dir):
                articles, warnings = import_tally.load_tally_articles(categories)

        self.assertEqual(warnings, [])
        self.assertEqual(len(articles), 1)
        article = articles[0]
        self.assertEqual(article["title"], submission["title"])
        self.assertEqual(article["source"], "tally")
        self.assertIn("First paragraph with a line break.", article["html"])
        self.assertIn("Second line of the same paragraph.", article["html"])
        self.assertIn("Second paragraph.", article["html"])
        self.assertIn("Important: keep this final instruction.", article["html"])
        self.assertIn("Multiline-test", article["tags"])


if __name__ == "__main__":
    unittest.main()
