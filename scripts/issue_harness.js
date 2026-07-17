#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const QUEUE_FILE = path.join(__dirname, '../issue_queue.json');
const STATE_FILE = path.join(__dirname, '../.harness_state.json');

function runCommand(cmd, cwd = process.cwd(), stdio = 'pipe') {
  try {
    return execSync(cmd, { cwd, stdio, encoding: 'utf8' }).trim();
  } catch (error) {
    if (stdio === 'inherit') {
      throw error;
    }
    return null;
  }
}

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function askChoice(rl, question, choices) {
  console.log(`\n${question}`);
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`));
  for (;;) {
    const raw = (await ask(rl, `선택 (1-${choices.length}): `)).trim();
    const n = parseInt(raw, 10);
    if (n >= 1 && n <= choices.length) return n - 1;
    console.log(`  ❗ 1~${choices.length} 사이 숫자를 입력하세요.`);
  }
}

async function buildQueue() {
  console.log('🔍 Fetching open issues from GitHub...');
  const output = runCommand('gh issue list --json number,title,body');
  if (!output) {
    console.error('❌ Failed to fetch issues from GitHub. Please make sure gh cli is logged in.');
    process.exit(1);
  }

  const issues = JSON.parse(output);
  const adj = {};
  const inDegree = {};
  const issueMap = {};

  // Initialize
  for (const issue of issues) {
    issueMap[issue.number] = issue;
    adj[issue.number] = [];
    inDegree[issue.number] = 0;
  }

  // Parse dependencies (e.g., "Depends on #123" or "requires #123")
  const depRegex = /(?:depends\s+on|requires|after)\s+#(\d+)/gi;

  for (const issue of issues) {
    const body = issue.body || '';
    let match;
    depRegex.lastIndex = 0;
    while ((match = depRegex.exec(body)) !== null) {
      const depNum = parseInt(match[1], 10);
      if (adj[depNum] !== undefined) {
        adj[depNum].push(issue.number);
        inDegree[issue.number] = (inDegree[issue.number] || 0) + 1;
      }
    }
  }

  // Topological sort
  const queue = [];
  const result = [];

  for (const issue of issues) {
    if (inDegree[issue.number] === 0) {
      queue.push(issue.number);
    }
  }

  queue.sort((a, b) => a - b);

  while (queue.length > 0) {
    const curr = queue.shift();
    result.push(issueMap[curr]);

    for (const neighbor of adj[curr]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor);
      }
    }
    queue.sort((a, b) => a - b);
  }

  if (result.length < issues.length) {
    console.warn('⚠️ Warning: Dependency cycles or missing dependencies detected. Falling back to default order.');
    const remaining = issues.filter(i => !result.find(r => r.number === i.number));
    remaining.sort((a, b) => a.number - b.number);
    result.push(...remaining);
  }

  const queueData = result.map(i => ({
    number: i.number,
    title: i.title,
    status: 'QUEUED'
  }));

  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queueData, null, 2), 'utf8');
  console.log(`✅ Issue queue built and saved to ${QUEUE_FILE}`);
  console.log('\nQueue Order:');
  queueData.forEach((item, idx) => {
    console.log(`  ${idx + 1}. [#${item.number}] ${item.title}`);
  });
}

async function startIssue(issueNumber) {
  if (!fs.existsSync(QUEUE_FILE)) {
    await buildQueue();
  }

  const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
  let targetIssue;

  if (issueNumber) {
    targetIssue = queue.find(i => i.number === parseInt(issueNumber, 10));
    if (!targetIssue) {
      console.error(`❌ Issue #${issueNumber} not found in the queue.`);
      process.exit(1);
    }
  } else {
    targetIssue = queue.find(i => i.status === 'QUEUED');
    if (!targetIssue) {
      console.log('✅ No queued issues left to process!');
      return;
    }
  }

  console.log(`\n🏁 Starting work on Issue [#${targetIssue.number}] ${targetIssue.title}`);

  const worktreePath = path.join(__dirname, `../.worktrees/issue-${targetIssue.number}`);
  const branchName = `feature/issue-${targetIssue.number}`;

  console.log('📥 Fetching latest origin/main...');
  runCommand('git fetch origin main');

  if (fs.existsSync(worktreePath)) {
    console.log(`💡 Worktree at ${worktreePath} already exists.`);
  } else {
    console.log(`🌿 Creating git worktree at ${worktreePath} on branch ${branchName}...`);
    const addResult = runCommand(`git worktree add "${worktreePath}" origin/main -b "${branchName}"`);
    if (!addResult) {
      console.error('❌ Failed to create worktree.');
      process.exit(1);
    }
  }

  const state = {
    number: targetIssue.number,
    title: targetIssue.title,
    worktreePath: worktreePath,
    branchName: branchName,
  };
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');

  targetIssue.status = 'IN_PROGRESS';
  fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');

  console.log('\n✅ Worktree prepared successfully!');
  console.log(`   - Worktree Path: ${worktreePath}`);
  console.log(`   - Branch Name: ${branchName}`);
  console.log(`\n💡 To begin work, define a subagent and execute tasks in the worktree directory.`);
}

