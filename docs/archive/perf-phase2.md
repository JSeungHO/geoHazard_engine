# GeoHazard Engine — 성능 2차 기획서

> 작성일: 2026-05-24  
> 작성자: 기획  
> 대상 브랜치: `dev`  
> 상태: **구현 완료** (P-1~P-5)  
> 참조: [evaluation.md](./evaluation.md) — B-2, [goals.md](./goals.md) — 성능 2차

---

## 1. 현재 상황 분석

### 병목 지점 2개

#### 🔴 Surface Primitive — 매 2프레임 풀 재생성

```
rAF 루프 → syncSurfacePrimitive()
  removePrimitive()                          ← GPU 해제
  buildWaterSurfaceGeometryFromCache()
    buildWaterSurfacePositionsFromCache()    ← Float64Array 74KB 새 할당
    new Geometry(...)                        ← JS 객체 할당
  new GeometryInstance(...)                  ← JS 객체 할당
  new Primitive(...)                         ← JS 객체 할당
  viewer.scene.primitives.add()              ← GPU 업로드
```

- **SURFACE_UPDATE_INTERVAL = 2** → 60fps 기준 초당 **30회** Primitive 생성·폐기
- 매 호출마다 **74KB (Float64Array)** + Geometry/GeometryInstance/Primitive 객체 3개 할당 → GC 압박
- 실측 비용: ~2.2MB/s GPU 업로드 + 반복 GC spike

#### 🟡 Body Primitive — 수위 변화마다 재생성

```
postUpdate → syncBodyForLevel()
  if (delta >= BODY_REBUILD_THRESHOLD 0.05m)
    buildFloodBodyGeometry()               ← 28×28 격자 × 8정점 × 12삼각형
      new Cartesian3 scratch × 6272번     ← 루프 내 메모리 할당 (B-3에서 1개로 줄임)
    GeometryPipeline.computeNormal()       ← CPU 연산
    new Primitive(...)                     ← GPU 업로드
```

- auto-rise 100% 기준 `0.24 m/s × 50ms = 0.012m/tick` → 0.05m 임계값 통과에 **5틱 = 250ms**
- 초당 **4회** body 재생성 (auto-rise 최대 시)
- body geometry는 수면 높이만 바뀌고 **지형 바닥면은 불변** — 현재는 전체를 매번 재계산

---

## 2. 기술 제약 확인 (Cesium 공개 API 범위)

Cesium의 `Primitive` 클래스는 **생성 후 vertex buffer 직접 업데이트 API가 없다.**

| 방식 | 가능 여부 | 판단 |
|------|-----------|------|
| `gl.bufferSubData` via `primitive._va` | ❌ private API | Cesium 버전 변경 시 즉시 파괴 — 금지 |
| `CustomShader` + uniform array | ❌ Model/3DTileset 전용 | Primitive에 미적용 |
| `Primitive` 재생성 (현재) | ✅ | 유일한 공개 경로 |
| `PointPrimitive` / `Billboard` 컬렉션 | ✅ 인플레이스 업데이트 | 수면 mesh 표현 불가 |

**결론: Primitive 재생성은 피할 수 없다. 목표는 재생성 횟수·비용을 줄이는 것.**

---

## 3. 개선 전략

### Track 1 — 즉시 적용 가능 (위험도 낮음)

#### P-1. Surface 위치 버퍼 재사용 (Float64Array 반복 할당 제거)

**현재**
```js
// buildWaterSurfacePositionsFromCache 내부
const positions = target ?? new Float64Array(cache.basePositions.length)  // ← 매번 new
```

**개선**  
`sim` 객체에 `positionBuffer: Float64Array`를 **초기화 시 한 번만** 할당하고, 이후 매 프레임 `target`으로 전달해 재사용한다.

```js
// startSimulation에서
sim.positionBuffer = new Float64Array(WAVE_RESOLUTION * WAVE_RESOLUTION * 3)

// syncSurfacePrimitive에서 cache에 sim.positionBuffer 전달
buildWaterSurfacePositionsFromCache(cache, engine, sim.positionBuffer)
```

