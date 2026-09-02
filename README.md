# 오디세이아 — 원문과 직역

호메로스의 『오디세이아』 고대 그리스어 원문과 한국어 직역을 긴 호흡으로 읽는 정적 웹사이트입니다.

- 공개 사이트: <https://superantichrist.github.io/odyssey-reader/>
- 원문 수록 범위: 전 24권, 12,107행, 1,186개 문단
- 번역 수록 범위: 제1–6권 전체(진행 중이며 권별로 증분 공개)
- 영구 링크: 권과 행 번호를 `?book=1&line=1` 형태로 보존
- 원문·직역·출전 URL 함께 복사

## 데이터 빌드

```sh
npm ci
npm run build:data
npm run check
```

`scripts/build_data.py`가 고정한 TEI 원문과 별도 번역 파일을 결합하여 `public/data/` 아래 정적 JSON을 만듭니다. 빌드는 원문 해시, 권·행·문단 수, 행의 중복·누락, 알려진 원전 행 번호 공백을 검증합니다.

원문을 다시 내려받아 고정 해시까지 확인하려면 `python scripts/fetch_source.py`를 실행합니다. 해시가 다르면 기존 파일을 덮어쓰지 않습니다.

GitHub Pages용 결과물은 `NEXT_PUBLIC_BASE_PATH=/odyssey-reader npm run check:pages`로 만들며, 배포 워크플로가 이 과정을 자동 실행합니다.

## 출처와 이용 조건

원문 판본, 고정 커밋, 해시와 라이선스는 [`sources/source.json`](sources/source.json)에 기록되어 있습니다. 자세한 재사용 조건은 [`LICENSES.md`](LICENSES.md)를 확인하십시오.
