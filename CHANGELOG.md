# Changelog

이 프로젝트의 주요 변경 사항을 기록합니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/)를,
버전은 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

## [Unreleased]

### Changed
- 침수 수위를 임의 상수(초당 0.24 m 상승)에서 강우–배수 저류 모델로 교체하고 2022.8.8 강남역 사례로 보정 ([모델 문서](./docs/model.md))
- 강우 입력을 % 대신 mm/h로, 침수 깊이 범위를 0~100 m에서 0~5 m로 변경
- 2022 강남역 시나리오 수심 8.5 m → 실측 최대 1.8 m (서울시 침수흔적도)
- 지진 여진 구간에도 피해 추정 패널이 본진 결과를 유지
- 수면 출렁임 상한을 4.2 m(폭풍 8 m)에서 0.3 m(폭풍 0.6 m)로 낮춤 — 도로 침수 수심에 맞춤
- README를 문제 정의·접근 방법·모델·검증·한계 순서로 재작성
- 개발 과정 문서 16개를 `docs/archive/`로 이동, `PROJECT_PLAN.md` 삭제

### Added
- `docs/model.md`: 모델 가정·파라미터 출처·검증·한계
- `docs/architecture.md`(코드 구조·데이터 흐름·Cesium 제약), `docs/roadmap.md`
- 지진 진도 관측 대비 검증 테스트 (알려진 오차 3건은 `it.fails`로 고정)

### Fixed
- 배포 GeoJSON에 포함되어 있던 작업자 로컬 파일 경로(`path`) 속성 제거
- 진도 모델 주석의 사실과 다른 "검증" 문구 수정

## [0.3.0] - 2026-11-06

### Changed
- UI를 GIS 운영 콘솔 형태로 전면 개편: 상단 앱 바 통합, 평평한 제어 패널, 지도 위 플로팅 레이어 컨트롤, 공통 UI 요소와 디자인 토큰 정리 ([디자인 가이드](./docs/design.md))
- 진도(MMI) 색상을 USGS ShakeMap 표준 색상표로 교체하고 지도에 진도 범례 추가
- 지진 도달 시간·경과 시계를 애니메이션 시간이 아닌 물리 시간(× 배속)으로 표기
- QA 스크립트를 `scripts/qa/`로 이동하고 `npm run qa:*` 명령 추가 (기본 headless)

### Fixed
- ESLint 오류 14건·경고 11건 해소 (선언 전 참조, 미사용 변수, effect cleanup의 ref 참조)

### Removed
- 이모지 아이콘, Vite 템플릿 잔재(로고·App.css·미사용 이미지)
- git으로 추적하던 QA 스크린샷 33MB (README 이미지는 `docs/images/`로 이동)

### Added
- GitHub Actions CI (lint · test · build)

## [0.2.0] - 2026-06 (커밋 이력 기준 소급 정리)

### Added
- 지진 모듈 Phase 1~4: P/S파 전파, MMI 진도 오버레이, OSM 건물 손상·흔들림, 여진·지표 균열·액상화
- 2022 강남역 호우 시나리오에 서울시 침수흔적도 오버레이, shapefile → GeoJSON 변환 스크립트

### Changed
- 쓰나미 모듈 보류 (WebGL 3D 파도 통합 후 재개)

## [0.1.0] - 2026-05 (커밋 이력 기준 소급 정리)

### Added
- 도시 침수 모듈: 지형 격자 기반 침수 수면, 2D 파동, 강수 파티클, 시나리오 프리셋