- **효과**: 매 2프레임 74KB 할당 → 0. GC spike 제거.
- **수정 파일**: `FloodVisualization.jsx`, `floodWaterMesh.js` (`buildWaterSurfaceGeometryFromCache`에 `positionBuffer` 파라미터 추가)

---

#### P-2. Body 재생성 이중 제어 (임계값 + 시간 게이트)

**현재**: 수위 변화 ≥ 0.05m 이면 즉시 재생성 → 최대 4회/초

**개선**: 두 조건을 **AND**로 결합

| 조건 | 현재 | 개선 |
|------|------|------|
| 수위 변화량 | ≥ 0.05m | ≥ **0.3m** |
| 마지막 재생성 이후 경과 시간 | (없음) | ≥ **400ms** |

```js
// FloodVisualization.jsx
const BODY_REBUILD_THRESHOLD = 0.3        // 0.05 → 0.3
const BODY_REBUILD_INTERVAL_MS = 400      // 신규

const syncBodyForLevel = (viewer, sim, level, now) => {
  const deltaLevel = Math.abs(level - (sim.lastBodyLevel ?? NaN))
  const deltaTime = now - (sim.lastBodyRebuildMs ?? 0)

  if (!Number.isFinite(sim.lastBodyLevel)
    || (deltaLevel >= BODY_REBUILD_THRESHOLD && deltaTime >= BODY_REBUILD_INTERVAL_MS)) {
    rebuildFloodBody(viewer, sim, level)
    sim.lastBodyRebuildMs = now
  }
}
```

- **효과**: auto-rise 최대 시 4회/초 → **최대 2.5회/초** (0.3m 임계 기준)
- **수정 파일**: `FloodVisualization.jsx`

---

#### P-3. Surface 업데이트 주기 FPS 적응형 조절

**현재**: 항상 2프레임마다 업데이트 (고정)

**개선**: 직전 프레임 렌더 시간이 기준 초과 시 업데이트를 건너뜀

```js
// postUpdate에서 deltaSeconds 측정 중이므로 활용
const SLOW_FRAME_THRESHOLD_MS = 22   // 45fps 이하로 떨어지면 "느린 프레임"

// renderSurface 루프에서
if (sim.lastFrameDeltaMs > SLOW_FRAME_THRESHOLD_MS) return  // 느린 프레임 → skip
```

- `sim.lastFrameDeltaMs`는 postUpdate에서 이미 추적 중인 `deltaSeconds * 1000`을 기록
- **효과**: 저사양 환경에서 GPU/CPU 여유 확보. 60fps 환경에서는 동작 무관.
- **수정 파일**: `FloodVisualization.jsx`

---

### Track 2 — 아키텍처 개선 (중간 위험도)

#### P-4. Body geometry를 바닥면 / 수면면으로 분리 캐싱

**배경**: body geometry는 두 부분으로 나뉜다.
- **바닥면** (지형 → 수면 하단): bounds·terrain 변경 시에만 변함
- **수면 상단 캡**: 수위 변경마다 높이가 바뀜

**현재**: 둘을 합쳐서 항상 재계산

**개선**:
1. `sim.bodyFloorGeometry` — bounds·terrain 변경 시에만 재생성 (저빈도)
2. `sim.bodyCapHeight` — 수위 변경 시 단순 scalar 업데이트 → body Primitive에는 아직 반영 불가 (Cesium 제약) → **대신 수면 캡은 surface Primitive가 이미 담당**하므로 body에서 수면 캡(상단 삼각형)을 **제거**하면 된다.

```
[현재 body geometry]               [개선 body geometry]
  바닥면 (terrain 삼각형)            바닥면 (terrain 삼각형) ← 저빈도 재생성
  상단 캡 (수면 평면 삼각형)  ─────→ 상단 캡 제거 (surface가 이미 커버)
  4면 측벽                            4면 측벽 ← 수위 변화 시에만 재생성
```

- **효과**: body 재생성 시 triangle 수 감소 (~17% 감소). 추후 바닥면 별도 캐싱으로 확장 가능.
- **수정 파일**: `floodWaterMesh.js` — `buildFloodBodyGeometry`에서 상단 캡 삼각형 제거 옵션 추가
- **주의**: surface와 body 사이에 틈이 생기지 않는지 시각 확인 필요

