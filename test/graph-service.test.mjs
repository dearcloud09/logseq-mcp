import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, link, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { GraphService } from '../dist/graph.js';

async function withGraph(fn) {
  const root = await mkdtemp(join(tmpdir(), 'logseq-mcp-test-'));
  await mkdir(join(root, 'pages'), { recursive: true });
  await mkdir(join(root, 'journals'), { recursive: true });

  try {
    return await fn(root, new GraphService(root));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('creates, reads, appends, and searches markdown pages', async () => {
  await withGraph(async (_root, graph) => {
    const created = await graph.createPage(
      'Project A',
      '- Sprint notes #meeting\n- Related to [[Goals]]',
      { status: 'active' }
    );

    assert.equal(created.name, 'Project A');
    assert.equal(created.path, 'pages/Project A.md');
    assert.deepEqual(created.properties, { status: 'active' });
    assert.deepEqual(created.tags, ['meeting']);
    assert.deepEqual(created.links, ['Goals']);

    const readByPath = await graph.readPage('pages/Project A');
    assert.equal(readByPath.content, '- Sprint notes #meeting\n- Related to [[Goals]]');

    const appended = await graph.appendToPage('Project A', '- Follow-up item');
    assert.match(appended.content, /Follow-up item/);

    const results = await graph.searchPages('Sprint', { tags: ['meeting'], folder: 'pages' });
    assert.equal(results.length, 1);
    assert.equal(results[0].page.name, 'Project A');
    assert.equal(results[0].matches[0].line, 3);
  });
});

test('creates and reads dated journal pages', async () => {
  await withGraph(async (_root, graph) => {
    const journal = await graph.createJournalPage('2026-06-06', '- Daily note');

    assert.equal(journal.name, '2026_06_06');
    assert.equal(journal.path, 'journals/2026_06_06.md');
    assert.equal(journal.isJournal, true);

    const read = await graph.getJournalPage('2026-06-06');
    assert.equal(read?.content, '- Daily note');

    await assert.rejects(
      () => graph.getJournalPage('20260606'),
      /Invalid date format/
    );
  });
});

test('blocks traversal and non-page graph files', async () => {
  await withGraph(async (root, graph) => {
    await mkdir(join(root, 'logseq'), { recursive: true });
    await writeFile(join(root, 'logseq', 'config.edn'), '{:secret true}', 'utf-8');

    await assert.rejects(
      () => graph.readPage('../outside'),
      /Access denied/
    );

    await assert.rejects(
      () => graph.readPage('logseq/config.edn'),
      /Access denied/
    );
  });
});

test('skips symbolic links and hardlinks when listing or reading pages', async (t) => {
  await withGraph(async (root, graph) => {
    await writeFile(join(root, 'pages', 'Normal.md'), '- Safe page', 'utf-8');

    const outside = join(root, '..', 'outside-logseq-mcp-test.md');
    await writeFile(outside, '- Outside file', 'utf-8');
    t.after(async () => {
      await rm(outside, { force: true });
    });

    await symlink(outside, join(root, 'pages', 'Linked.md'));
    await link(outside, join(root, 'pages', 'Hardlinked.md'));

    const pages = await graph.listPages('pages');
    assert.deepEqual(pages.map((page) => page.name), ['Normal']);

    await assert.rejects(
      () => graph.readPage('Linked'),
      /symbolic links/
    );

    await assert.rejects(
      () => graph.readPage('Hardlinked'),
      /hardlinks/
    );
  });
});

test('validates unsafe names, oversized content, and property injection', async () => {
  await withGraph(async (_root, graph) => {
    await assert.rejects(
      () => graph.createPage('../bad', '- bad'),
      /Invalid page name/
    );

    await assert.rejects(
      () => graph.createPage('Big Page', 'x'.repeat(10 * 1024 * 1024 + 1)),
      /Content too large/
    );

    await assert.rejects(
      () => graph.createPage('Bad Properties', '- body', { 'bad\nkey': 'value' }),
      /Invalid property/
    );
  });
});
