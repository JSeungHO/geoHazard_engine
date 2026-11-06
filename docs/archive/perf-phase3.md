# GeoHazard Engine — 홍수 모듈 성능 3차 기획서

> 작성일: 2026-05-24  
> 대상 브랜치: `dev`  
> 상태: **기획 중** (P-1~P-5 구현 완료 후속)  
> 참조: [perf-phase2.md](./perf-phase2.md) (완료), [features.md](./features.md)

---

## 0. 배경 · 목표

P-1~P-5(성능 2차)로 다음이 완료되었다.

| 완료 | 내용 |
|------|------|
| P-1 | `positionBuffer` Float64Array 재사용 (74KB/frame 할당 제거) |
| P-2 | Body 재생성 이중 게이트 (0.3m + 400ms) |
| P-3 | FPS 적응형 surface skip (>22ms) |
| P-4 | Body 상단 캡 삼각형 제거 (`omitTopCap`) |
| P-5 | Wave energy 기반 surface 동적 주기 (2~6프레임) |

**2차 이후에도 남아있는 병목과 시각 품질 문제** 가 이번 기획의 대상이다.

---

## 1. 현재 잔여 병목 분석

### 1.1 Body geometry — 동적 JS 배열 할당 (매 재생성 시)

```js
// buildFloodBodyGeometry 내부
const positions = []   // ← 동적 배열, push() 시 메모리 증가
const indices = []     // ← 동적 배열

pushVertex(lon, lat, height) {
  positions.push(c.x, c.y, c.z)  // ← 3개씩 push
}
// ...
const positionArray = new Float64Array(positions)   // ← 복사 후 원배열 GC
const indicesArray  = new Uint32Array(indices)      // ← 동일
```

- **재생성 빈도**: 수위 0.3m + 400ms 조건 → 활성 시뮬레이션에서 **약 2.5회/초**
- **최대 크기** (고정값):
  - 정점: `28 × 28 × 8 × 3 = 18,816` Float64 (≈ 147 KB)
  - 인덱스: `28 × 28 × 10 × 3 = 23,520` Uint32 (≈ 92 KB)
- **문제**: 매 재생성마다 JS 힙에 ~239 KB 할당 → 변환 후 즉시 GC 대상

### 1.2 `addDisturbance` — 전체 grid 순회

```js
// WaterWaveEngine.addDisturbance
for (let y = 0; y < res; y++) {
  for (let x = 0; x < res; x++) {
    // res=56 → 3,136번 순회 (무조건)
    if (d2 > r2) continue  // ← 대부분 여기서 skip
  }
}
```

호출 경로별 반경:
| 호출 위치 | radiusNorm | 실제 반경 (cells) | 유효 면적 | 전체 대비 |
|-----------|------------|-------------------|-----------|-----------|
| 강수 rain drop | 0.035 | ~2 cells | ~12 cells | **0.4%** |
| 수위 변화 disturbance | 0.32 | ~18 cells | ~1,017 cells | ~32% |
| 초기화 disturbance | 0.28 | ~16 cells | ~804 cells | ~26% |

- **강수 drops**: 5프레임마다 최대 4회 호출, 각 3,136순회 → 실제 갱신 12셀
- **낭비율**: 강수 기준 **99.6%** 반복이 `continue` 후 종료

### 1.3 Surface Primitive 래퍼 객체 churn

```js
// syncSurfacePrimitive — 매 surface sync마다
new Geometry({...})           // ← JS 객체 할당
new GeometryInstance({...})   // ← JS 객체 할당
new Primitive({...})          // ← JS 객체 할당
new MaterialAppearance({...}) // ← JS 객체 할당
```

- positionBuffer 재사용(P-1)으로 **데이터** 할당은 없어졌지만, **래퍼 4개**는 매 sync마다 생성
- 10Hz 기준 40개/초 → 60Hz 기준 최대 120개/초 (에너지 높을 때)
- Cesium 공개 API 제약 — **직접 해결 불가** (§2 참고)

### 1.4 `globe.getHeight` — 건물 높이 미반영

```js
// sampleTerrainHeightGrid / sampleTerrainHeightGridAsync
const sampled = globe.getHeight(carto)  // ← DEM(지형) 높이만, 건물 없음
```

- OSM 건물(3D Tiles)은 지형 위에 별도 렌더링 → `globe.getHeight` 반환값에 포함되지 않음
- 결과: **건물 내부로 홍수 mesh가 관통** — 건물이 물에 잠기지 않고 물이 건물을 통과
- 가장 눈에 띄는 시각 결함 (데모 품질 저하)

