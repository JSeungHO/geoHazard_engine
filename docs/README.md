# GeoHazard Engine — 문서

| 문서 | 내용 |
|------|------|
| [구현 기능](./features.md) | 완성 체크리스트, 파일 구조, 아키텍처, 테스트 현황 |
| [작업 목표](./goals.md) | 완료 마일스톤, 로드맵, 배포, Cesium 가능 범위 |
| [디자인 가이드](./design.md) | UI 레이아웃, 컴포넌트 구성, 컬러 팔레트 |
| [기획·테스트 평가](./evaluation.md) | 버그·UX·아키텍처 전체 평가 + 완료 체크리스트 |
| [UX 개선 기획서](./ux-backlog.md) | U-4~U-8 기획 원본 (구현 완료) |
| [UX 구현 결과](./ux-implementation.md) | U-4~U-8 구현 내역·QA 체크리스트 |
| [성능 2차 기획서](./perf-phase2.md) | P-1~P-5 Surface/Body 최적화 기획 (완료) |
| [성능 3차 기획서](./perf-phase3.md) | P3-1~P3-6 잔여 병목·건물 통합·WebWorker |
| [쓰나미 Phase 1 기획서](./tsunami-phase1.md) | 연안 쓰나미 모듈 설계 (Phase 1~2, 방향 전환 반영) |
| [쓰나미 모듈 진행 현황](./tsunami-status.md) | **현재 구현 상태, 이슈, 로드맵 대비 진행률** |
| [연안 surge 시각화 기획](./coastal-surge-plan.md) | GeoServer vs 셰이더 방식 비교 — "바다→육지 물 유입" 구현 방향 |
| [연안 surge 셰이더 기획서](./coastal-surge-shader-plan.md) | 셰이더 방식 상세 설계 — uniform 목록, GLSL 로직, 구현 순서 5단계 |
| [지진 모듈 기획서](./earthquake-plan.md) | P파·S파 ring, 카메라 쉐이크, MMI 진도 overlay, Phase 1~4 로드맵 |
| [지진 모듈 UI 기획서](./earthquake-ui.md) | 사이드바 섹션·타임라인·스크러빙·CSS 클래스 명세 |

| [세션 인계 문서](./session-handoff.md) | **다음 세션 시작점** — 현재 상태·미완료 QA·다음 작업 요약 |

프로젝트 진입점: [루트 README](../README.md)

---

## 문서 읽는 순서

### 처음 합류하는 개발자

1. [구현 기능](./features.md) — 무엇이 동작하는지, 파일 구조
2. [디자인 가이드](./design.md) — UI 레이아웃·컴포넌트
3. [작업 목표](./goals.md) — 다음에 뭘 해야 하는지

### 성능 작업 참여

1. [성능 2차 기획서](./perf-phase2.md) — P-1~P-5 상세
2. [구현 기능 §렌더 루프](./features.md) — 현재 FloodVisualization 구조

### 쓰나미·지진 모듈 착수

1. [쓰나미 모듈 진행 현황](./tsunami-status.md) — **현재 상태·이슈·다음 작업**
2. [작업 목표 §쓰나미](./goals.md) — Phase 1~4 계획
3. [지진 모듈 기획서](./earthquake-plan.md) — **Phase 1 착수점**, P파·S파·쉐이크 설계
4. [구현 기능 §모듈 라우터](./features.md) — registry.js 확장 방법

### 이슈 추적

1. [기획·테스트 평가](./evaluation.md) — B/U/A 항목 완료 현황
