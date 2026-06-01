# GeoHazard Engine — 로컬 공간 데이터

홍수·침수 모듈(`2022 강남역` 시나리오 등)과 향후 **실측 침수 흔적 overlay** 연동을 위한 참고 데이터입니다.

## 포함 데이터

| 파일 | 설명 |
|------|------|
| `2022 서울시 침수흔적도 업뎃.*` | 서울시 2022년 침수흔적도 Shapefile (로컬 전용) |

Shapefile 본체(`.shp`, `.dbf`, `.shx`)는 용량(~80MB) 때문에 Git에 올리지 않습니다.  
`.prj`, `.cpg`, `.qmd` 등 메타 파일만 저장소에 포함할 수 있습니다.

## 로컬 배치

1. Shapefile 전체를 이 폴더(`data/`)에 둡니다.
2. 파일명 예: `2022 서울시 침수흔적도 업뎃.shp` (+ `.dbf`, `.shx`, `.prj`, …)

## 변환 (Shapefile → GeoJSON)

로컬에 `.shp`가 있으면 아래 스크립트로 WGS84 GeoJSON을 생성합니다.

```bash
# 강남역 주변만 clip (기본)
npm run data:shp2geojson

# 서울 전체
npm run data:shp2geojson -- --all

# 사용자 bbox (west,south,east,north)
npm run data:shp2geojson -- --bbox 127.01,37.48,127.04,37.51
```

출력: `data/geojson/<파일명>-gangnam.geojson` (또는 `-clip` / 전체)

배포용 GeoJSON 갱신:

```bash
npm run data:publish-flood-trace
```

→ `public/data/seoul-flood-2022-gangnam.geojson` (앱 overlay)

- 입력 좌표계: **EPSG:5179** (KGD2002 Unified, `.prj` 기준)
- 출력 좌표계: **WGS84** (GeoJSON 표준)

## 향후 연동 (로드맵)

- [x] Shapefile → GeoJSON 변환 스크립트 (`scripts/shp-to-geojson.mjs`)
- [x] `gangnam_2022` 프리셋과 실측 polygon overlay
- [ ] `docs/goals.md` — 홍수 모듈 polish 항목과 연계

## 출처·라이선스

데이터 출처·이용 조건은 **서울시 공개 데이터** 정책을 따릅니다.  
배포·데모에는 가공된 GeoJSON만 포함하고, 원본 Shapefile은 로컬·CI 아티팩트로 관리합니다.
