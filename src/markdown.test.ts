// src/markdown.test.ts
import { describe, test, expect } from "vitest";
import { parseHTML } from "./parser";
import { toMarkdown } from "./markdown";
import { isVElement } from "./types"; // Import the type guard
import type { VElement, VDocument } from "./types"; // Import VDocument

describe("toMarkdown function", () => {
  test("should convert basic HTML to Markdown", () => {
    const html = `
      <h1>Title</h1>
      <p>This is a paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
      <p>Another paragraph with a <a href="http://example.com">link</a>.</p>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `# Title

This is a paragraph with **bold** and *italic* text.

Another paragraph with a [link](http://example.com).`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert headings", () => {
    const html = `
      <h1>H1</h1>
      <h2>H2</h2>
      <h3>H3</h3>
      <h4>H4</h4>
      <h5>H5</h5>
      <h6>H6</h6>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `# H1

## H2

### H3

#### H4

##### H5

###### H6`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert lists (ul)", () => {
    const html = `
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
        <li>Item 3</li>
      </ul>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `- Item 1
- Item 2
- Item 3`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert lists (ol)", () => {
    const html = `
      <ol>
        <li>First</li>
        <li>Second</li>
        <li>Third</li>
      </ol>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    // Note: Basic implementation uses "1." for all items now.
    const expectedMarkdown = `1. First
1. Second
1. Third`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert inline code", () => {
    const html = `<p>Use <code>const</code> for constants.</p>`;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `Use \`const\` for constants.`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert code blocks", () => {
    const html = `
      <pre><code>function greet() {
  console.log("Hello");
}</code></pre>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `\`\`\`
function greet() {
  console.log("Hello");
}
\`\`\``;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert code blocks with language class", () => {
    const html = `
      <pre><code class="language-javascript">function greet() {
  console.log("Hello");
}</code></pre>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `\`\`\`javascript
function greet() {
  console.log("Hello");
}
\`\`\``;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert markdown code blocks with extra backticks", () => {
    const html = `
      <pre><code class="language-markdown"># タイトル

これは **マークダウン** です。
\`\`\`javascript
function example() {
  return true;
}
\`\`\`
</code></pre>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `\`\`\`\`markdown
# タイトル

これは **マークダウン** です。
\`\`\`javascript
function example() {
  return true;
}
\`\`\`
\`\`\`\``;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert md code blocks with extra backticks", () => {
    const html = `
      <pre><code class="language-md"># タイトル

これは **マークダウン** です。
\`\`\`
コードブロック
\`\`\`
</code></pre>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `\`\`\`\`md
# タイトル

これは **マークダウン** です。
\`\`\`
コードブロック
\`\`\`
\`\`\`\``;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert blockquotes", () => {
    const html = `<blockquote>This is a quote.</blockquote>`;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `> This is a quote.`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert images", () => {
    const html = `<img src="image.png" alt="Alt text">`;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `![Alt text](image.png)`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert horizontal rules", () => {
    const html = `<hr>`;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `---`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should ignore script and style tags", () => {
    const html = `
      <p>Content</p>
      <script>alert('ignored');</script>
      <style>.ignored { color: red; }</style>
      <p>More Content</p>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `Content

More Content`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should handle nested lists (ul)", () => {
    const html = `
      <ul>
        <li>Item 1</li>
        <li>
          Item 2
          <ul>
            <li>Nested 2.1</li>
            <li>Nested 2.2</li>
          </ul>
        </li>
        <li>Item 3</li>
      </ul>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `- Item 1
- Item 2
  - Nested 2.1
  - Nested 2.2
- Item 3`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should handle nested lists (ol)", () => {
    const html = `
      <ol>
        <li>First</li>
        <li>
          Second
          <ol>
            <li>Nested 2.1</li>
            <li>Nested 2.2</li>
          </ol>
        </li>
        <li>Third</li>
      </ol>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    // Note: Numbering and indentation might need refinement
    const expectedMarkdown = `1. First
1. Second
  1. Nested 2.1
  1. Nested 2.2
1. Third`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should escape Markdown special characters in text", () => {
    const html = `<p>This has *asterisks*, _underscores_, \`backticks\`, [brackets], and \\backslashes\\.</p>`;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `This has \\*asterisks\\*, \\_underscores\\_, \\\`backticks\\\`, \\[brackets\\], and \\\\backslashes\\\\.`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should not escape characters inside code blocks or inline code", () => {
    const html = `
      <p>Inline: <code>_*[]()</code></p>
      <pre><code>
      This *should* not be escaped.
      Neither _should_ [this].
      </code></pre>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `Inline: \`_*[]()\`

\`\`\`
      This *should* not be escaped.
      Neither _should_ [this].
\`\`\``;
    // Restore .trim() for now to focus on content formatting
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should handle image links correctly", () => {
    const html = `<a href="http://example.com"><img src="image.png" alt="Alt text"></a>`;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `[Alt text](http://example.com)`;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should handle complex inline code escaping", () => {
    const html = `<p>Code with backticks: <code>foo \`bar\` baz</code> and double: <code>foo \`\`bar\`\` baz</code>.</p><p>Code starting/ending with backtick: <code>\`start</code> and <code>end\`</code>.</p><p>Just backticks: <code>\`</code> and <code>\`\`</code></p>`;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    // Corrected expected value based on CommonMark Dingus behavior
    const expectedMarkdown = `Code with backticks: \`\`foo \`bar\` baz\`\` and double: \`\`\`foo \`\`bar\`\` baz\`\`\`.

Code starting/ending with backtick: \`\` \`start \`\` and \`\` end\` \`\`.

Just backticks: \`\` \` \`\` and \`\`\` \`\` \`\`\``;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should convert simple table", () => {
    const html = `
      <table>
        <thead>
          <tr>
            <th>Header 1</th>
            <th>Header 2</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Data 1</td>
            <td>Data 2</td>
          </tr>
          <tr>
            <td>Data 3</td>
            <td>Data 4 <strong>bold</strong></td>
          </tr>
        </tbody>
      </table>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `| Header 1 | Header 2 |
|---|---|
| Data 1 | Data 2 |
| Data 3 | Data 4 **bold** |`;
    // Normalize whitespace and pipes for comparison
    const normalize = (str: string) =>
      str
        .replace(/\| /g, "|")
        .replace(/ \|/g, "|")
        .replace(/[ \t]+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();
    expect(normalize(toMarkdown(elementToConvert))).toBe(
      normalize(expectedMarkdown)
    );
  });

  test("should convert table without thead", () => {
    const html = `
      <table>
        <tbody>
          <tr>
            <td>Row 1, Cell 1</td>
            <td>Row 1, Cell 2</td>
          </tr>
          <tr>
            <td>Row 2, Cell 1</td>
            <td>Row 2, Cell 2</td>
          </tr>
        </tbody>
      </table>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    // Expecting a separator line even without a header in GFM
    const expectedMarkdown = `|---|---|
| Row 1, Cell 1 | Row 1, Cell 2 |
| Row 2, Cell 1 | Row 2, Cell 2 |`;
    const normalize = (str: string) =>
      str
        .replace(/\| /g, "|")
        .replace(/ \|/g, "|")
        .replace(/[ \t]+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();
    expect(normalize(toMarkdown(elementToConvert))).toBe(
      normalize(expectedMarkdown)
    );
  });

  test("should convert table with varying columns (padded)", () => {
    const html = `
      <table>
        <thead>
          <tr><th>A</th><th>B</th><th>C</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td>2</td></tr>
          <tr><td>3</td><td>4</td><td>5</td></tr>
        </tbody>
      </table>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `| A | B | C |
|---|---|---|
| 1 | 2 |  |
| 3 | 4 | 5 |`;
    const normalize = (str: string) =>
      str
        .replace(/\| /g, "|")
        .replace(/ \|/g, "|")
        .replace(/[ \t]+/g, " ")
        .replace(/\n+/g, "\n")
        .trim();
    expect(normalize(toMarkdown(elementToConvert))).toBe(
      normalize(expectedMarkdown)
    );
  });

  test("should handle nested blockquotes", () => {
    const html = `
      <blockquote>
        <p>Outer quote.</p>
        <blockquote>
          <p>Inner quote.</p>
        </blockquote>
        <p>Outer quote continued.</p>
      </blockquote>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `> Outer quote.
>
> > Inner quote.
>
> Outer quote continued.`;
    // Normalize whitespace, especially around blockquotes
    const normalize = (str: string) =>
      str
        .replace(/\n{2,}/g, "\n")
        .replace(/^ +/gm, "")
        .trim();
    expect(normalize(toMarkdown(elementToConvert))).toBe(
      normalize(expectedMarkdown)
    );
  });

  // TODO: Add tests for footnotes

  test("should handle code blocks with decorative spans", () => {
    const html = `
      <pre><code class="language-javascript">function <span class="keyword">greet</span>() {
  console.<span class="method">log</span>(<span class="string">"Hello"</span>);
}</code></pre>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `\`\`\`javascript
function greet() {
  console.log("Hello");
}
\`\`\``;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });

  test("should handle complex syntax highlighted code blocks", () => {
    const html = `
      <pre class="language-ts" data-has-button="true"><code class="language-ts code-line" data-line="49"><span class="token keyword">import</span> <span class="token punctuation">{</span> toHTML<span class="token punctuation">,</span> extract <span class="token punctuation">}</span> <span class="token keyword">from</span> <span class="token string">"@mizchi/readability"</span><span class="token punctuation">;</span>
<span class="token keyword">import</span> html2md <span class="token keyword">from</span> <span class="token string">"html-to-md"</span><span class="token punctuation">;</span>

<span class="token keyword">const</span> url <span class="token operator">=</span> <span class="token string">"https://zenn.dev/mizchi/articles/ts-using-sampling-logger"</span><span class="token punctuation">;</span>
<span class="token keyword">const</span> html <span class="token operator">=</span> <span class="token keyword">await</span> <span class="token function">fetch</span><span class="token punctuation">(</span>url<span class="token punctuation">)</span><span class="token punctuation">.</span><span class="token function">then</span><span class="token punctuation">(</span><span class="token punctuation">(</span>res<span class="token punctuation">)</span> <span class="token operator">=&gt;</span> res<span class="token punctuation">.</span><span class="token function">text</span><span class="token punctuation">(</span><span class="token punctuation">)</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">const</span> extracted <span class="token operator">=</span> <span class="token function">extract</span><span class="token punctuation">(</span>html<span class="token punctuation">,</span> <span class="token punctuation">{</span> charThreshold<span class="token operator">:</span> <span class="token number">100</span> <span class="token punctuation">}</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token comment">// 結果を表示</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token template-string"><span class="token template-punctuation string">\`</span><span class="token string">Title: </span><span class="token interpolation"><span class="token interpolation-punctuation punctuation">\${</span>extracted<span class="token punctuation">.</span>title<span class="token interpolation-punctuation punctuation">}</span></span><span class="token template-punctuation string">\`</span></span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span><span class="token template-string"><span class="token template-punctuation string">\`</span><span class="token string">Author: </span><span class="token interpolation"><span class="token interpolation-punctuation punctuation">\${</span>extracted<span class="token punctuation">.</span>byline<span class="token interpolation-punctuation punctuation">}</span></span><span class="token template-punctuation string">\`</span></span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">if</span> <span class="token punctuation">(</span><span class="token operator">!</span>extracted<span class="token punctuation">.</span>root<span class="token punctuation">)</span> <span class="token punctuation">{</span>
  process<span class="token punctuation">.</span><span class="token function">exit</span><span class="token punctuation">(</span><span class="token number">1</span><span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token punctuation">}</span>
<span class="token keyword">const</span> htmlContent <span class="token operator">=</span> <span class="token function">toHTML</span><span class="token punctuation">(</span>extracted<span class="token punctuation">.</span>root<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token keyword">const</span> md <span class="token operator">=</span> <span class="token function">html2md</span><span class="token punctuation">(</span>htmlContent<span class="token punctuation">)</span><span class="token punctuation">;</span>
<span class="token builtin">console</span><span class="token punctuation">.</span><span class="token function">log</span><span class="token punctuation">(</span>md<span class="token punctuation">)</span><span class="token punctuation">;</span></code></pre>
    `;
    const parsed = parseHTML(html);
    const elementToConvert = isVElement(parsed) ? parsed : parsed.body;
    const expectedMarkdown = `\`\`\`ts
import { toHTML, extract } from "@mizchi/readability";
import html2md from "html-to-md";

const url = "https://zenn.dev/mizchi/articles/ts-using-sampling-logger";
const html = await fetch(url).then((res) => res.text());
const extracted = extract(html, { charThreshold: 100 });
// 結果を表示
console.log(\`Title: \${extracted.title}\`);
console.log(\`Author: \${extracted.byline}\`);
if (!extracted.root) {
  process.exit(1);
}
const htmlContent = toHTML(extracted.root);
const md = html2md(htmlContent);
console.log(md);
\`\`\``;
    expect(toMarkdown(elementToConvert).trim()).toBe(expectedMarkdown);
  });
});
