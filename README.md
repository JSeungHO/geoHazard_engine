# GeoHazard Engine

강남역(37.4975, 127.0267)을 기준으로 **홍수·강수·쓰나미** 재난 시뮬레이션을 Cesium 3D 지도 위에서 체험하는 React + Vite 앱입니다.

**Production**: [geohazard-engine.vercel.app](https://geohazard-engine.vercel.app)

## 문서

| 문서 | 설명 |
|------|------|
| [docs/design.md](./docs/design.md) | UI 레이아웃, 컬러, 레이어 패널 |
| [docs/features.md](./docs/features.md) | 구현된 기능, view bounds, 강수·범람 아키텍처 |
| [docs/goals.md](./docs/goals.md) | 프로젝트 목표, 로드맵, 배포, 쓰나미·지진 설계 |
| [docs/evaluation.md](./docs/evaluation.md) | 기획·QA 평가, 버그/UX/아키텍처 이슈, QA 체크리스트 |
| [docs/README.md](./docs/README.md) | 문서 목차·읽는 순서 |
| [docs/perf-phase2.md](./docs/perf-phase2.md) | 성능 2차 기획 (P-1~P-5) |
| [docs/ux-implementation.md](./docs/ux-implementation.md) | U-4~U-8 UX 구현 결과 |
| [docs/tsunami-phase1.md](./docs/tsunami-phase1.md) | 쓰나미 Phase 1 기획·구현 |

## 기술 스택

- React 19 + Vite
- [Cesium](https://cesium.com/) / [Resium](https://resium.reearth.io/)
- `vite-plugin-cesium` (Production Workers/WASM 번들)

## 빠른 시작

```bash
npm install
cp .env.example .env   # VITE_CESIUM_TOKEN 입력
npm run dev
```

[Cesium Ion](https://ion.cesium.com/)에서 토큰을 발급받아 `.env`에 설정합니다.

| 스크립트 | 설명 |
|----------|------|
| `npm run dev` | 개발 서버 (localhost:5173) |
| `npm run build` | Production 빌드 |
| `npm run preview` | 빌드 결과 미리보기 |
| `npm run lint` | ESLint |
| `npm test` | Vitest 단위 테스트 |

## 주요 기능

- **홍수** — terrain grid + 저지대 기준 수면, 2D 파동, 하늘 반사 셰이더
- **쓰나미** — 진원 ring 확산, 타임라인·스크러빙, 강남역 침수 연출
- **강수** — ParticleSystem, 강수량 → 수위 자동 상승
- **pitch view bounds** — 카메라 각도에 맞춰 침수·강수 범위 조절
- **OSM 건물** — 우측 레이어 패널 토글

## 프로젝트 구조 (요약)

```
src/
├── App.jsx                         # 모듈 라우터 (ModuleShell)
├── components/                     # 공용 UI (Cesium, 레이어, ModuleShell)
├── locations/gangnam.js            # 좌표·카메라·bounds·flyTo 통합
├── modules/
│   ├── registry.js                 # 재난 모듈 등록
│   ├── flood/                      # 홍수·강수 모듈
│   └── tsunami/                    # 쓰나미 Phase 1
├── utils/                          # floodViewBounds, terrainHeight, …
└── physics/                        # WaterWaveEngine, TsunamiWaveModel
```

## 배포

- `main` → Vercel Production
- `dev` → Vercel Preview
- 환경 변수: `VITE_CESIUM_TOKEN`

상세 워크플로: [docs/goals.md](./docs/goals.md#배포브랜치)
