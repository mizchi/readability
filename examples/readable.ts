import { readable, toReadableAriaTree, PageType } from "../src/index.ts"; // Adjust path as needed, import PageType

const sampleHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Sample Article</title>
</head>
<body>
    <header>
        <h1>My Awesome Article</h1>
        <p>By John Doe</p>
    </header>
    <main>
        <article>
            <p>This is the first paragraph of the main content. It provides an introduction.</p>
            <p>Here is the second paragraph, containing more details. <strong>Readability</strong> aims to extract this part.</p>
            <ul>
                <li>Point one</li>
                <li>Point two</li>
            </ul>
            <p>A concluding paragraph with a <a href="http://example.com">link</a>.</p>
        </article>
    </main>
    <aside>
        <h2>Related Links</h2>
        <ul>
            <li><a href="#">Link 1</a></li>
            <li><a href="#">Link 2</a></li>
        </ul>
    </aside>
    <footer>
        <p>Copyright 2025</p>
    </footer>
</body>
</html>
`;

console.log("--- Running readable function ---");
const result = readable(sampleHtml);

console.log("\n--- Extracted Markdown ---");
console.log(result.markdown);

console.log("\n--- Page Type ---");
console.log(result.pageType);

console.log("\n--- ARIA Tree ---");
// ariaTree might be undefined if generation failed or was disabled (though enabled by default in readable)
if (result.ariaTree) {
  // console.log(toReadableAriaTree(doc)); // TODO: Need VDocument to use toReadableAriaTree
} else {
  console.log("ARIA Tree not generated.");
}

console.log("\n--- Snapshot Metadata ---");
console.log(result.snapshot.metadata);

// Example with forced pageType
console.log("\n--- Running readable with forced PageType.OTHER ---");
const resultOther = readable(sampleHtml, { pageType: PageType.OTHER }); // Use PageType enum
console.log("Forced Page Type:", resultOther.pageType);
console.log("Markdown (should be empty or minimal for OTHER):");
console.log(resultOther.markdown);
