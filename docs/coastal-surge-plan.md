# 연안 surge 시각화 — 기획서

> 작성일: 2026-05-24  
> 목적: "바다에서 육지로 물이 들어오는" 시각 표현 방향 결정  
> 관련: [tsunami-status.md](./tsunami-status.md) §6 알려진 한계

---

## 1. 현재 상태와 문제

현재 `GroundPrimitive` + polygon으로 surge wedge를 지형 위에 올리고 있다.  
wedge 기하 자체는 sea edge → inland front 방향 구조가 맞지만 **시각 품질**이 두 가지 이유로 부족하다.

| 문제 | 원인 |
|------|------|
| 해안선이 추정값 | 도시 중심 + 고정 오프셋(m)으로 shorePoint 계산 → 실제 만·항·갯벌과 어긋남 |
| 물이 "들어오는 느낌" 없음 | polygon에 균일한 색만 적용 → 방향성·전진 느낌이 없음. 바다와 구분도 애매 |

---

## 2. 목표 시각

```
[바다] ─── 짙은 딥블루 (기존 바다 이미지리와 자연스럽게 이어짐)
            ↓ 전진 방향 그라디언트
[해안선] ── 물거품(foam) 라인 — 실시간 전진
            ↓
[육지 front] ── 반투명 침수색, 안쪽으로 갈수록 α 감소
[육지 건조] ── 투명 (지형·건물만 보임)
```

이 효과를 만드는 방법은 두 가지다. 아래에서 각각의 레이어 구성, 작업 범위, 장단점을 정리한다.

---

## 3. 방법 A — GeoServer

### 3.1 왜 GeoServer인가

`GroundPrimitive` polygon이 실제 해안선을 따르지 않는 근본 원인은 **해안선 데이터**가 없기 때문이다.  
GeoServer는 해안선·DEM·침수 폴리곤을 지리 데이터로 서빙하는 인프라다.  
Cesium 자체 계산 대신 서버가 정확한 공간 데이터를 내려주므로, 클라이언트 코드 복잡도가 줄고 데이터 정밀도가 올라간다.

### 3.2 필요한 레이어

| 레이어 | GeoServer 서비스 | 용도 |
|--------|-----------------|------|
| **해안선 벡터** | WFS (GeoJSON/GML) | 실제 coastline polygon. shorePoint 고정 오프셋 대체 |
| **DEM (표고 래스터)** | WCS (GeoTIFF) | 침수 가능 범위 계산 — 고도 ≤ waveHeight인 셀만 침수 |
| **침수 폴리곤 (시나리오)** | WFS 또는 WMS | 파고별 미리 계산된 inundation polygon (Optional: WPS 실시간 대체 가능) |
| **수심 (Bathymetry)** | WCS | 바다→해안 tint 구분. 없으면 Cesium World Terrain으로 근사 가능 |

> **핵심은 해안선 WFS와 DEM WCS 두 개**. 침수 폴리곤은 미리 시나리오를 계산해 저장하거나 WPS로 실시간 계산한다.

### 3.3 데이터 소스 옵션

| 소스 | 해상도 | 비용 | 비고 |
|------|--------|------|------|
| **OpenStreetMap coastline** | 충분 (교육용) | 무료 | osm2pgsql → PostGIS → GeoServer WFS |
| **국토정보지리원 DEM** | 5m 또는 30m | 무료 (개방 데이터) | NGII OpenAPI 또는 직접 다운로드 |
| **ETOPO (전지구 수심)** | 1분 (~1.8km) | 무료 (NOAA) | 바다 수심 tint용 |
| **SRTM 30m** | 30m | 무료 | 육지 DEM fallback |

### 3.4 Cesium 연동 방식

```
GeoServer
  ├── WFS → GeoJsonDataSource.load(url)    ← 해안선·침수 폴리곤 벡터
  └── WMS → ImageryLayer(WebMapServiceImageryProvider) ← 침수 래스터 overlay
```

