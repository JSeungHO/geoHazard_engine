PROJECT_PLAN.md
# 프로젝트명: GeoHazard Engine
## 1. 프로젝트 목표
- 현실적인 재난(홍수, 지진 등) 시뮬레이션 플랫폼 구축.
- 강남역을 기준 좌표(37.4975, 127.0267)로 지형 데이터 활용.
- 사용자가 환경 변수(강수량, 수위 등)를 조절하여 재난 상황을 인터랙티브하게 체험.

## 2. 현재 상태 (기반 구축 완료)
- [x] Cesium 3D Viewport 연동 완료
- [x] RainSystem.jsx (파티클 기반 강우 효과) 구현
- [x] RainControl.jsx (강수량 슬라이더) 구현
- [x] 강남역 중심 카메라 초기화 설정 완료
- [x] WaterLevelControl.jsx (수위 슬라이더) 구현
- [x] FloodVisualization.jsx (3D 수위 시각화 + 물결 애니메이션) 구현
- [x] `FloodModule` viewer `useRef` 패턴 적용 (슬라이더 조절 시 뷰어·카메라 유지)

## 3. 핵심 기술 제약 사항 (중요)
- **State Management**: Cesium 뷰어 인스턴스는 반드시 `useRef`로 관리하여 컴포넌트 재렌더링 시 초기화되지 않도록 유지할 것. (`FloodModule.viewerRef` → `RainSystem` / `FloodVisualization`에 전달)
- **Rendering**: Cesium 뷰어는 `CesiumMapViewer`에서 단 한 번만 마운트. 슬라이더 등 UI state 변경 시 `useEffect`로 뷰어 **내부** 객체(emissionRate, extrudedHeight 등)만 수정할 것.

## 4. 진행 순서 (Roadmap)
1. **[현재 작업] 범람 엔진 고도화**:
   - [x] `WaterLevelControl.jsx` 추가.
   - [x] Entity polygon + extrudedHeight 3D 수위 시각화.
   - [ ] 수위 시뮬레이션 정밀도·범위 튜닝, 지형 연동 개선.
2. **모듈화 정리**: 
   - 모든 재난 컴포넌트를 `src/modules/` 하위로 구조화.
3. **다음 재난 모듈**:
   - 지진(Earthquake) 파동 효과 추가.