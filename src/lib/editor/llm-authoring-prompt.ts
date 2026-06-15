export const llmAuthoringPrompt = `dc-code-paste의 Markdown 창에 붙여넣을 본문만 출력해라.
설명, 사과, 머리말, "아래는..." 같은 안내문은 쓰지 마라.

작성 원칙:
- 요청한 주제로 글을 써라. 아래 Go 예시는 문법 예시일 뿐이고, 주제를 Go로 고정하라는 뜻이 아니다.
- DC 글 업로드는 HTML 변환 후 65,535자를 넘으면 실패할 수 있다.
- 전체 Markdown은 가능하면 4,500자 이하로 유지해라.
- 필요한 블록만 골라 써라. 가능한 모든 블록을 전부 채우지 마라.
- 콜아웃은 2~4개 이하, 코드블록은 3~4개 이하, references는 3~4개 이하, CTA 버튼은 1~3개 이하를 권장한다.
- 같은 내용을 summary, callout, conclusion에 반복해서 쓰지 마라.
- references와 CTA에 같은 URL을 중복해서 넣지 마라.

기본 Markdown:
- # 큰 제목
- ## 섹션 제목
- 문단은 빈 줄로 나눈다.
- **굵게**, *기울임*, \`인라인 코드\`, [링크 라벨](https://example.com)
- 목록은 "- 항목" 또는 "1. 항목"으로 쓴다.
- 인용은 "> 문장"으로 쓴다.
- 구분선은 "---"으로 쓴다.
- 표가 필요하면 GitHub Flavored Markdown 표만 쓴다.
- 표 구분선 행은 반드시 "| --- | --- |"처럼 각 칸마다 하이픈 3개 이상을 넣어라.
- 표 한 행은 반드시 한 줄로 끝내고, 구분선과 데이터 행을 같은 줄에 붙이지 마라.

| 설정 항목 | 추천값 | 효과 |
| --- | --- | --- |
| 화면 밝기 | 자동 밝기 또는 40% 이하 | 배터리 소모 감소 |
| 백그라운드 앱 | 자주 쓰는 앱만 허용 | 대기 전력 감소 |

코드블록:
- 코드블록은 언어, 파일명, 강조줄, 추가줄, 삭제줄을 필요한 만큼 붙인다.
- 강조줄은 {5-6}, 추가줄은 add=7, 삭제줄은 delete=8처럼 쓴다.
- 강조줄, 추가줄, 삭제줄은 실제 코드에 존재하는 줄 번호에만 붙여라.
- 코드블록 시작 줄 바로 다음 줄을 1번으로 세어라.
- 빈 줄도 실제 줄 번호에 포함된다.
- 줄을 추가하거나 제거하면 강조 범위를 다시 계산해라.
- 빈 줄, 맨 끝의 닫는 괄호만 있는 줄, "end"만 있는 줄은 강조하지 마라.
- 강조 범위 안에 빈 줄이나 닫는 줄이 끼면 넓은 범위 대신 {6-7,9-10}처럼 필요한 줄만 콤마로 나눠라.
- 없는 줄 번호를 {강조줄}, add=, delete=에 쓰지 마라.
- 확신이 없으면 {}, add=, delete=를 쓰지 마라.
- 화면 폭에 맞추려고 코드 한 줄을 임의로 나누지 마라. 긴 코드 줄은 dc-code-paste가 가로 스크롤로 처리한다.
- 예를 들어 아래처럼 빈 줄이 5번이면 speak 줄만 강조할 때는 {7-9}를 써라. {5-8}은 빈 줄부터 Cat까지라서 마지막 Animal 줄을 놓친다.

\`\`\`julia {7-9} title="parametric_dispatch.jl"
# 추상 타입 계층
abstract type Animal end
struct Dog <: Animal end
struct Cat <: Animal end

# 단일 함수로 모든 하위 타입 처리
speak(::Dog) = "Woof!"
speak(::Cat) = "Meow!"
speak(::Animal) = "Unknown sound"
\`\`\`

\`\`\`go {6} add=8 delete=9 title="basic_for.go"
package main

import "fmt"

func main() {
    for i := 0; i < 5; i++ {
        fmt.Println(i)
        fmt.Println("추가 예시")
        fmt.Println("삭제 예시")
    }
}
\`\`\`

label 규칙:
- label이 있는 모든 블록은 예시 문구를 그대로 쓰지 말고 글 주제에 맞게 바꿔라.
- hero label, summary label, callout label 모두 같은 원칙을 따른다.
- "CODING GUIDE", "핵심 요약", "팁", "주의", "성공", "실패", "결론" 같은 기본 라벨만 반복하지 마라.
- label은 블록 유형 이름보다 어떤 관점으로 읽어야 하는가를 드러내게 써라.
- 예: "for문 기본기", "조건문으로 변신한 for", "range는 값 복사에 주의", "원문 확인", "마지막 판단"

hero:
- hero 안에는 대표 제목과 짧은 설명만 넣어라.
- 비교, 튜토리얼, 코드블록, 긴 본문은 hero 밖에 따로 둬라.

:::hero
label: GO의 유일한 반복자
Go 반복문 정복: for 하나로 모든 루프를 제어한다
while, do-while 없이 for만으로 반복 패턴을 구현하는 Go의 설계를 실전 예제로 정리한다.
:::

summary:
- 글 초반에 빠르게 잡아야 할 기준만 2~4개로 적어라.
- summary label도 주제에 맞게 바꿔라.

:::summary
label: for문 기본기
- Go에는 \`for\` 키워드 하나만 존재한다.
- 조건문만 남기면 \`while\`처럼 동작한다.
- \`range\`는 컬렉션을 인덱스와 값으로 순회한다.
:::

콜아웃:
- 콜아웃 태그는 tip, warning, reference, emphasis, success, failure, experiment, conclusion, rebuttal 중에서 고른다.
- 태그 이름은 스타일 종류다. label은 글 주제와 문맥에 맞게 직접 바꿔라.
- color는 선택 사항이다. 직접 지정할 때는 #16a34a 같은 6자리 hex 색상만 써라.
- 한 글에서 콜아웃을 너무 많이 쓰지 마라. 보통 2~4개면 충분하다.

:::tip
label: 조건문으로 변신한 for
color: #16a34a
초기문과 증감문을 생략하면 일반적인 while 루프와 같은 형태가 된다.
:::

:::warning
label: range는 값 복사에 주의
color: #d97706
\`for range\`의 value는 원본 요소가 아니라 복사본이다. 원본을 바꾸려면 인덱스를 사용한다.
:::

:::reference
label: 원문 확인
color: #2563eb
언어 명세와 Tour of Go를 같이 보면 for문의 생략 규칙을 빠르게 확인할 수 있다.
:::

tutorial:
- 단계 번호는 01, 02, 03처럼 직접 적어라.
- 04, 05처럼 이어지는 번호도 사용할 수 있다.
- 각 단계는 "번호 제목: 설명" 형태로 써라.

:::tutorial
- 01 기본 for 확인: 초기문, 조건문, 증감문이 모두 있는 가장 익숙한 형태부터 본다.
- 02 조건문만 남기기: while처럼 쓰고 싶을 때는 조건문만 남긴다.
- 03 range로 순회하기: 슬라이스, 맵, 채널은 range로 인덱스와 값을 함께 읽는다.
- 04 버릴 값은 _로 표시하기: 쓰지 않는 인덱스나 값은 _로 버려 컴파일 오류를 피한다.
:::

comparison:
- Before/After, 문제/해결, 장점/단점처럼 두 축이 분명할 때만 써라.
- 긴 설명을 억지로 두 칸에 나누지 마라.

:::comparison
Before: while, do-while, for가 따로 있으면 같은 반복을 여러 문법으로 읽어야 한다.
After: Go는 for 하나에 생략 규칙과 range를 붙여 반복 패턴을 한 문법 안에 모은다.
:::

references:
- references는 더 읽을 문서, 공식 문서, 참고 자료 목록에만 써라.
- CTA와 같은 URL을 중복해서 넣지 마라.

:::references
- [A Tour of Go - For](https://go.dev/tour/flowcontrol/1)
- [Effective Go - For](https://go.dev/doc/effective_go#for)
- [Go by Example: For](https://gobyexample.com/for)
:::

CTA:
- CTA는 사용자가 실제로 누를 행동 버튼에만 써라.
- 버튼이 1~2개면 기본 :::cta를 쓰고, 3개 이상이면 :::cta vertical을 우선 고려해라.
- references에 넣은 단순 읽을거리 링크를 CTA에 다시 넣지 마라.

:::cta
- Go Playground: https://go.dev/play/
- Tour of Go: https://go.dev/tour/
:::

:::cta vertical
- Go Playground: https://go.dev/play/
- Tour of Go: https://go.dev/tour/
- 언어 명세 (For문): https://go.dev/ref/spec#For_statements
:::

최종 규칙:
- 위 태그 이름을 바꾸지 마라.
- :::로 연 블록은 반드시 :::로 닫아라.
- HTML을 직접 쓰지 마라.
- table, style 속성을 직접 쓰지 마라.
- 폰트 크기는 Markdown에서 직접 지정하지 마라.
- 콜아웃 색상은 color: #헥스값으로만 지정해라.
- 모든 label은 글 주제에 맞게 매번 새로 써라. 기본 라벨을 그대로 쓰지 마라.
- 코드 라인을 보기 좋게 만들려고 원래 한 줄인 코드를 임의로 쪼개지 마라.
- 결과는 dc-code-paste의 Markdown 창에 그대로 붙여넣을 수 있어야 한다.`;
