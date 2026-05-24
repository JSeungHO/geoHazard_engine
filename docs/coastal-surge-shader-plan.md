# 연안 surge 셰이더 기획서

> ⚠️ **상태: 대안·레거시 (2026-05-24)** — 쓰나미 Phase 2는 **별도 WebGL 3D 파도 애니메이션** 통합을 우선한다. 본 문서는 WebGL 미적용 시 flat wedge 개선용 참고 자료.
>
> 작성일: 2026-05-24  
> 전제 문서: [coastal-surge-plan.md](./coastal-surge-plan.md) §4 (셰이더 방식 채택)  
> 현재 구현 상태: [tsunami-status.md](./tsunami-status.md)

---

## 1. 목표

현재 연안 침수 overlay는 **단일 색상 flat polygon**이다.  
이것을 **"바다에서 육지로 물이 밀려드는"** 시각으로 바꾼다.

| 지금 | 목표 |
|------|------|
| 단색 반투명 청록 polygon | 바다 쪽 짙고 불투명 → 육지 front 쪽으로 갈수록 투명 |
| 경계가 딱딱한 직선/곡선 | 물 전진 방향 front에 흰 거품(foam) 띠 |
| spreadFactor에 따라 polygon 크기만 변화 | foam 라인이 바다 → 육지 방향으로 실시간 전진 |

---

## 2. 현재 코드 구조 파악

### 2.1 렌더 경로 (현재)

```
TsunamiVisualization (RAF tick 80ms)
  └── reportSummary()
        └── buildRunupSites(summary, epicenter)   ← tsunamiRunupSites.js
              └── buildSurgeFan(site, epicenter, spread, waveHeight)
                    → corners[] (polygon 꼭짓점 배열)
        └── TsunamiRunupPrimitiveLayer.sync(sites)  ← tsunamiRunupPrimitives.js
              └── createRunupPrimitive(site)
                    → GroundPrimitive
                       + PolygonGeometry(corners)
                       + PerInstanceColorAppearance (flat, 단색)
```

### 2.2 핵심 문제

`PerInstanceColorAppearance`는 인스턴스별 단일 색상만 지원한다.  
**방향 그라디언트, foam 라인, 알파 변화를 표현하려면 커스텀 Fabric 셰이더가 필요하다.**

Cesium에서 커스텀 셰이더를 GroundPrimitive에 적용하는 방법:  
`PerInstanceColorAppearance` → `MaterialAppearance` + 커스텀 `Material` (Fabric) 교체.

### 2.3 변경이 필요한 파일

| 파일 | 변경 종류 | 내용 |
|------|-----------|------|
| `utils/floodWaterMaterial.js` | 추가 | `TsunamiSurgeMaterial` Fabric 타입 등록 + 팩토리 함수 |
| `tsunami/utils/tsunamiRunupPrimitives.js` | 수정 | Appearance를 `MaterialAppearance`로 교체, surgeMask uniform 주입 |
| `tsunami/utils/tsunamiRunupSites.js` | 수정 | `buildSurgeFan()` 반환값에 `seaUV`, `inlandUV` 추가 |
| `tsunami/constants/coastalSurgeLayout.js` | 수정 | 주요 도시 shorePoint 수동 보정 좌표 추가 |
| `tsunami/constants/coastalImpactPoints.js` | 수정 (소) | 도시별 `shoreOffset` 보정값 필드 추가 (선택) |

---

## 3. 셰이더 설계

### 3.1 재질 타입명

```
TsunamiSurgeMaterial
```

기존 `FloodPhysicsWater`와 **별도 타입**으로 등록한다.  
(홍수 모듈과 공유하지 않음 — surge 전용 로직이 포함되어 있어 혼용 시 복잡도 증가)

### 3.2 Uniform 목록

