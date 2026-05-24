/**
 * 지진 진도 계산 대상 주요 도시 — 전국 분포 12곳
 * population: 시·광역시 인구 근사 (2023 통계청 기준, 교육용)
 * 참조: earthquake-plan.md §5
 */

export const EARTHQUAKE_IMPACT_CITIES = [
  { id: 'seoul',    label: '서울',  lat: 37.566, lon: 126.978, population: 9_427_000 },
  { id: 'busan',    label: '부산',  lat: 35.180, lon: 129.075, population: 3_304_000 },
  { id: 'daegu',    label: '대구',  lat: 35.872, lon: 128.602, population: 2_367_000 },
  { id: 'incheon',  label: '인천',  lat: 37.456, lon: 126.705, population: 2_941_000 },
  { id: 'gwangju',  label: '광주',  lat: 35.160, lon: 126.852, population: 1_485_000 },
  { id: 'daejeon',  label: '대전',  lat: 36.350, lon: 127.385, population: 1_468_000 },
  { id: 'ulsan',    label: '울산',  lat: 35.538, lon: 129.311, population: 1_121_000 },
  { id: 'gyeongju', label: '경주',  lat: 35.855, lon: 129.225, population: 259_000 },
  { id: 'pohang',   label: '포항',  lat: 36.019, lon: 129.343, population: 508_000 },
  { id: 'jeonju',   label: '전주',  lat: 35.824, lon: 127.148, population: 652_000 },
  { id: 'changwon', label: '창원',  lat: 35.228, lon: 128.681, population: 1_027_000 },
  { id: 'jeju',     label: '제주',  lat: 33.499, lon: 126.531, population: 674_000 },
]
