import base64
import json
import os
import tempfile
import unittest
from unittest.mock import patch

from import_tally import load_tally_articles
from build import (
    publish_frontend_assets,
    publish_html_page,
    publish_static_asset,
    replace_brand_asset_placeholders,
    resolve_images,
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

    def test_static_asset_publisher_resolves_placeholders(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            source = os.path.join(temp_dir, "source.css")
            output = os.path.join(temp_dir, "dist", "page.css")
            with open(source, "w", encoding="utf-8") as source_file:
                source_file.write('.brand { background: url("__VW_LOGO__"); }')
            result = publish_static_asset(
                source,
                output,
                {"__VW_LOGO__": "data:image/png;base64,logo"},
            )
            self.assertEqual(result, output)
            with open(output, "r", encoding="utf-8") as output_file:
                self.assertEqual(
                    output_file.read(),
                    '.brand { background: url("data:image/png;base64,logo"); }',
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



    def test_base64_reference_screenshots_are_decoded_and_inlined(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            image_dir = os.path.join(temp_dir, "data", "stock_replacement_images")
            os.makedirs(image_dir)
            # A small signature fixture is enough to exercise the decoder and MIME mapping.
            image_bytes = bytes.fromhex("89504e470d0a1a0a") + b"reference-image"
            encoded = base64.b64encode(image_bytes).decode("ascii")
            image_path = os.path.join(image_dir, "stock-replacement-1.png.b64")
            with open(image_path, "w", encoding="ascii") as image_file:
                image_file.write(encoded)

            article = {
                "id": 24680,
                "images": ["stock_replacement_images/stock-replacement-1.png.b64"],
            }
            with patch("build.ROOT", temp_dir):
                resolve_images(article)

            self.assertEqual(
                article["images"],
                [f"data:image/png;base64,{encoded}"],
            )


    def test_stock_replacement_article_embeds_all_six_screenshots_in_order(self):
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        with open(os.path.join(repo_root, "data", "site_data.json"), encoding="utf-8") as file:
            site_data = json.load(file)

        with patch("import_tally.SUBMISSIONS_DIR", os.path.join(repo_root, "data", "tally_submissions")):
            articles, _warnings = load_tally_articles(site_data["categories"])

        article = next((item for item in articles if item["title"] == "Stock replacement"), None)
        self.assertIsNotNone(article)
        self.assertEqual(len(article["images"]), 6)

        with patch("build.ROOT", repo_root):
            resolve_images(article)

        self.assertEqual(len(article["images"]), 6)
        self.assertEqual(
            [image.split(";", 1)[0] for image in article["images"]],
            [
                "data:image/webp",
                "data:image/webp",
                "data:image/webp",
                "data:image/webp",
                "data:image/webp",
                "data:image/webp",
            ],
        )
if __name__ == "__main__":
    unittest.main()