### 1.5 WaterWaveEngine — 메인 스레드 점유

```js
// viewer.scene.postUpdate (60fps, 메인 스레드)
sim.engine.step(deltaSeconds)
// → 56×56 grid × 2 pass (acceleration + velocity/height) = 6,272 산술 연산/frame
```

- postUpdate가 Cesium 렌더 루프 내에서 실행되므로 step()이 길어지면 **렌더 드롭** 발생
- 저사양 기기(CPU throttle 4x~6x)에서 병목 가능
- WebWorker 이전 시 구조 변경 필요

---

## 2. 기술 제약 재확인

| 방식 | 가능 여부 | 비고 |
|------|-----------|------|
| Primitive vertex buffer 직접 업데이트 | ❌ | Cesium private API — 금지 |
| Geometry/Primitive 래퍼 재사용 | ❌ | Cesium 생성 후 immutable |
| `scene.sampleHeightMostDetailed` | ✅ | 비동기, 건물 포함 높이 샘플 (Cesium 1.96+) |
| WebWorker + SharedArrayBuffer | ✅* | COOP/COEP 헤더 필요 (`vite.config.js` 서버 설정) |
| WebWorker + postMessage transfer | ✅ | SharedArrayBuffer 없이도 가능 (1프레임 지연) |

---

## 3. 개선 계획

### P3-1. Body geometry 선형 버퍼 (pre-allocated typed array)

**현재 문제**: 동적 JS 배열 → typed array 변환 시 매 재생성 ~240 KB 할당·폐기

**개선**: 모듈 레벨 정적 버퍼 + write cursor 방식

```js
// floodWaterMesh.js — 모듈 레벨 (한 번만 할당)
const MAX_BODY_CELLS  = 28 * 28              // 784
const MAX_BODY_VERTS  = MAX_BODY_CELLS * 8   // 6,272
const MAX_BODY_TRIS   = MAX_BODY_CELLS * 10  // 7,840
const _bodyPositions = new Float64Array(MAX_BODY_VERTS * 3)   // ~147 KB
const _bodyIndices   = new Uint32Array(MAX_BODY_TRIS * 3)     // ~92 KB

export function buildFloodBodyGeometry(bounds, terrainGrid, floodDepth, options = {}) {
  let vertCursor = 0
  let idxCursor  = 0

  const pushVertex = (lon, lat, height) => {
    const c = cartesianFromLonLatHeight(lon, lat, height, vertexScratch)
    const pi = vertCursor * 3
    _bodyPositions[pi]     = c.x
    _bodyPositions[pi + 1] = c.y
    _bodyPositions[pi + 2] = c.z
    return vertCursor++
  }

  const pushTriangle = (a, b, c) => {
    _bodyIndices[idxCursor++] = a
    _bodyIndices[idxCursor++] = b
    _bodyIndices[idxCursor++] = c
  }

  // ... 기존 루프 동일 ...

  // 슬라이스만 사용 (복사 없음 — subarray는 같은 버퍼 참조)
  const positions = _bodyPositions.subarray(0, vertCursor * 3)
  const indices   = _bodyIndices.subarray(0, idxCursor)

  // Geometry에는 slice()로 복사 전달 (Cesium이 소유권 가져감)
  const positionsCopy = positions.slice()
  const indicesCopy   = indices.slice()
  ...
}
```

- **효과**: 동적 배열 할당 0, Float64Array `new` 0 (re-생성 시)
- **수정 파일**: `src/utils/floodWaterMesh.js`
- **주의**: `_bodyPositions.slice()` 한 번은 필요 — Cesium Geometry가 배열 소유권을 가져감

---

### P3-2. `addDisturbance` bounding box 최적화

**현재 문제**: 강수 drop 1개가 2셀 반경인데 3,136셀 전체 순회

**개선**: 반경으로 대상 셀 범위 제한

