import assert from 'node:assert/strict';
import test from 'node:test';
import { escapeXml, projectWorldPoint, renderSceneToAnimatedSvg, rgbToHex } from '../src/svgExporter.js';

test('escapeXml encodes special XML characters cleanly', () => {
  assert.equal(escapeXml(`<&>"'`), '&lt;&amp;&gt;&quot;&#39;');
  assert.equal(escapeXml('*+#'), '*+#');
});

test('rgbToHex packs rgb strings into compact hex notation', () => {
  assert.equal(rgbToHex('rgb(255,255,255)'), '#fff');
  assert.equal(rgbToHex('rgb(18,145,42)'), '#12912a');
  assert.equal(rgbToHex('rgb(0,0,0)'), '#000');
});

test('projectWorldPoint projects center origin cleanly inside viewport bounds', () => {
  const pt = projectWorldPoint([0, 0.25, 0], { rotationDeg: 14, widthPx: 820, heightPx: 500 });
  assert.ok(pt.x > 250 && pt.x < 570);
  assert.ok(pt.y > 100 && pt.y < 420);
  assert.ok(pt.zCam > 2);
});

test('renderSceneToAnimatedSvg produces compact GitHub-safe animated vector SVG', () => {
  const svg = renderSceneToAnimatedSvg({ width: 820, height: 500, rows: 92, rotationDeg: 14 });
  const bytes = Buffer.byteLength(svg, 'utf8');

  assert.ok(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(svg.includes('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 500"'));
  assert.ok(!svg.includes('<script'), 'GitHub strips SVGs containing scripts');
  const withoutXmlns = svg.replaceAll('xmlns="http://www.w3.org/2000/svg"', '');
  assert.ok(!withoutXmlns.includes('http://') && !withoutXmlns.includes('https://'), 'Must stay self-contained without external fetches');
  assert.ok(svg.includes('@keyframes twA'));
  assert.ok(svg.includes('@keyframes ribWave'));
  assert.ok(svg.includes('@keyframes snowDown'));
  assert.ok(svg.includes('@keyframes smkA'));
  assert.ok(svg.includes('@KH4NHTU0NG'));
  assert.ok(svg.includes('interactive 3D'));
  const treeSection = svg.match(/<g id="tree">([\s\S]*?)<g id="ribbon">/)?.[1] || '';
  assert.ok(treeSection.length > 1000, 'Static tree section should exist');
  assert.equal((treeSection.match(/>s</g) || []).length, 0, 'Static smoke must not duplicate inside tree layer');
  assert.ok(bytes > 50_000 && bytes < 500_000, `Unexpected SVG byte size: ${bytes}`);
});
