# dc-code-paste

DCInside 글쓰기 화면에 붙여넣을 리치 텍스트 HTML을 만드는 정적 웹 도구.

**→ https://0disoft.github.io/dc-code-paste/**

---

## 주요 기능

- 글쓰기 에디터 + 실시간 미리보기
- 코드블록 (파일명, 언어, 라인 하이라이트, 추가/삭제/강조 줄 표시)
- 콜아웃, 요약, 튜토리얼, 비교, references, CTA 블록
- Markdown 가져오기 및 적용
- LLM 가이드 복사 (ChatGPT, Claude, Gemini 등과 연동)
- 프리셋 저장
- 초안 히스토리
- 라이트/다크 테마
- 브라우저 종료 후에도 localStorage로 자동 복원

---

## 기본 사용 흐름

1. 왼쪽 편집기에서 글을 작성한다.
2. 오른쪽 미리보기에서 결과를 확인한다.
3. `디씨 복사` 버튼을 클릭한다.
4. DCInside 글쓰기 에디터에 붙여넣는다.

> **주의:** 이 도구는 DCInside 에디터에 **리치 텍스트로 붙여넣는** 도구다.
> HTML 원문을 DCInside HTML 모드에 직접 입력하는 방식과 다르다.
> 미리보기 패널을 `HTML`로 전환하면 `원문 복사`로 raw HTML 소스도 복사할 수 있지만,
> 일반적인 사용은 `디씨 복사` → 에디터 붙여넣기다.

---

## LLM으로 글 작성하기

1. `LLM 가이드` 버튼을 클릭해 작성 규칙을 복사한다.
2. ChatGPT, Claude, Gemini 등에 규칙과 작성할 주제를 함께 전달한다.
3. LLM이 출력한 Markdown을 복사한다.
4. dc-code-paste에서 `Markdown` 버튼을 클릭한다.
5. 입력창에 Markdown을 붙여넣고 `Markdown 적용하기`를 클릭한다.
6. 편집기와 미리보기에 변환된 글이 표시된다.
7. 내용을 확인하거나 편집한 뒤 `디씨 복사`로 DCInside에 붙여넣는다.

`:::hero`, `:::summary`, `:::tip`, `:::warning` 같은 블록 태그와 코드블록은
반드시 `Markdown` 패널을 통해 적용해야 한다.
LLM 결과를 편집기에 직접 붙여넣는 방식으로는 블록 태그가 해석되지 않는다.

---

## 로컬 실행

```sh
bun install
bun run dev
```

---

## 주요 명령어

```sh
bun run check          # Svelte 타입 검사
bun run typecheck:go   # tsgo 네이티브 타입 검사
bun run lint           # Oxlint
bun run format:check   # Oxfmt
bun run test           # Vitest 단위 테스트
bun run test:e2e       # Playwright E2E 테스트
bun run build          # 정적 빌드
```

---

## DCInside 붙여넣기 주의사항

릴리스 전 아래 항목을 브라우저에서 직접 확인한다.

1. 기본 샘플 아티클(단락, 제목, 팁박스, 경고박스, 참조박스, 링크박스, 인용, 목록, 구분선, 코드블록 포함)로 시작한다.
2. `디씨 복사` → DCInside 일반 에디터에 붙여넣기 → 스타일 유지 확인.
3. 미리보기 패널을 `HTML`로 전환 → `원문 복사` → DCInside HTML 모드에 붙여넣기 → HTML 모드 해제 후 동일하게 렌더링되는지 확인.
4. 코드 색상, 박스 여백, 링크, 본문 폰트 크기가 미리보기와 충분히 일치하는지 확인.
5. 텍스트 편집 후 새로고침 → 초안이 복원되는지 확인.
6. `초기화` → 새로고침 → 빈 아티클이 오는지 확인.
7. `DC 테이블` 모드에서 내보낸 HTML에 `table`, `td`, `bgcolor` 속성이 있는지 확인.