```js
// WaterWaveEngine.js — addDisturbance
addDisturbance(u, v, radiusNorm, magnitude) {
  const res = this.resolution
  const cx = u * (res - 1)
  const cy = v * (res - 1)
  const r = Math.max(1, radiusNorm * res)
  const r2 = r * r

  // 🆕 bounding box로 순회 범위 제한
  const xMin = Math.max(0,       Math.floor(cx - r))
  const xMax = Math.min(res - 1, Math.ceil(cx  + r))
  const yMin = Math.max(0,       Math.floor(cy - r))
  const yMax = Math.min(res - 1, Math.ceil(cy  + r))

  for (let y = yMin; y <= yMax; y++) {
    for (let x = xMin; x <= xMax; x++) {
      const dx = x - cx
      const dy = y - cy
      const d2 = dx * dx + dy * dy
      if (d2 > r2) continue
      const falloff = 1 - Math.sqrt(d2) / r
      const i = y * res + x
      this.heights[i]    += magnitude * falloff
      this.velocities[i] += magnitude * falloff * 0.12
    }
  }
}
```

순회 셀 수 비교:

| 호출 위치 | radiusNorm | 현재 (전체) | 개선 후 (bbox) | 감소율 |
|-----------|------------|------------|----------------|--------|
| 강수 rain drop | 0.035 | 3,136 | ~25 | **99.2%↓** |
| 수위 disturbance | 0.32 | 3,136 | ~1,296 | 59%↓ |
| 초기 disturbance | 0.28 | 3,136 | ~1,024 | 67%↓ |

- **효과**: 강수 최대 시 `addRainImpacts` 비용 ~100x 감소
- **수정 파일**: `src/physics/WaterWaveEngine.js`
- **위험도**: 🟢 낮음 — 수치 동일, 순회 범위만 축소

---

### P3-3. `scene.sampleHeightMostDetailed` — 건물 높이 통합

**현재 문제**: `globe.getHeight`는 지형 DEM만 반환 → 건물이 홍수 mesh를 관통

**개선**: 비동기 지형 정밀화(`refineTerrainHeightGrid`) 시 `scene.sampleHeightMostDetailed`로 대체 → 건물 포함 높이

```js
// terrainHeight.js — refineTerrainHeightGrid 대체
export async function refineTerrainWithBuildings(viewer, bounds, resolution) {
  if (!viewer || viewer.isDestroyed?.()) return null
  if (!viewer.scene.sampleHeightSupported) {
    // fallback: 기존 sampleTerrainMostDetailed
    return refineTerrainHeightGrid(viewer, bounds, resolution)
  }

  const cartographics = []
  for (let j = 0; j < resolution; j++) {
    for (let i = 0; i < resolution; i++) {
      const u = i / (resolution - 1)
      const v = j / (resolution - 1)
      const { lon, lat } = lonLatFromUV(bounds, u, v)
      cartographics.push(Cartographic.fromDegrees(lon, lat))
    }
  }

  try {
    // terrain + 3D Tiles(건물) 포함 높이 샘플
    const sampled = await viewer.scene.sampleHeightMostDetailed(
      cartographics,
      []           // 제외 객체 없음 (건물 포함)
    )

    const heights = new Float32Array(resolution * resolution)
    for (let i = 0; i < sampled.length; i++) {
      const h = sampled[i]?.height
      heights[i] = Number.isFinite(h) ? h : NaN
    }

    const stats = gridStats(heights)
    if (stats.validCount === 0) return null
    return { heights, resolution, ...stats }
  } catch {
    // fallback
    return refineTerrainHeightGrid(viewer, bounds, resolution)
  }
}
```

`FloodVisualization.jsx` 변경:

```js
// startSimulation 내부
// requestFullTerrainSample / requestTerrainRefine 중 정밀화 단계에서 교체
refineTerrainWithBuildings(viewer, sim.bounds, WAVE_RESOLUTION)
```

**시각 효과**:

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| 건물 내부 mesh | 관통 (건물 안에 물) | 건물 높이 이하에서 clip |
| 건물 옥상 높이 | DEM 기준 (지표면) | 실제 건물 높이 |
| 강남역 침수 | 건물이 수면 위에 붕뜨는 느낌 | 건물 1층부터 침수 |

- **수정 파일**: `src/utils/terrainHeight.js` (함수 추가), `src/modules/flood/components/FloodVisualization.jsx` (호출 교체)
- **위험도**: 🟡 중간 — `scene.sampleHeightMostDetailed` API 확인 필요 (Cesium 1.96+)
- **주의**: OSM 건물 레이어가 로드된 이후에야 정확한 값 반환. 초기 빠른 샘플(16×16)은 기존 `globe.getHeight` 유지.

---

### P3-4. WaterWaveEngine WebWorker 분리