| uniform | GLSL 타입 | 설명 | 기본값 |
|---------|-----------|------|--------|
| `baseColor` | `vec4` | 침수 기본 색 (RGBA) | `rgba(38, 98, 108, 0.55)` 딥틸 |
| `foamColor` | `vec4` | foam 라인 색 (RGBA) | `rgba(220, 240, 245, 0.88)` 흰색 계열 |
| `seaUV` | `vec2` | 바다 앵커 ST 좌표 (0~1) | `(0.5, 0.5)` (기본, 실제론 계산값) |
| `inlandUV` | `vec2` | 육지 front ST 좌표 (0~1) | `(0.5, 0.5)` |
| `progress` | `float` | surge 전진 비율 0.0 → 1.0 | `1.0` |
| `crossRadius` | `float` | surge 횡방향 폭 (ST 단위) | `0.40` |
| `feather` | `float` | 경계 부드러움 | `0.06` |
| `foamWidth` | `float` | foam 띠 두께 (ST 단위) | `0.055` |
| `depthFade` | `float` | 육지 방향 알파 감소량 (0~1) | `0.55` |

> **ST 좌표란?**  
> `czm_materialInput.st`는 Cesium이 polygon geometry에 자동 부여하는 (0~1) 텍스처 좌표다.  
> polygon의 bounding box 기준으로 정규화된다.  
> `seaUV`, `inlandUV`는 `getCoastalSurgeLayout()`이 반환하는 `mask.seaU/V`, `mask.inlandU/V`를 그대로 사용한다.

### 3.3 GLSL 로직 (단계별 설명)

셰이더 소스는 `czm_getMaterial` 함수 하나로 구성된다.

#### 단계 1 — surge 축 계산

```
axis    = normalize(inlandUV - seaUV)          // 바다→육지 단위 벡터
axisLen = length(inlandUV - seaUV)             // 전체 surge 축 길이 (ST 단위)
rel     = st - seaUV                           // 현재 fragment의 seaUV 기준 상대 위치
along   = dot(rel, axis)                       // 축 방향 투영 거리
perp    = |rel × axis|                         // 축과 수직 거리 (횡방향)
```

#### 단계 2 — 마스크 계산

```
front   = axisLen × progress                   // 현재 surge 전진 위치

// 유효 범위 판정
along ∈ [-feather, front + feather]
perp  ∈ [0, crossRadius + feather×0.5]

// 가장자리 smooth fade
weight_along_back   : along가 0 근처에서 부드럽게 시작 (feather)
weight_along_front  : along가 front 근처에서 부드럽게 끝 (feather)
weight_cross        : perp가 crossRadius 근처에서 부드럽게 끝 (feather)

finalWeight = weight_along_back × weight_along_front × weight_cross
```

#### 단계 3 — 깊이 그라디언트

```
// along=0 (바다) → along=front (육지 front) 방향으로 알파 감소
depthT  = clamp(along / max(front, 0.001), 0.0, 1.0)
depthAlpha = 1.0 - depthT × depthFade
```

#### 단계 4 — foam 라인

```
// inland front 경계 근처 (along ∈ [front-foamWidth, front]) 에서 밝은 띠
foamT  = 1.0 - smoothstep(front - foamWidth, front, along)
// foamT × crossMask (횡방향도 동일한 폭 제한)
foamMix = foamT × weight_cross
```

#### 단계 5 — 최종 색 조합

```
color   = mix(baseColor.rgb, foamColor.rgb, foamMix × foamColor.a)
alpha   = baseColor.a × finalWeight × depthAlpha + foamColor.a × foamMix × 0.35
material.diffuse = color
material.alpha   = clamp(alpha, 0.0, 1.0)
```

### 3.4 시각 결과 예상

```
[바다쪽]  ████████████████  짙은 딥틸, alpha 0.55
           ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  중간 alpha
            ░░░░░░░░░░░░    옅어짐
             ≋≋≋≋≋≋≋≋≋≋    foam 라인 (흰색 띠, progress 따라 전진)
              (투명)        foam 너머 지형만 보임
[육지쪽]
```

---

## 4. `buildSurgeFan()` 반환값 확장

현재 `buildSurgeFan`은 `corners[]`만 반환한다.  
셰이더가 seaUV/inlandUV를 uniform으로 받으려면 **ST 공간에서의 좌표**가 필요하다.

`getCoastalSurgeLayout()`은 이미 `mask.seaU`, `mask.seaV`, `mask.inlandU`, `mask.inlandV`를 계산한다.  
`buildSurgeFan`이 이 값을 `surgeMask` 필드로 함께 반환하도록 확장한다.