- **WFS(벡터)**: Cesium `GeoJsonDataSource`로 로드 → Entity polygon 생성 → 쓰나미 진행에 따라 alpha/color 업데이트
- **WMS(래스터)**: `WebMapServiceImageryProvider`로 Cesium imageryLayers에 추가 → 파고 파라미터를 WMS `time` 또는 커스텀 파라미터로 전달해 시나리오별 이미지 표시

### 3.5 인프라 구성 비용

| 항목 | 내용 |
|------|------|
| GeoServer 서버 | Docker 1컨테이너 (로컬 또는 클라우드) |
| PostGIS DB | OSM coastline, DEM tile 저장 |
| 데이터 전처리 | osm2pgsql, GDAL/OGR로 GeoTIFF 업로드 |
| CORS 설정 | GeoServer web.xml 또는 nginx proxy |
| 예상 공수 | **초기 셋업 2~3일** + 데이터 전처리 1일 |

### 3.6 GeoServer 방식의 장단점

| | |
|---|---|
| ✅ | 실제 해안선 → wedge가 실제 지형과 일치 |
| ✅ | 침수 시나리오를 사전 계산해 저장 가능 (정밀도↑) |
| ✅ | 클라이언트 JS 코드 단순화 |
| ❌ | 서버 인프라 필요 (로컬 또는 클라우드 — Vercel 배포만으로는 부족) |
| ❌ | 데이터 전처리 공수 별도 |
| ❌ | 교육용 프로토타입에 비해 인프라 규모가 큼 |

---

## 4. 방법 B — 셰이더 (GeoServer 없음)

### 4.1 개요

GeoServer 없이 **기존 Cesium Fabric 재질(GLSL)에 surge 방향 마스크를 추가**하는 방식.  
현재 `FloodPhysicsWater` 셰이더에 uniform을 추가해 surge 경계·그라디언트·foam 라인을 그린다.

해안선 정밀도 문제는 `coastalSurgeLayout.js`의 `shorePoint` 계산을 개선(도시별 수동 보정 또는 OSM 해안선 좌표 하드코딩)하는 것으로 분리해서 처리한다.

### 4.2 셰이더에 필요한 추가 uniform

현재 `FloodPhysicsWater` 셰이더는 수면의 색·반사·glint만 처리한다. 아래 uniform을 추가해야 한다.

| uniform | 타입 | 역할 |
|---------|------|------|
| `surgeEnabled` | `bool` | surge 마스크 on/off (홍수 모듈에서도 재사용 가능) |
| `seaUV` | `vec2` | 바다 앵커 UV 좌표 (bounds 내 정규화) |
| `inlandUV` | `vec2` | 육지 front UV 좌표 |
| `surgeFront` | `float` | 현재 전진 비율 0.0 → 1.0 |
| `crossRadius` | `float` | surge 폭 (UV 단위) |
| `surgeFeather` | `float` | 경계 부드러움 |
| `foamLineWidth` | `float` | foam 라인 폭 |
| `foamStrength` | `float` | foam 밝기 |

### 4.3 셰이더 로직 흐름

```glsl
// 1. UV 계산 (bounds에서 현재 fragment 위치 정규화)
vec2 uv = ...; // positionMC → bounds (west/east/south/north)로 정규화

// 2. surge 축 투영
vec2 axis = normalize(inlandUV - seaUV);
float along  = dot(uv - seaUV, axis);     // 진행 방향 거리
float cross  = ...; // 축과 수직 거리

// 3. 마스크 weight (0 = 투명, 1 = 완전 표시)
float front  = length(inlandUV - seaUV) * surgeFront;
float weight = 0.0;
// along ∈ [0, front], cross ∈ [0, crossRadius] 영역만 표시
// feather로 가장자리 부드럽게

// 4. 진행 방향 그라디언트
//    along 0(바다)에서 front(inland)로 갈수록 alpha 감소
float depthAlpha = 1.0 - smoothstep(0.0, front, along) * 0.55;

// 5. foam 라인
//    inland front 경계 근처에서 밝은 흰색 띠
float foamT = 1.0 - smoothstep(front - foamLineWidth, front, along);
material.diffuse = mix(material.diffuse, vec3(1.0), foamT * foamStrength);

// 6. 최종 alpha
material.alpha *= weight * depthAlpha;
```