**현재 문제**: wave physics(56×56 × 2pass)가 메인 스레드 postUpdate 내에서 실행 → 렌더 드롭 원인

**개선**: WebWorker로 분리, SharedArrayBuffer로 heights 공유

#### 방식 A: SharedArrayBuffer (선호)

```
[메인 스레드]                         [Worker]
  postUpdate 마다                        loop {
    → 커맨드: sharedBuffer에 rain/disturbance 파라미터 쓰기           step(deltaSeconds)
    → heights 배열을 직접 읽어 렌더링       addDisturbances from queue
  }                                    }
```

- `heights = new Float32Array(new SharedArrayBuffer(56*56*4))`
- Worker가 매 프레임 heights 업데이트 → 메인이 비동기로 읽음
- 1프레임 지연 있지만 물리 완전 분리

**요구 사항**: Vite 개발 서버 + Vercel에 `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` 헤더 설정 필요

```js
// vite.config.js
server: {
  headers: {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
  }
}
```

```
// vercel.json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
      ]
    }
  ]
}
```

#### 방식 B: Transfer + 1프레임 지연 (헤더 불필요)

```js
// 매 프레임: Worker에 heights ArrayBuffer 전송 (zero-copy)
worker.postMessage({ type: 'step', heights: sim.engine.heights.buffer }, [sim.engine.heights.buffer])
// Worker: step() 후 다시 전송
worker.onmessage = ({ data }) => {
  sim.engine.heights = new Float32Array(data.heights)  // 소유권 복귀
}
```

- 장점: 헤더 설정 불필요
- 단점: 전송 중 heights 읽기 불가 → 1프레임 지연, 타이밍 복잡

**권장**: 방식 A (SharedArrayBuffer) — 헤더 설정은 단순하고, 지연 없음

- **효과**: 저사양 기기에서 메인 스레드 ~1ms/frame 해방 (60fps 기준 6% 여유)
- **수정 파일**: `src/physics/WaterWaveEngine.worker.js` (신규), `src/physics/WaterWaveEngine.js` (래퍼 추가), `vite.config.js`, `vercel.json`
- **위험도**: 🔴 높음 — 구조 변경, 디버깅 복잡

---

### P3-5. 저수위 시 Body 렌더링 생략

**현재 문제**: 수위가 낮을 때(≤ 1m) body geometry가 있어도 시각적 기여가 적음, 재생성 비용만 발생

**개선**: 수위 임계값 이하에서 body 완전 생략

```js
// FloodVisualization.jsx
const BODY_OMIT_BELOW_LEVEL = 1.0   // 1m 미만 body 생략

// startSimulation 또는 syncBodyForLevel에서
if (level < BODY_OMIT_BELOW_LEVEL) {
  removePrimitive(viewer, sim.body)
  sim.body = null
  return
}
```

- 시나리오 시작 시 수위가 0 → 서서히 증가: 초기 body 재생성 완전 제거
- 1m 이상에서만 body 표시 → 사용자 눈에 띄는 수위에서만 렌더
- **수정 파일**: `FloodVisualization.jsx` (상수 1개 + 조건 추가)
- **위험도**: 🟢 낮음

---

### P3-6. `getSurfaceUpdateInterval` 에너지 계산 최적화

**현재 코드**:
```js
const getSurfaceUpdateInterval = (engine) => {
  const heights = engine.heights
  let sumSq = 0
  for (let i = 0; i < heights.length; i++) sumSq += heights[i] * heights[i]
  const surfaceEnergy = sumSq / heights.length
  ...
}
```

- 56×56 = 3,136 원소 전체 합산 → 매 rAF frame (60fps)
- 에너지가 안정적일 때도 매 프레임 3,136번 연산

**개선**: 스트라이드 샘플링으로 4배 간소화

```js
const getSurfaceUpdateInterval = (engine) => {
  const heights = engine.heights
  const len = heights.length
  // 4개 중 1개 샘플 (stride=4) → ~784회 연산, 오차 무시 가능
  let sumSq = 0
  for (let i = 0; i < len; i += 4) sumSq += heights[i] * heights[i]
  const surfaceEnergy = (sumSq * 4) / len
  ...
}
```

- **효과**: 에너지 계산 비용 75% 감소 (3,136→784)
- **수정 파일**: `FloodVisualization.jsx`
- **위험도**: 🟢 낮음 — 통계 근사이므로 오차 허용

---