### 반환 구조 변경 (추가 필드)

```js
// 현재
{ id, corners, extrudedHeight, posLat, posLon, spread }

// 변경 후
{ id, corners, extrudedHeight, posLat, posLon, spread,
  surgeMask: {        // ← 추가
    seaU, seaV,       // 바다 앵커 ST
    inlandU, inlandV, // 육지 front ST
    progress,         // spread 기반 전진 비율
    crossRadius,      // 횡방향 폭
    feather           // 경계 부드러움
  }
}
```

`surgeMask`의 값은 `getCoastalSurgeLayout(site, epicenter, spread, waveHeight).mask`를 그대로 가져온다.

---

## 5. `createRunupPrimitive()` 변경

### 5.1 Appearance 교체

| 항목 | 현재 | 변경 |
|------|------|------|
| Appearance | `PerInstanceColorAppearance` | `MaterialAppearance` |
| 재질 | 없음 (인스턴스 색) | `TsunamiSurgeMaterial` (커스텀 Fabric) |
| vertex format | `PerInstanceColorAppearance.VERTEX_FORMAT` | `MaterialAppearance.MaterialAppearanceType.ALL` |
| translucent | `true` | `true` |
| flat | `true` | `false` (법선 필요 — czm_materialInput.st 사용) |

### 5.2 Material uniform 주입

`createRunupPrimitive(site)`가 `site.surgeMask`를 받아 Material uniform에 주입한다.

```
surgeMask.seaU / seaV      → uniform seaUV
surgeMask.inlandU / inlandV → uniform inlandUV
surgeMask.progress          → uniform progress
surgeMask.crossRadius       → uniform crossRadius
surgeMask.feather           → uniform feather
site.extrudedHeight         → waveHeight → baseColor alpha 조정
```

### 5.3 `getRunupStateKey()` 변경

기존: height + spread + corners  
변경: height + progress + seaU + inlandU + corners

progress가 80ms마다 변하므로 **양자화 단위(step=0.04)** 를 설정해 primitive 교체 빈도를 제한한다.  
(너무 자주 교체하면 깜빡임 발생 — 현재 `height: 0.4`, `spread: 0.05` 방식과 동일)

---

## 6. shorePoint 수동 보정

현재 `getCoastalSurgeBasis()`는 도시 중심에서 고정 오프셋(3200m)으로 shorePoint를 추정한다.  
동해안 주요 도시에서 실제 해안선과 어긋나는 경우를 수동 보정한다.

### 보정이 필요한 도시 (우선순위)

| 도시 | 문제 | 보정 방법 |
|------|------|-----------|
| 포항 | 형산강 하구·영일만 → 도심과 해안 방향 복잡 | shoreOffset 수동 지정 |
| 강릉 | 경포 해변 → 실제 해안이 도심 동쪽 1~2km | shoreOffset 조정 |
| 울산 | 태화강·울산만 → 남쪽 방향이 섞임 | region 또는 shoreOffset 보정 |
| 부산 | 해운대/광안리 → 다방향 해안 | region 'south' 고정으로 충분할 수 있음 |

### 보정 방식

`coastalImpactPoints.js` 또는 `coastalSurgeLayout.js`에 `shoreOffset` 필드를 추가:

```js
// coastalImpactPoints.js 예시
{ id: 'pohang', label: '포항', lat: 36.032, lon: 129.365, region: 'east',
  shoreOffset: { northM: -800, eastM: 1200 } }  // ← 실제 해안선 방향 보정
```

`getCoastalSurgeBasis()`가 `site.shoreOffset`을 참조해 shorePoint 계산 시 보정값을 더한다.

---

## 7. 데이터 흐름 (변경 후 전체)