---

#### P-5. `SURFACE_UPDATE_INTERVAL` 동적화

**현재**: 고정 2프레임 (= 30Hz at 60fps)

**개선**: 수면 활동량(파동 에너지)에 따라 업데이트 주기 조절

```js
const surfaceEnergy = sim.engine.heights.reduce((sum, h) => sum + h * h, 0) / sim.engine.heights.length

// 에너지가 낮으면 (물이 잔잔) 업데이트 덜 함
const interval = surfaceEnergy < 0.01 ? 6   // 10Hz — 거의 잔잔
              : surfaceEnergy < 0.5  ? 3   // 20Hz — 보통
              :                        2   // 30Hz — 활발 (기존)

if (sim.frameCount % interval !== 0) return
```

- **효과**: 잔잔한 상태에서 GPU 부하 50~67% 절감
- **수정 파일**: `FloodVisualization.jsx`

---

## 4. 개선 효과 예측 (정량)

| 항목 | 현재 | 개선 후 |
|------|------|---------|
| Surface Float64Array 할당/초 | 30회 (74KB × 30) | **0회** (재사용) |
| Body 재생성 최대 빈도 | 4회/초 | **2.5회/초** |
| 잔잔한 상태 surface 업데이트 | 30Hz | **10Hz** |
| Body triangle 수 | N | **N × 0.83** (상단 캡 제거) |

---

## 5. 구현 우선순위

| 순서 | 항목 | 예상 소요 | 위험도 |
|------|------|-----------|--------|
| 1 | P-1 positionBuffer 재사용 | 1시간 | 🟢 낮음 |
| 2 | P-2 body 이중 제어 | 30분 | 🟢 낮음 |
| 3 | P-3 FPS 적응형 skip | 30분 | 🟢 낮음 |
| 4 | P-5 surface 동적 주기 | 1시간 | 🟡 중간 |
| 5 | P-4 body 상단 캡 분리 | 2~3시간 | 🟡 중간 |

---

## 6. 수정 파일 목록

```
src/utils/floodWaterMesh.js
  - buildWaterSurfaceGeometryFromCache(cache, waveEngine, positionBuffer?)
    ← positionBuffer 파라미터 추가, target으로 전달
  - buildFloodBodyGeometry(..., { omitTopCap: boolean })
    ← 상단 캡 삼각형 제거 옵션 (P-4, 선택)

src/modules/flood/components/FloodVisualization.jsx
  - sim 객체에 positionBuffer, lastBodyRebuildMs, lastFrameDeltaMs 필드 추가
  - BODY_REBUILD_THRESHOLD: 0.05 → 0.3
  - BODY_REBUILD_INTERVAL_MS: 400 신규
  - syncBodyForLevel: 시간 게이트 추가
  - syncSurfacePrimitive: positionBuffer 전달
  - renderSurface: FPS 적응형 skip 추가 (P-3)
  - renderSurface: 동적 interval 계산 추가 (P-5)
```

---

## 7. 테스트 포인트 (개발자 체크리스트)

> 범례: ✅ 코드 검증 완료 · 🖥️ 런타임 테스트 필요

- [x] **P-1** ✅ positionBuffer 공유 후 수면 파동이 이전과 동일하게 보이는지 확인  
  → `sim.positionBuffer = new Float64Array(56 × 56 × 3)` 할당 확인 (FloodVisualization.jsx:246)  
  → `createWaterSurfacePrimitiveFromCache(..., sim.positionBuffer)` 전달 확인 (FloodVisualization.jsx:94-99)  
  → `buildWaterSurfacePositionsFromCache`가 `target` 전체를 루프로 덮어씀 (floodWaterMesh.js:101-107) — 버퍼 완전 갱신 ✅

- [x] **P-2** ✅ auto-rise 100% 상태에서 0.3m 미만 변화 시 body 재생성 없는지 확인  
  → `BODY_REBUILD_THRESHOLD = 0.3`, `BODY_REBUILD_INTERVAL_MS = 400` 상수 확인 (FloodVisualization.jsx:22-23)  
  → `deltaLevel >= 0.3 && deltaTime >= 400` AND 조건 확인 (FloodVisualization.jsx:115-118)

