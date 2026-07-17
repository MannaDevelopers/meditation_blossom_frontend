#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ACTIVE_ISSUE_FILE = path.join(__dirname, '../.active_issue.json');

function runCommand(cmd, stdio = 'pipe') {
  try {
    return execSync(cmd, { stdio, encoding: 'utf8' }).trim();
  } catch (error) {
    return null;
  }
}

function loadActiveIssue() {
  if (fs.existsSync(ACTIVE_ISSUE_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ACTIVE_ISSUE_FILE, 'utf8'));
    } catch (e) {
      return null;
    }
  }
  // Try to infer from branch name
  const branch = runCommand('git branch --show-current');
  if (branch) {
    const match = branch.match(/^feature\/issue-(\d+)/);
    if (match) {
      return { number: match[1], title: `Branch issue #${match[1]}` };
    }
  }
  return null;
}

function saveActiveIssue(number, title) {
  fs.writeFileSync(ACTIVE_ISSUE_FILE, JSON.stringify({ number, title }, null, 2), 'utf8');
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

async function start(issueNumber) {
  if (!issueNumber) {
    console.error('❌ 사용법: yarn issue start <issue_number>');
    process.exit(1);
  }

  console.log(`🔍 GitHub Issue #${issueNumber} 정보 조회 중...`);
  const ghOutput = runCommand(`gh issue view ${issueNumber} --json number,title`);
  if (!ghOutput) {
    console.error('❌ Issue 정보를 가져오지 못했습니다. gh cli 로그인 상태 및 issue 번호를 확인해주세요.');
    process.exit(1);
  }

  let issue;
  try {
    issue = JSON.parse(ghOutput);
  } catch (e) {
    console.error('❌ gh cli 출력 파싱 실패:', ghOutput);
    process.exit(1);
  }

  const branchName = `feature/issue-${issue.number}`;
  console.log(`🌿 브랜치 생성 및 체크아웃: ${branchName}`);
  
  // 브랜치가 이미 있는지 확인
  const branchExists = runCommand(`git branch --list ${branchName}`);
  if (branchExists) {
    runCommand(`git checkout ${branchName}`, 'inherit');
  } else {
    runCommand(`git checkout -b ${branchName}`, 'inherit');
  }

  saveActiveIssue(issue.number, issue.title);
  console.log(`\n✅ 성공적으로 설정되었습니다!`);
  console.log(`   - 활성 브랜치: ${branchName}`);
  console.log(`   - 활성 이슈: [#${issue.number}] ${issue.title}`);
}

async function commit() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let issue = loadActiveIssue();
    if (!issue) {
      console.log('💡 활성화된 이슈 컨텍스트를 찾을 수 없습니다.');
      const issueNum = (await ask(rl, '이슈 번호를 직접 입력하세요 (건너뛰려면 Enter): ')).trim();
      if (issueNum) {
        issue = { number: issueNum, title: '' };
      }
    }

    const types = [
      'feat: 새로운 기능 추가',
      'fix: 버그 수정',
      'refactor: 코드 리팩토링',
      'style: 코드 포맷팅, 세미콜론 누락 등 (동작 변경 없는 수정)',
      'docs: 문서 수정',
      'test: 테스트 코드 추가/수정',
      'chore: 빌드 업무, 패키지 매니저 설정 등',
    ];

    const typeIdx = await askChoice(rl, '커밋 타입을 선택하세요:', types);
    const commitType = types[typeIdx].split(':')[0];

    const message = (await ask(rl, '커밋 메시지를 입력하세요: ')).trim();
    if (!message) {
      console.error('❌ 커밋 메시지는 필수입니다.');
      return;
    }

    let commitMsg = '';
    if (issue && issue.number) {
      commitMsg = `[ISSUE-${issue.number}] ${commitType}: ${message}`;
    } else {
      commitMsg = `${commitType}: ${message}`;
    }

    console.log(`\n📝 커밋 메시지: "${commitMsg}"`);
    const confirm = (await ask(rl, '이 메시지로 커밋하시겠습니까? (Y/n): ')).trim().toLowerCase();
    if (confirm === '' || confirm === 'y' || confirm === 'yes') {
      runCommand(`git commit -m "${commitMsg}"`, 'inherit');
      console.log('✅ 커밋 완료!');
    } else {
      console.log('❌ 커밋이 취소되었습니다.');
    }
  } finally {
    rl.close();
  }
}