```
TsunamiVisualization (RAF 80ms)
  └── reportSummary(viewer, model, elapsed)
        └── model.getImpactSummary(elapsed, impactPoints)
              → summary.impacts[].{ reached, waveHeightM, spreadFactor }
        └── buildRunupSites(summary, epicenter)
              └── buildSurgeFan(site, epicenter, spread, waveHeight)
                    → getCoastalSurgeLayout(site, epicenter, spread, waveHeight)
                    → { corners[], surgeMask: { seaU, seaV, inlandU, inlandV, progress, ... } }  ← 신규
        └── TsunamiRunupPrimitiveLayer.sync(sites)
              └── getRunupStateKey(site)           ← progress 양자화 포함
              └── createRunupPrimitive(site)
                    → PolygonGeometry(corners)
                    + MaterialAppearance            ← 변경
                    + TsunamiSurgeMaterial(surgeMask)  ← 신규
                          uniforms: seaUV, inlandUV, progress, foamWidth, ...
```

---

## 8. 구현 순서

### Step 1 — `TsunamiSurgeMaterial` 셰이더 등록
**파일**: `src/utils/floodWaterMaterial.js`

- `Material._materialCache.addMaterial('TsunamiSurgeMaterial', { fabric: { ... } })`
- uniform 목록, GLSL source (§3 기반)
- `createTsunamiSurgeMaterial(surgeMask)` 팩토리 함수

**완료 기준**: `new Material({ fabric: { type: 'TsunamiSurgeMaterial', uniforms: {...} } })` 로 재질 생성 가능

---

### Step 2 — `buildSurgeFan()` 반환값 확장
**파일**: `src/modules/tsunami/utils/tsunamiRunupSites.js`

- `getCoastalSurgeLayout()` import 추가
- 반환 객체에 `surgeMask` 필드 추가 (§4 기반)

**완료 기준**: `buildSurgeFan()`의 반환값에 `surgeMask.seaU` 등이 존재

---

### Step 3 — `createRunupPrimitive()` Appearance 교체
**파일**: `src/modules/tsunami/utils/tsunamiRunupPrimitives.js`

- `PerInstanceColorAppearance` → `MaterialAppearance` 교체
- `createTsunamiSurgeMaterial(site.surgeMask)` 주입
- `getRunupStateKey()` — progress 양자화(step=0.04) 추가
- vertex format 변경

**완료 기준**: 브라우저에서 polygon이 단색 대신 gradient + foam으로 렌더됨

---

### Step 4 — shorePoint 보정
**파일**: `src/modules/tsunami/constants/coastalImpactPoints.js` + `coastalSurgeLayout.js`

- 포항·강릉·울산 3개 도시 우선 수동 보정
- `shoreOffset` 필드 추가, `getCoastalSurgeBasis()` 반영

**완료 기준**: 포항 시뮬레이션 시 wedge가 실제 영일만·형산강 방향에 근접

---

### Step 5 — QA 및 튜닝
- `foamWidth`, `depthFade`, `feather` 값을 브라우저에서 시각 확인 후 조정
- 동해/서해/남해 프리셋별 시각 확인
- 파고 3m / 8m / 15m 단계별 foam 라인 크기·색 확인

---

## 9. 완료 기준

| 기준 | 확인 방법 |
|------|-----------|
| 바다 쪽이 짙고, 육지 front 쪽이 투명 | 동해 프리셋 → 포항 도달 후 육안 확인 |
| foam 라인이 바다→육지 방향으로 전진 | spreadFactor 0→1 변화 중 foam 위치 이동 확인 |
| 단색 polygon 없음 | `PerInstanceColorAppearance` import 제거됨 |
| 기존 테스트 통과 | `npm test` 35개 이상 통과 |
| 깜빡임 없음 | 80ms 루프에서 state key 변화 없으면 primitive 교체 없음 |

---

## 10. 범위 외 (이번 기획 제외)

| 항목 | 이유 |
|------|------|
| 실제 OSM 해안선 데이터 연동 | GeoServer 없이 불가. Step 4 수동 보정으로 대체 |
| 파도 높이에 따른 3D 수면 (WaterWaveEngine) | GroundPrimitive는 지형 클램핑 전용 — 수면 물리는 별도 레이어 필요 (Phase 3 이후) |
| 다중 파면 반사 | Phase 2 이후 |
| OSM 건물 Classification 침수 | Phase 3a |

---

## 11. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-24 | 초판 — 셰이더 방식 상세 기획 |
