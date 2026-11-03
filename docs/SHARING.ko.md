# GitHub 업로드·공유 안내

## 가장 간단한 방법: 브라우저에서 업로드

1. 압축파일을 풉니다.
2. GitHub에 새 저장소를 만듭니다. 추천 이름: `surface-compute-lab`.
3. **Add file → Upload files**에서 압축을 푼 폴더의 **내용물**을 올립니다. ZIP 자체나 상위 폴더 하나만 올리지 않습니다.
4. `docs/index.html`이 저장소에 있는지 확인하고 `main`에 저장합니다.
5. **Settings → Pages → Build and deployment → Source**를 **Deploy from a branch**로 선택합니다.
6. Branch는 **main**, Folder는 **/docs**로 선택하고 저장합니다.
7. 배포가 끝난 뒤 Pages에 표시되는 주소를 학생들과 공유합니다.

`docs/index.html`은 미리 만들어진 실행 페이지입니다. 별도 설치 없이 브라우저에서 볼 수 있으며 외부 뷰어 리소스 로드를 위해 인터넷 연결이 필요합니다.

## 업데이트를 자동 배포하려면

숨김 폴더 `.github`까지 업로드한 뒤 Pages의 Source를 **GitHub Actions**로 선택합니다. 포함된 작업이 `src/app.html`을 페이지로 만들어 배포합니다. `main`에 수정사항을 저장하면 다시 실행됩니다. 첫 업로드 전에 실행이 실패했다면 설정 후 Actions에서 다시 실행하면 됩니다.

## 학생이 수정할 위치

- `src/app.html`: 화면 구성, 한·영 번역, 문헌 목록, 시연 기능.
- `data/literature-seed.json`: 초기 문헌 조사 데이터. 현재 앱의 내장 문헌 목록과 자동 동기화되지는 않으므로 함께 갱신해야 합니다.
- 수정 후 `python tools/build.py`를 실행하면 `site/index.html`과 `docs/index.html`이 갱신됩니다.
- 계산 서버 주소·계정·인증·라이선스 파일을 넣은 실운영 버전은 별도 개발 대상입니다.

## 현재 공유되는 것

한·영 전환, 문헌 검색, DFT 조건 입력과 입력 초안, Cluster 실행 시연, 합성 결과 표시, Kinetics 후처리 예제를 공유합니다. 실시간 다중 사용자 데이터 공유나 실제 계산 서버 연결은 없습니다. 각 사용자의 선택·상태는 브라우저에 보관됩니다.

실제 VASP/QE 입력으로 사용하기 전에 구조·potential·수렴·서버 설정 검증이 필요합니다. 문헌 반응 장벽은 미확인 수치를 채우지 않았으며 결과 그래프와 예시 ΔG‡는 합성 데이터입니다.

GitHub Pages 지원 범위는 요금제·조직 설정에 따라 달라집니다. 최신 설정은 [GitHub 공식 문서](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)를 참고하세요.
