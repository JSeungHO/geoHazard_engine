# 세션 인계 문서

> 작성일: 2026-05-24  
> 목적: 다음 세션에서 현재 맥락 없이 작업을 이어받기 위한 요약

---

## 1. 프로젝트 한줄 요약

**GeoHazard Engine** — 홍수·쓰나미·지진 교육용 재난 시뮬레이션 (Cesium.js + React + Vite).  
배포: [geohazard-engine.vercel.app](https://geohazard-engine.vercel.app) | 브랜치: `dev` (개발) → `main` (배포)

---

## 2. 현재 모듈 상태

| 모듈 | 상태 | 비고 |
|------|------|------|
| 홍수·침수 (`FloodModule`) | ✅ 완성 | WaterWaveEngine + terrain grid 클램핑 |
| 쓰나미 (`TsunamiModule`) | 🟡 Phase 2 진행 중 | run-up wedge 튜닝 중 |
| 지진 (`EarthquakeModule`) | ✅ Phase 1~3 완료 | MMI overlay, 피해 통계, OSM 건물 손상 — QA §13 대기 |

---

## 3. 이번 세션에서 한 것

### 3.1 버그 수정

**해양 침수 렌더링 버그** (`FloodVisualization.jsx`)

- **증상**: 쓰나미 시작 시 카메라가 400km+ 광역 조망으로 이동하면 `addViewFloodBoundsListener`가 해양 전체를 침수 범위로 계산 → 바다 위에 침수 mesh 생성
- **수정**: `FloodVisualization`에 `fixedBounds = null` prop 추가. 제공 시 카메라 리스너 생략, 해당 범위 고정 사용
- **관련 파일**: `src/modules/flood/components/FloodVisualization.jsx` (수정), `src/modules/tsunami/TsunamiModule.jsx` (fixedBounds 전달)
- **현재 상태**: 수정 완료, 테스트 통과

### 3.2 문서 작성

| 문서 | 내용 |
|------|------|
| `docs/coastal-surge-plan.md` | GeoServer vs 셰이더 방식 비교 기획 |
| `docs/coastal-surge-shader-plan.md` | 셰이더 방식 상세 설계 (5단계 구현 계획) |

### 3.3 문서 갱신

- `docs/goals.md` — 프로젝트 방향 전환 반영 (강남 중심 → 재난별 위치 분리), 쓰나미 Phase 1 완료 상태 갱신
- `docs/features.md` — 테스트 수 26→35개 (7파일) 수정, 쓰나미 모듈 섹션 추가, 파일 구조 갱신
- `docs/README.md` — 새 기획 문서 2개 링크 추가
- `docs/tsunami-phase1.md` — 사용자가 직접 수정 (Phase 2 반영, 방향 전환 이력 정리)

### 3.4 테스트 결과

```
Tests  35 passed (35)  —  7 files
```

---

## 4. 다음에 해야 할 것 (우선순위 순)

### 🔴 최우선 — 브라우저 QA (미완료)

dev 서버(`http://localhost:5173`)에서 쓰나미 탭 QA가 **아직 진행되지 않았다.**  
아래 체크리스트를 먼저 확인하고, 이상 항목을 기록한 뒤 셰이더 작업에 착수할 것.

```
[ ] 시작 → ring 진원에서 확장, 진원 화면 중앙
[ ] ring 확장 중 shockwave 펄스 애니메이션
[ ] 포항 등 연안 도달 → 마커 색 변경 + 파고 라벨
[ ] run-up wedge가 바다에서 시작해 육지 방향으로 확장
[ ] 피해 범위 패널 숫자 갱신
[ ] wedge가 단색 평면으로 보임 (셰이더 미적용 현재 상태 확인용)
[ ] 일시정지 / 재개 / 초기화 정상 동작
[ ] 스크러빙 슬라이더 → ring·wedge 즉시 반영
[ ] 홍수 탭 전환 후 쓰나미 탭 재진입 → 잔여 객체 없음
[ ] 서해 프리셋 → 서해안 도시 도달 확인
[ ] 지도에서 선택 → 클릭 진원 이동 확인
```

### 🟡 다음 — 셰이더 구현 (coastal-surge-shader-plan.md)

기획서: `docs/coastal-surge-shader-plan.md`

구현 5단계:

| Step | 파일 | 내용 |
|------|------|------|
| 1 | `src/utils/floodWaterMaterial.js` | `TsunamiSurgeMaterial` Fabric 셰이더 등록 |
| 2 | `src/modules/tsunami/utils/tsunamiRunupSites.js` | `buildSurgeFan` 반환값에 `surgeMask` 추가 |
| 3 | `src/modules/tsunami/utils/tsunamiRunupPrimitives.js` | `PerInstanceColorAppearance` → `MaterialAppearance` 교체 |
| 4 | `src/modules/tsunami/constants/coastalImpactPoints.js` | 포항·강릉·울산 shorePoint 수동 보정 |
| 5 | — | 브라우저 QA — foamWidth / depthFade / feather 튜닝 |

셰이더 핵심 로직 3개:
1. **마스크** — `seaUV → inlandUV` 방향 축으로 surge 범위 내 fragment만 표시
2. **깊이 그라디언트** — 바다 쪽 짙고 불투명, 육지 front 쪽으로 투명
3. **foam 라인** — front 경계 흰색 띠가 progress와 함께 전진

### 🔵 이후

- Git 커밋 (`tsunami-status.md §8` 참고 — 전체 쓰나미 모듈 미커밋 상태)
- Phase 3a: OSM 건물 침수 shader (Classification)
- 지진 모듈 착수

---

## 5. 핵심 파일 지도

```
src/
├── modules/
│   ├── flood/components/FloodVisualization.jsx  ← fixedBounds prop 추가됨 (이번 세션)
│   └── tsunami/
│       ├── TsunamiModule.jsx                    ← 대폭 리팩터 (연안 중심, 카메라 개선)
│       ├── components/TsunamiVisualization.jsx  ← ring + 연안마커 + run-up sync
│       ├── components/TsunamiMainUI.jsx         ← 피해 범위 패널, ScrubBar
│       ├── constants/coastalImpactPoints.js     ← 연안 11곳 + getImpactPointsForEpicenter
│       ├── constants/coastalSurgeLayout.js      ← 해안선 방향 벡터, surgeMask UV 계산
│       ├── constants/tsunamiPresets.js          ← DEFAULT_TSUNAMI_OPTIONS, EPICENTER_PRESETS
│       └── utils/
│           ├── tsunamiRunupSites.js             ← buildSurgeFan (셰이더 Step 2 대상)
│           └── tsunamiRunupPrimitives.js        ← TsunamiRunupPrimitiveLayer (셰이더 Step 3 대상)
├── physics/TsunamiWaveModel.js                 ← 순수 JS 결정론 모델 (35 테스트 통과)
└── utils/floodWaterMaterial.js                 ← 셰이더 Step 1 대상 (TsunamiSurgeMaterial 추가)
```

---

## 6. 알려진 이슈 (미해결)

| # | 증상 | 위치 | 우선순위 |
|---|------|------|----------|
| 1 | wedge가 단색 평면 — 바다→육지 방향감 없음 | `tsunamiRunupPrimitives.js` | 🔴 셰이더 Step 1~3 |
| 2 | shorePoint가 도시 중심 고정 오프셋 — 실제 해안선과 어긋날 수 있음 | `coastalImpactPoints.js` | 🟡 셰이더 Step 4 |
| 3 | 바다 구간 run-up overlay 가시성 낮음 (`GroundPrimitive`는 지형 드레이핑) | `tsunamiRunupPrimitives.js` | 🟡 셰이더 후 검토 |
| 4 | Git 미커밋 — 쓰나미 모듈 전체 untracked | — | 🟡 QA 완료 후 |

---

## 7. 관련 문서 빠른 참조

| 문서 | 용도 |
|------|------|
| [tsunami-status.md](./tsunami-status.md) | **현재 상태** — 구현 현황, 이슈, Git 상태 |
| [tsunami-phase1.md](./tsunami-phase1.md) | 설계 원칙, API, 컴포넌트 구조, 하지 말아야 할 것 |
| [coastal-surge-shader-plan.md](./coastal-surge-shader-plan.md) | **다음 작업** — 셰이더 5단계 상세 기획 |
| [coastal-surge-plan.md](./coastal-surge-plan.md) | GeoServer vs 셰이더 방식 선택 근거 |
| [features.md](./features.md) | 전체 파일 구조, 테스트 현황 |
| [goals.md](./goals.md) | 로드맵, Phase 계획 |

---

## 8. 로컬 실행

```bash
npm install
cp .env.example .env      # VITE_CESIUM_TOKEN 설정
npm run dev               # http://localhost:5173
npx vitest run            # 단위 테스트 (35/35 통과 확인)
npm run build             # 프로덕션 빌드 확인
```

---

## 9. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-24 | 초판 — 세션 인계용 문서 |
