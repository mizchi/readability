import {
  createVElement,
  createVTextNode,
  setAttribute,
  getAttribute
} from './v2/vdom.ts';
import { postProcessContent } from './v2/readability/postprocess.ts';
import type { VElement, VTextNode } from './v2/types.ts';

// テスト用のVDOM要素を作成
function createTestElement(): VElement {
  // ルート要素
  const article = createVElement('div');
  setAttribute(article, 'id', 'article');
  setAttribute(article, 'class', 'article-content main-content page');

  // ネストされたDIV（簡略化されるべき）
  const nestedDiv = createVElement('div');
  setAttribute(nestedDiv, 'class', 'nested-content');
  
  const innerDiv = createVElement('div');
  setAttribute(innerDiv, 'class', 'inner-content');
  
  const paragraph = createVElement('p');
  const text = createVTextNode('これはテストコンテンツです。');
  paragraph.children.push(text);
  text.parent = paragraph;
  
  innerDiv.children.push(paragraph);
  paragraph.parent = innerDiv;
  
  nestedDiv.children.push(innerDiv);
  innerDiv.parent = nestedDiv;
  
  article.children.push(nestedDiv);
  nestedDiv.parent = article;

  // 空のDIV（削除されるべき）
  const emptyDiv = createVElement('div');
  setAttribute(emptyDiv, 'class', 'empty-div');
  const br = createVElement('br');
  emptyDiv.children.push(br);
  br.parent = emptyDiv;
  
  article.children.push(emptyDiv);
  emptyDiv.parent = article;

  // リンク要素（相対URLを含む）
  const linkParagraph = createVElement('p');
  
  const link = createVElement('a');
  setAttribute(link, 'href', 'relative/path/to/page.html');
  const linkText = createVTextNode('相対リンク');
  link.children.push(linkText);
  linkText.parent = link;
  
  linkParagraph.children.push(link);
  link.parent = linkParagraph;
  
  article.children.push(linkParagraph);
  linkParagraph.parent = article;

  // JavaScriptリンク（テキストノードに変換されるべき）
  const jsLinkParagraph = createVElement('p');
  
  const jsLink = createVElement('a');
  setAttribute(jsLink, 'href', 'javascript:void(0)');
  const jsLinkText = createVTextNode('JavaScriptリンク');
  jsLink.children.push(jsLinkText);
  jsLinkText.parent = jsLink;
  
  jsLinkParagraph.children.push(jsLink);
  jsLink.parent = jsLinkParagraph;
  
  article.children.push(jsLinkParagraph);
  jsLinkParagraph.parent = article;

  // 画像要素
  const imgParagraph = createVElement('p');
  
  const img = createVElement('img');
  setAttribute(img, 'src', 'images/test.jpg');
  setAttribute(img, 'alt', 'テスト画像');
  
  imgParagraph.children.push(img);
  img.parent = imgParagraph;
  
  article.children.push(imgParagraph);
  imgParagraph.parent = article;

  return article;
}

// VElement構造を文字列として出力する関数
function printElement(element: VElement | VTextNode, indent = 0): void {
  const indentStr = ' '.repeat(indent);
  
  if (element.nodeType === 'text') {
    console.log(`${indentStr}"${element.textContent}"`);
    return;
  }
  
  const attrs = Object.entries(element.attributes)
    .map(([key, value]) => `${key}="${value}"`)
    .join(' ');
  
  console.log(`${indentStr}<${element.tagName}${attrs ? ' ' + attrs : ''}>`);
  
  for (const child of element.children) {
    printElement(child, indent + 2);
  }
  
  console.log(`${indentStr}</${element.tagName}>`);
}

// メイン処理
function main() {
  console.log('=== テスト開始 ===');
  
  // テスト用の要素を作成
  const article = createTestElement();
  
  console.log('\n=== 処理前の構造 ===');
  printElement(article);
  
  // postProcessContent関数を実行
  console.log('\n=== 後処理を実行 ===');
  postProcessContent(article, {
    keepClasses: false,
    baseURI: 'https://example.com/base/',
    documentURI: 'https://example.com/document/'
  });
  
  console.log('\n=== 処理後の構造 ===');
  printElement(article);
  
  // 変更点の確認
  console.log('\n=== 変更点の確認 ===');
  
  // 1. クラス属性の確認
  console.log('1. クラス属性の確認:');
  const classAfter = getAttribute(article, 'class');
  console.log(`  - 処理後のクラス: ${classAfter || 'なし'}`);
  
  // 2. ネストされた要素の簡略化の確認
  console.log('2. ネストされた要素の簡略化:');
  console.log(`  - 子要素の数: ${article.children.length}`);
  
  // 3. 空要素の削除の確認
  console.log('3. 空要素の削除:');
  const hasEmptyDiv = article.children.some(child => 
    child.nodeType === 'element' && getAttribute(child, 'class') === 'empty-div'
  );
  console.log(`  - 空のdiv要素は${hasEmptyDiv ? '残っています' : '削除されました'}`);
  
  // 4. 相対URLの変換確認
  console.log('4. 相対URLの変換:');
  const links: VElement[] = [];
  
  // 子要素を再帰的に検索
  function findLinks(element: VElement): void {
    for (const child of element.children) {
      if (child.nodeType === 'element') {
        if (child.tagName === 'A') {
          links.push(child);
        }
        findLinks(child);
      }
    }
  }
  
  findLinks(article);
  
  if (links.length > 0) {
    links.forEach(link => {
      console.log(`  - リンクのhref: ${getAttribute(link, 'href')}`);
    });
  } else {
    console.log('  - リンク要素が見つかりません');
  }
  
  // 5. 画像URLの変換確認
  console.log('5. 画像URLの変換:');
  const images: VElement[] = [];
  
  // 子要素を再帰的に検索
  function findImages(element: VElement): void {
    for (const child of element.children) {
      if (child.nodeType === 'element') {
        if (child.tagName === 'IMG') {
          images.push(child);
        }
        findImages(child);
      }
    }
  }
  
  findImages(article);
  
  if (images.length > 0) {
    images.forEach(img => {
      console.log(`  - 画像のsrc: ${getAttribute(img, 'src')}`);
    });
  } else {
    console.log('  - 画像要素が見つかりません');
  }
  
  console.log('\n=== テスト終了 ===');
}

// スクリプトを実行
main();
