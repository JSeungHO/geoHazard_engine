/**
 * 지진 진도 모델 검증용 관측 자료 — 출처가 확인된 값만 수록한다.
 * 상세: docs/model.md §2.3
 *
 * mmi: 관측 진도(정수). minMmi: "유감" 등 하한만 알려진 경우.
 * magnitude: 앱 프리셋과 같은 기상청 국지규모(ML). USGS 모멘트규모(Mw)는 참고용.
 */
export const OBSERVED_INTENSITIES = [
  {
    eventId: 'gyeongju_2016',
    label: '2016.9.12 경주',
    ml: 5.8,
    mw: 5.4,
    observations: [
      {
        cityId: 'gyeongju',
        mmi: 6,
        source: '기상청 — 경주·대구 최대진도 VI (건물 심한 흔들림, 일부 유리·지붕·기와 파손)',
      },
      { cityId: 'daegu', mmi: 6, source: '기상청 — 경주·대구 최대진도 VI' },
      {
        cityId: 'seoul',
        minMmi: 2,
        source: '한국지진공학회 논문(2016) — 서울 일부 지역까지 진동 전파·감지 (유감 ≥ II)',
      },
    ],
  },
  {
    eventId: 'pohang_2017',
    label: '2017.11.15 포항',
    ml: 5.4,
    mw: 5.5,
    observations: [
      { cityId: 'pohang', mmi: 6, source: '기상청 — 최대진도 VI (경북 포항시)' },
    ],
  },
]