- [x] **P-2** ✅ 수위 급변(초기화 → 시나리오 적용) 시 body가 즉시 반영되는지 확인  
  → 초기 body는 `startSimulation` 내 `rebuildFloodMeshes → rebuildFloodBody` 경로로 직접 빌드 (FloodVisualization.jsx:149, 258)  
  ⚠️ 참고: `!Number.isFinite(sim.lastBodyLevel)` 분기는 실제 실행되지 않음. 초기 body가 이 경로가 아닌 `rebuildFloodMeshes`에서 확실히 빌드되므로 기능상 동일하나, 스펙과 구현 경로가 다름.

- [ ] **P-3** 🖥️ 저사양 기기(개발자 도구 CPU throttle 6x)에서 visual glitch 없는지 확인  
  → 로직 코드 검증: `SLOW_FRAME_THRESHOLD_MS = 22` + `if (sim.lastFrameDeltaMs > 22) return` 확인 (FloodVisualization.jsx:24, 323)  
  → `lastFrameDeltaMs = deltaSeconds * 1000` (FloodVisualization.jsx:287), 초기값 `0` (첫 프레임 skip 없음) ✅  
  → **런타임 확인 필요**: 느린 프레임 skip 중 수면 mesh가 마지막 렌더 상태로 유지되는지

- [ ] **P-4** 🖥️ surface와 body 사이에 투명한 틈 없는지 확인 (상단 캡 제거 후)  
  → `buildFloodBodyGeometry(..., { omitTopCap })` 옵션 확인 (floodWaterMesh.js:265-266)  
  → `if (!omitTopCap) { 상단 캡 삼각형 }` 블록 확인 (floodWaterMesh.js:321-324)  
  → `createFloodBodyPrimitive` 기본값 `omitTopCap = true` — 최적화 기본 활성 (floodWaterMesh.js:361)  
  → **런타임 확인 필요**: 수면과 body 경계에 z-fighting 또는 투명 틈 없는지

- [x] **P-5** ✅ 강수 OFF + 수위 고정 상태에서 surface 업데이트가 6프레임 간격으로 줄어드는지 확인  
  → `getSurfaceUpdateInterval(engine)` 함수: `energy < 0.01 → 6, < 0.5 → 3, else → 2` (FloodVisualization.jsx:26-34)  
  → `.reduce()` 대신 `for` 루프 — 스펙보다 효율적 구현 ✅  
  → `sim.frameCount % surfaceInterval !== 0` 조건 확인 (FloodVisualization.jsx:326)

---

### 스펙 외 추가 구현

| 항목 | 내용 |
|------|------|
| `sim.surfaceDirty` 플래그 | postUpdate마다 `true`, `syncSurfacePrimitive` 후 `false`. 동일 프레임 중복 렌더 방지. 스펙에 없던 개선 ✅ |
| `getSurfaceUpdateInterval` `for` 루프 | 스펙의 `.reduce()` 대신 단순 루프 — GC 부담 없이 동등한 동작 ✅ |

---

## 8. 하지 말아야 할 것

| 시도 | 이유 |
|------|------|
| `primitive._va.vertexBuffer` 직접 업데이트 | Cesium private API — 버전 업데이트 시 즉시 파괴 |
| `asynchronous: true` 로 변경 | 비동기 컴파일 → 다음 프레임에 렌더 → 수면 파동 1프레임 지연 깜빡임 |
| Surface 업데이트를 postUpdate로 이동 | rAF와 postUpdate 혼용 시 Cesium 렌더 타이밍 충돌 위험 |
| Body를 Entity로 되돌리기 | Entity는 Primitive보다 느림 — 성능 퇴보 |

---

## 관련 문서

- [기획·테스트 평가](./evaluation.md) — B-2 병목 원본 분석
- [구현 기능](./features.md) — FloodVisualization 구조 상세
- [작업 목표](./goals.md) — 성능 2차 이후 쓰나미 Phase 1