async function pr() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let issue = loadActiveIssue();
    if (!issue) {
      console.error('❌ 활성화된 이슈가 없습니다. "yarn issue start <issue_number>"를 먼저 실행하세요.');
      return;
    }

    console.log(`\n📢 GitHub Pull Request 생성 (이슈 #${issue.number})`);
    console.log(`   제목: [ISSUE-${issue.number}] ${issue.title}`);

    const prTypeIdx = await askChoice(rl, 'PR 생성 방식을 선택하세요:', [
      'Draft PR 생성 (중간 공유 및 리뷰용)',
      '일반 PR 생성 (리뷰 및 머지 요청)',
      '웹 브라우저에서 생성 진행 (gh web)',
    ]);

    const title = `[ISSUE-${issue.number}] ${issue.title}`;
    
    // Load PR template from .github/PULL_REQUEST_TEMPLATE.md if exists
    const templatePath = path.join(__dirname, '../.github/PULL_REQUEST_TEMPLATE.md');
    let body = '';
    if (fs.existsSync(templatePath)) {
      const templateContent = fs.readFileSync(templatePath, 'utf8');
      body = templateContent.replace(/Closes\s+#\s*$/m, `Closes #${issue.number}`);
    } else {
      body = `## 작업내용\n<!--주요 작업 내용에 대해 설명해주세요-->\n\n## 관련 이슈\nCloses #${issue.number}\n\n## 체크리스트\n- [ ] 불필요한 console.log를 제거했나요?\n- [ ] 테스트를 진행했나요?\n- [ ] 문서를 업데이트했나요?`;
    }

    // 임시 파일에 body 저장 (공백 및 개행 유지)
    const tempBodyFile = path.join(__dirname, '../.pr_body.md');
    fs.writeFileSync(tempBodyFile, body, 'utf8');

    let prCmd = '';
    if (prTypeIdx === 0) {
      prCmd = `gh pr create --draft --title "${title}" --body-file "${tempBodyFile}"`;
    } else if (prTypeIdx === 1) {
      prCmd = `gh pr create --title "${title}" --body-file "${tempBodyFile}"`;
    } else {
      prCmd = `gh pr create --title "${title}" --body-file "${tempBodyFile}" --web`;
    }

    console.log(`\n🚀 명령 실행 중: ${prCmd}`);
    runCommand(prCmd, 'inherit');
    
    // 임시 파일 삭제
    if (fs.existsSync(tempBodyFile)) {
      fs.unlinkSync(tempBodyFile);
    }

    console.log('\n✅ PR 생성 처리가 완료되었습니다.');
  } finally {
    rl.close();
  }
}

async function main() {
  const [, , cmd, arg] = process.argv;

  if (cmd === 'start') {
    await start(arg);
  } else if (cmd === 'commit') {
    await commit();
  } else if (cmd === 'pr') {
    await pr();
  } else {
    console.log('\n🛠️  GitHub Issue 및 Git 워크플로우 헬퍼');
    console.log('━'.repeat(52));
    console.log('사용법:');
    console.log('  yarn issue start <issue_number>  - 이슈 확인, 브랜치 생성 및 체크아웃');
    console.log('  yarn issue commit                - 대화형 커밋 작성 (이슈 번호 자동 매칭)');
    console.log('  yarn issue pr                    - 대화형 PR 생성 (Draft / 일반 / 웹)');
  }
}

main().catch(e => {
  console.error('오류 발생:', e.message);
  process.exit(1);
});
