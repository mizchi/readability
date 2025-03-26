import { test, expect, describe } from 'vitest';
import { parseHTML } from '../html_parser';
import { isProbablyReaderable } from '../readability/readerable';

describe('isProbablyReaderable', () => {
  // 小さすぎるコンテンツのテスト
  test('小さすぎるコンテンツは読み取り可能と判断されない', () => {
    const verySmallDoc = parseHTML('<html><p id="main">hello there</p></html>'); // コンテンツ長: 11
    expect(isProbablyReaderable(verySmallDoc)).toBe(false);
  });

  // 小さいコンテンツのテスト
  test('小さいコンテンツは読み取り可能と判断されない（デフォルト設定）', () => {
    const smallDoc = parseHTML(
      `<html><p id="main">${"hello there ".repeat(11)}</p></html>`
    ); // コンテンツ長: 132
    expect(isProbablyReaderable(smallDoc)).toBe(false);
  });

  // 大きいコンテンツのテスト
  test('大きいコンテンツは読み取り可能と判断される（デフォルト設定）', () => {
    const largeDoc = parseHTML(
      `<html><p id="main">${"hello there ".repeat(50)}</p></html>`
    ); // コンテンツ長: 600
    expect(isProbablyReaderable(largeDoc)).toBe(true);
  });

  // minContentLengthオプションのテスト
  test('minContentLengthオプションを使用すると小さいコンテンツも読み取り可能と判断される', () => {
    const smallDoc = parseHTML(
      `<html><p id="main">${"hello there ".repeat(11)}</p></html>`
    ); // コンテンツ長: 132
    const options = { minContentLength: 120, minScore: 0 };
    expect(isProbablyReaderable(smallDoc, options)).toBe(true);
  });

  // minScoreオプションのテスト
  test('minScoreオプションを使用すると大きいコンテンツも読み取り可能と判断されない', () => {
    const largeDoc = parseHTML(
      `<html><p id="main">${"hello there ".repeat(12)}</p></html>`
    ); // コンテンツ長: 144
    const options = { minContentLength: 0, minScore: 30 };
    expect(isProbablyReaderable(largeDoc, options)).toBe(false);
  });

  // visibilityCheckerオプションのテスト
  test('visibilityCheckerオプションを使用して可視性を制御できる（非表示）', () => {
    const doc = parseHTML(
      `<html><p id="main">${"hello there ".repeat(50)}</p></html>`
    );
    let called = false;
    const options = {
      visibilityChecker: () => {
        called = true;
        return false;
      }
    };
    expect(isProbablyReaderable(doc, options)).toBe(false);
    expect(called).toBe(true);
  });

  // visibilityCheckerオプションのテスト（関数として渡す）
  test('visibilityCheckerを関数として渡せる（表示）', () => {
    const doc = parseHTML(
      `<html><p id="main">${"hello there ".repeat(50)}</p></html>`
    );
    let called = false;
    const visibilityChecker = () => {
      called = true;
      return true;
    };
    expect(isProbablyReaderable(doc, visibilityChecker)).toBe(true);
    expect(called).toBe(true);
  });

  // unlikelyCandidatesのテスト
  test('unlikelyCandidatesに一致する要素は無視される', () => {
    const doc = parseHTML(
      `<html><p id="sidebar" class="sidebar">${"hello there ".repeat(50)}</p></html>`
    );
    expect(isProbablyReaderable(doc)).toBe(false);
  });

  // okMaybeItsCandidateのテスト
  test('okMaybeItsCandidateに一致する要素は考慮される', () => {
    const doc = parseHTML(
      `<html><p id="sidebar" class="article-sidebar">${"hello there ".repeat(50)}</p></html>`
    );
    expect(isProbablyReaderable(doc)).toBe(true);
  });

  // li p パターンのテスト
  test('li p パターンの要素は無視される', () => {
    const doc = parseHTML(
      `<html><li><p>${"hello there ".repeat(50)}</p></li></html>`
    );
    expect(isProbablyReaderable(doc)).toBe(false);
  });

  // brを含むdivのテスト
  test('brを含むdivは考慮される', () => {
    const doc = parseHTML(
      `<html><div>${"hello there ".repeat(25)}<br>${"hello there ".repeat(25)}</div></html>`
    );
    expect(isProbablyReaderable(doc)).toBe(true);
  });
});