async function closeIssue() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error('❌ No active harness session found. Run "yarn harness start" first.');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  console.log(`📦 Closing work on Issue [#${state.number}] ${state.title}`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const confirm = (await ask(rl, `Push branch '${state.branchName}' and create PR? (Y/n): `)).trim().toLowerCase();
    if (confirm !== '' && confirm !== 'y' && confirm !== 'yes') {
      console.log('❌ PR creation cancelled.');
      return;
    }

    console.log(`📤 Pushing branch '${state.branchName}' to remote origin...`);
    runCommand(`git push -u origin "${state.branchName}"`, state.worktreePath, 'inherit');

    console.log('🚀 Creating Pull Request via gh cli...');
    const prTitle = `[ISSUE-${state.number}] ${state.title}`;
    
    const templatePath = path.join(__dirname, '../.github/PULL_REQUEST_TEMPLATE.md');
    let prBody = '';
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      prBody = templateContent.replace(/Closes\s+#\s*$/m, `Closes #${state.number}`);
    } else {
      prBody = `Closes #${state.number}`;
    }

    const tempBodyFile = path.join(__dirname, '../.pr_body.md');
    fs.writeFileSync(tempBodyFile, prBody, 'utf8');

    runCommand(`gh pr create --title "${prTitle}" --body-file "${tempBodyFile}"`, state.worktreePath, 'inherit');

    if (fs.existsSync(tempBodyFile)) {
      fs.unlinkSync(tempBodyFile);
    }

    console.log('\n🎉 PR created successfully!');
    console.log('⚠️ Please request a human review. Once merged, run "yarn harness clean" to remove the worktree.');
  } finally {
    rl.close();
  }
}

async function cleanIssue() {
  if (!fs.existsSync(STATE_FILE)) {
    console.error('❌ No active harness session found.');
    process.exit(1);
  }

  const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  console.log(`🧹 Cleaning up worktree for Issue [#${state.number}]`);

  console.log(`🗑️ Removing worktree at ${state.worktreePath}...`);
  runCommand(`git worktree remove "${state.worktreePath}" --force`);

  console.log(`🌿 Deleting local branch ${state.branchName}...`);
  runCommand(`git branch -D "${state.branchName}"`);

  if (fs.existsSync(QUEUE_FILE)) {
    const queue = JSON.parse(fs.readFileSync(QUEUE_FILE, 'utf8'));
    const target = queue.find(i => i.number === state.number);
    if (target) {
      target.status = 'MERGED';
      fs.writeFileSync(QUEUE_FILE, JSON.stringify(queue, null, 2), 'utf8');
    }
  }

  fs.unlinkSync(STATE_FILE);
  console.log('✅ Cleanup completed successfully!');
}

async function main() {
  const [, , cmd, arg] = process.argv;

  if (cmd === 'queue') {
    await buildQueue();
  } else if (cmd === 'start') {
    await startIssue(arg);
  } else if (cmd === 'pr') {
    await closeIssue();
  } else if (cmd === 'clean') {
    await cleanIssue();
  } else {
    console.log('\n🤖 Open Issue processing Harness');
    console.log('━'.repeat(52));
    console.log('Commands:');
    console.log('  yarn harness queue            - Fetch open issues, analyze dependencies & make queue');
    console.log('  yarn harness start [number]   - Create git worktree & branch from origin/main for next issue');
    console.log('  yarn harness pr               - Push branch & open Pull Request via gh cli');
    console.log('  yarn harness clean            - Remove git worktree & branch after PR merge');
  }
}

main().catch(e => {
  console.error('오류 발생:', e.message);
  process.exit(1);
});