## 4. 개선 효과 예측

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| Body 재생성 시 JS 힙 할당 | ~240 KB × 2.5회/초 = 600 KB/s | **0 KB/s** (버퍼 재사용) |
| Rain drop 순회 셀 | 3,136/drop | **~25/drop** (99%↓) |
| 건물-홍수 mesh 관통 | 발생 | **제거** (P3-3) |
| 수위 1m 미만 body 재생성 | 발생 | **없음** (P3-5) |
| 에너지 계산 cost | 3,136 ops/frame | **784 ops/frame** (75%↓) |
| Wave physics 메인 스레드 | ~1ms/frame | **0ms** (P3-4, Worker 분리) |

---

## 5. 구현 우선순위

| 순서 | 항목 | 예상 소요 | 위험도 | 시각 영향 |
|------|------|-----------|--------|-----------|
| **1** | P3-2 `addDisturbance` bbox | 30분 | 🟢 낮음 | 없음 |
| **2** | P3-6 에너지 스트라이드 샘플 | 15분 | 🟢 낮음 | 없음 |
| **3** | P3-5 저수위 body 생략 | 30분 | 🟢 낮음 | 없음 |
| **4** | P3-1 body 선형 버퍼 | 1시간 | 🟡 중간 | 없음 |
| **5** | P3-3 건물 높이 통합 | 2~3시간 | 🟡 중간 | **⭐ 큼** |
| **6** | P3-4 WebWorker | 4~6시간 | 🔴 높음 | 없음 |

---

## 6. 수정 파일 목록

```
src/physics/WaterWaveEngine.js
  - addDisturbance: bounding box 범위 제한 (P3-2)
  (P3-4 선택) - Worker 래퍼 클래스 분리

src/utils/terrainHeight.js
  - refineTerrainWithBuildings() 신규 추가 (P3-3)

src/utils/floodWaterMesh.js
  - buildFloodBodyGeometry: 모듈 레벨 pre-allocated 버퍼 (P3-1)

src/modules/flood/components/FloodVisualization.jsx
  - getSurfaceUpdateInterval: 스트라이드 샘플 (P3-6)
  - BODY_OMIT_BELOW_LEVEL 상수 + 조건 (P3-5)
  - requestTerrainRefine → refineTerrainWithBuildings 교체 (P3-3)

(P3-4 선택)
src/physics/WaterWaveEngine.worker.js  ← 신규
vite.config.js                         ← COOP/COEP 헤더 추가
vercel.json                            ← COOP/COEP 헤더 추가
```

---

## 7. 테스트 포인트

```
[ ] P3-1: auto-rise 중 body 재생성 시 visual glitch 없음
[ ] P3-1: 초기화 후 정상 body 렌더 확인
[ ] P3-2: 강수 100% → 이전과 동일하게 파문 발생 (수치 동일)
[ ] P3-2: 수위 급변 시 disturbance 파동 정상
[ ] P3-3: OSM 건물 로드 후 건물 주변 flood mesh가 건물 바닥에서 clip 됨
[ ] P3-3: scene.sampleHeightSupported = false인 환경에서 fallback 동작
[ ] P3-5: 수위 0.5m → body 없음, 1.1m → body 표시 확인
[ ] P3-6: 강수·파동 활발한 상태에서 update interval이 2로 유지됨
```

---

## 8. 하지 말아야 할 것

| 시도 | 이유 |
|------|------|
| P3-1에서 `positions.subarray()` 를 Cesium에 직접 전달 | Cesium이 배열 소유권 가져감 → 다음 재생성 시 덮어써짐. 반드시 `.slice()` 복사 후 전달 |
| P3-3에서 초기 빠른 샘플(16×16)도 `sampleHeightMostDetailed`로 교체 | 비동기 + OSM 미로드 상태 → NaN 범람. 초기는 `globe.getHeight` 유지 |
| P3-4 Worker에서 Cesium 임포트 | Cesium은 DOM 의존 → Worker 환경 불가. WaveEngine 순수 JS만 Worker로 |
| `_bodyPositions`를 외부에서 유지 (반환 후 계속 보유) | 다음 `buildFloodBodyGeometry` 호출 시 덮어씀. Cesium Geometry 생성 직후 참조 폐기 |

---

## 관련 문서

- [성능 2차 기획서](./perf-phase2.md) — P-1~P-5 (완료)
- [구현 기능](./features.md) — FloodVisualization 구조
- [작업 목표](./goals.md) — 홍수 완성도 우선
