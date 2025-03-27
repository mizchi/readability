import { readable, PageType } from "../src/index.ts"; // Adjust path as needed, import PageType, remove toReadableAriaTree

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

// AriaTree is now generated by default internally
const result = readable(sampleHtml);
console.log("\n--- Page Type ---");
console.log(result.inferPageType()); // Use the inferPageType() method
console.log("\n--- ARIA Tree ---");
// ariaTree might be undefined if generation failed or was disabled (though enabled by default in readable)
const ariaTree = result.getAriaTree({ compact: false }); // Use the getAriaTree() method
console.log(ariaTree);
console.log("\n--- Extracted Markdown ---");
console.log(result.toMarkdown()); // Use the toMarkdown() method

console.log("\n--- Link Hierarchy Analysis ---");
const linkHierarchy = result.getLinkHierarchy(); // Use the analyzeLinkHierarchy() method
console.log("Parent links:", linkHierarchy.parent.length);
console.log("Sibling links:", linkHierarchy.sibling.length);
console.log("Child links:", linkHierarchy.child.length);
console.log("External links:", linkHierarchy.external.length);
