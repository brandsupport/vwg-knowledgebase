import os
import tempfile
import unittest
from unittest.mock import patch

from build import (
    publish_frontend_assets,
    publish_html_page,
    replace_brand_asset_placeholders,
)


class BuildHelperTests(unittest.TestCase):
    def test_brand_placeholders_are_replaced_consistently(self):
        content = '<img src="__VW_LOGO__"><link href="__FAVICON__">'
        result = replace_brand_asset_placeholders(
            content,
            {
                "__VW_LOGO__": "data:image/png;base64,logo",
                "__FAVICON__": "data:image/png;base64,icon",
            },
        )
        self.assertEqual(
            result,
            '<img src="data:image/png;base64,logo"><link href="data:image/png;base64,icon">',
        )
        self.assertNotIn("__VW_LOGO__", result)
        self.assertNotIn("__FAVICON__", result)

    def test_html_publisher_resolves_branding_and_skips_missing_sources(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "source.html")
            output = os.path.join(temp_dir, "nested", "output.html")
            with open(source, "w", encoding="utf-8") as source_file:
                source_file.write('<img src="__VW_LOGO__">')
            with patch("builtins.print"):
                published = publish_html_page(
                    source,
                    output,
                    {"__VW_LOGO__": "data:image/png;base64,logo"},
                    "test page",
                )
            self.assertTrue(published)
            with open(output, "r", encoding="utf-8") as output_file:
                self.assertEqual(output_file.read(), '<img src="data:image/png;base64,logo">')
            self.assertFalse(
                publish_html_page(
                    os.path.join(temp_dir, "missing.html"),
                    output,
                    {},
                    "missing page",
                )
            )

    def test_frontend_assets_are_written_as_separate_files(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            stylesheet = os.path.join(temp_dir, "source.css")
            script = os.path.join(temp_dir, "source.js")
            output_dir = os.path.join(temp_dir, "dist")
            with open(stylesheet, "w", encoding="utf-8") as file:
                file.write('.logo { background-image: url("__VW_LOGO__"); }')
            with open(script, "w", encoding="utf-8") as file:
                file.write('window.appReady = true;')
            css_output, js_output = publish_frontend_assets(
                stylesheet,
                script,
                output_dir,
                {"__VW_LOGO__": "data:image/png;base64,logo"},
            )
            with open(css_output, "r", encoding="utf-8") as file:
                self.assertEqual(
                    file.read(),
                    '.logo { background-image: url("data:image/png;base64,logo"); }',
                )
            with open(js_output, "r", encoding="utf-8") as file:
                self.assertEqual(file.read(), "window.appReady = true;")


if __name__ == "__main__":
    unittest.main()
