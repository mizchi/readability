// examples/run_candidates.ts
import { findMainCandidates, parseHTML, preprocessDocument, serializeToHTML } from "../dist/index";
import { getInnerText } from "../src/dom.ts";

async function main() {
  // Node.jsでは、最初の2つの引数はnode実行可能ファイルとスクリプトファイルパスです。
  // 実際の引数はインデックス2から始まります。
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: pnpm tsx examples/run_candidates.ts <URL>");
    process.exit(1);
  }

  try {
    console.log(`Fetching URL: ${url}`);
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      process.exit(1);
    }
    const html = await response.text();
    console.log("HTML fetched successfully.");

    console.log("Parsing HTML...");
    const doc = parseHTML(html);
    console.log("HTML parsed.");

    console.log("Preprocessing document...");
    preprocessDocument(doc);
    console.log("Document preprocessed.");

    console.log("Finding main candidates...");
    const candidates = findMainCandidates(doc); // デフォルトのトップ5を取得
    console.log(`Found ${candidates.length} candidates.`);

    if (candidates.length > 0) {
      console.log("\n--- Top Candidates ---");
      candidates.forEach((candidate, index) => {
        const score = candidate.readability?.contentScore ?? 0; // スコアを取得 (存在しない場合は0)
        const serializedContent = serializeToHTML(candidate);
        const textPreview = getInnerText(candidate).substring(0, 100) + "..."; // テキストプレビュー

        console.log(`\nCandidate #${index + 1} (Score: ${score.toFixed(2)})`);
        console.log(
          `Tag: ${candidate.tagName}, ID: ${candidate.id || "N/A"}, Class: ${candidate.className || "N/A"}`
        );
        console.log(`Text Preview: ${textPreview}`);
        // console.log(`Serialized HTML:\n${serializedContent}\n`); // 必要に応じてコメント解除
      });
      console.log("----------------------\n");
    } else {
      console.log("No candidates found.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
    process.exit(1);
  }
}

main();