### 4.4 셰이더 작업 범위

| 작업 | 내용 | 복잡도 |
|------|------|--------|
| `FloodPhysicsWater` 셰이더 수정 | uniform 추가 + 위 로직 삽입 (~30줄 GLSL) | ★★☆ |
| 새 재질 타입 등록 | `FloodPhysicsWaterSurge`를 별도 타입으로 분리 vs 기존 타입에 병합 | ★☆☆ |
| `floodWaterMaterial.js` | `createCoastalSurgeMaterial(surgeMask)` 팩토리 함수 추가 | ★☆☆ |
| `CoastalSurgeVisualization` | `FloodVisualization` per site 관리 + surgeMask prop 전달 + waveModel 수위 계산 | ★★☆ |
| 해안선 shorePoint 보정 | 도시별 수동 좌표 또는 OSM 해안선 좌표 하드코딩 | ★☆☆ |
| **합계 예상 공수** | | **2~3일** |

### 4.5 셰이더 방식의 장단점

| | |
|---|---|
| ✅ | 서버 인프라 불필요 — 현재 Vercel 배포 구조 유지 |
| ✅ | 기존 `FloodVisualization` + `FloodPhysicsWater` 위에 점진적 추가 |
| ✅ | foam·그라디언트 등 시각 연출을 자유롭게 조정 가능 |
| ❌ | 해안선 정밀도는 여전히 수동 좌표 하드코딩 수준 (shorePoint 보정으로 커버) |
| ❌ | Cesium Fabric 재질 제약: UV는 bounds 기준 직접 계산해야 함 (API 미지원) |

---

## 5. 비교 요약

|  | GeoServer | 셰이더 |
|--|-----------|--------|
| 해안선 정밀도 | ✅ 실제 데이터 | ▲ 수동 보정 수준 |
| 침수 폴리곤 | ✅ DEM 기반 정밀 계산 | ▲ terrain grid 근사 |
| 서버 인프라 | ❌ 필요 | ✅ 불필요 |
| 배포 구조 변경 | ❌ 백엔드 필요 | ✅ Vercel 그대로 |
| 시각 연출 자유도 | ▲ WMS 스타일 제한 | ✅ GLSL 자유 |
| 초기 구축 공수 | 3~4일 | 2~3일 |
| 교육 프로토타입 적합성 | 과잉 | 적합 |

---

## 6. 권장 방향

**현재 단계: 셰이더 방식 채택**

- 교육용 프로토타입 목적에 GeoServer 인프라는 과잉
- foam 라인 + 방향 그라디언트만으로 "바다→육지" 느낌을 충분히 표현 가능
- 해안선 정밀도는 도시별 shorePoint 수동 보정(포항·강릉·울산 각 ~3~5개 좌표 조정)으로 교육용 품질 달성 가능

**GeoServer 도입을 검토할 시점**

- Phase 3a (건물 침수) 이후 실제 피해 지역 데이터 연동이 필요할 때
- 특정 실제 지역의 정밀 시뮬레이션 시나리오를 제공해야 할 때
- 백엔드 인프라가 이미 구축된 환경에서 운영할 때

---

## 7. 셰이더 방식 다음 단계 (구현 순서)

> 아래는 기획 수준의 작업 목록. 실제 구현 전 검토 후 확정.

1. **`createCoastalSurgeMaterial(surgeMask)` 팩토리** — 기존 `FloodPhysicsWater` 타입을 확장해 surge uniform을 추가 주입
2. **`FloodPhysicsWater` 셰이더 수정** — surge 로직 분기(surgeEnabled), foam 라인, 그라디언트 alpha
3. **`CoastalSurgeVisualization` 컴포넌트** — impactPoints × `FloodVisualization` 매핑, surgeMask와 waveModel 수위 연결
4. **shorePoint 좌표 보정** — 포항·강릉·울산 등 주요 도시별 해안 앵커 수동 검수

---

## 8. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-24 | 초판 — GeoServer vs 셰이더 방식 비교 기획 |
