# Surface Compute Lab — 초기 DB 조사 및 모듈 구성

조사일: 2026-11-03. 목적: 소그룹의 문헌·계산 데이터 축적, DFT 실행 인터페이스, Kinetics–COMSOL 후처리 연계. 회의 운영·논문 작성 기능은 범위에서 제외한다.

## 1. 초기 자료 목록

| ID | 출처 | 초기 DB에 반영한 내용 | 후속 확인 |
|---|---|---|---|
| L01 | Oberg et al., *Carbon* 178 (2021) 606–615. [논문](https://doi.org/10.1016/j.carbon.2021.03.008), [공개 사전원고](https://arxiv.org/abs/2011.04921) | 표면 매입 N, C–N dimer의 탄소 편입·층 핵생성 경로 | 원문·SI의 구조, 함수, 장벽, 온도와 보정. 약 400배 향상은 특정 단계의 보고값이며 전체 성장률에 적용하지 않음 |
| L02 | Ashfold & Mankelevich, *Diamond Relat. Mater.* 137 (2023) 110097. [논문](https://doi.org/10.1016/j.diamond.2023.110097), [저자 공개본](https://www.chm.bris.ac.uk/pt/diamond/pdf/drm137-110097.pdf) | 국소 기상 분포·성장률 모델, N anchor와 CH₂ 이동·편입의 가설 | §3 성장률식, §4 메커니즘, 조건별 유효 범위. anchor는 검증 대상 가설 |
| L03 | Sabadell-Rendón et al., *Digital Discovery* 2 (2023) 1721–1732. [논문](https://doi.org/10.1039/D3DD00163F), [AMUSE 코드](https://github.com/LopezGroup-ICIQ/amuse) | DFT 결과→반응망→microkinetics→CFD 연결, AutoProfLib·PyMKM | 공개 튜토리얼 재현, VASP 의존부와 diamond 성장 적용부 구분. COMSOL용 구현은 별도 |
| L04 | Wang et al., *npj Computational Materials* 12, 72 (2026). [논문](https://doi.org/10.1038/s41524-025-01936-4), [코드](https://github.com/aiidalab/aiidalab-qe) | 구조·조건 입력, HPC 제출·모니터링·결과 조회의 웹 인터페이스 사례 | 그룹 서버·엔진 지원, 표면 반응·NEB를 위한 확장 범위 |
| D01 | [VASP 공식 입출력 문서](https://vasp.at/wiki/Input_and_Output_-_a_short_Intro) | INCAR/POSCAR/KPOINTS/POTCAR, OUTCAR/OSZICAR/CONTCAR 등 | 설치 버전·허가된 POTCAR 라이브러리·종 순서·checksum |
| D02 | QE 공식 [pw.x](https://www.quantum-espresso.org/Doc/INPUT_PW.html), [neb.x](https://www.quantum-espresso.org/Doc/INPUT_NEB.html) | namelist, 종·셀·좌표·k-point 카드, NEB 이미지 입력 | 엔진 버전·UPF, nat/ntyp, spin·전하, 단위와 경로 검증 |
| D03 | [COMSOL 공식 앱 예제](https://doc.comsol.com/6.3/doc/com.comsol.help.comsol/application_builder_introduction.08.120.html) | Tubular Reactor 등 제한된 입력·출력으로 모델을 실행하는 앱 사례 | 그룹 보유 버전·모듈·실제 모델 변수와 외부 데이터 연결 |

서지·초록·공개 설명과 공식 코드/규격을 확인한 초기 목록이다. 모든 논문의 수치와 SI를 전수 검증한 데이터베이스는 아니다. 정량 장벽 필드는 null로 두었다. 문헌 수치와 합성 UI 시연 데이터는 분리한다. 공개 코드의 실행·성능 재현은 아직 수행하지 않았다.

## 2. 반응 DB의 초기 수집 대상

1. H abstraction/passivation: 활성 site 생성·소멸.
2. CH₃ adsorption: 탄소 공급종의 표면 포획.
3. CH₂ migration: N 위치에 따른 이동 경로·장벽과 anchor 가설.
4. Dimer opening/closing: 탄소 편입 및 층 핵생성.
5. N incorporation/burial: N 활성 상태의 생성·소멸과 성장 중 변화.

각 항목에 출처·원문 위치·표면 방향/재구성·종결 상태·N 위치·피복률·반응물/생성물/TS 구조·함수·potential 버전·cutoff/단위·k-grid·spin/전하·ΔE‡·ZPE/열 보정·ΔG‡(T)·검토 상태를 저장한다. 보고값, 재계산값, 추정값을 구분한다.

## 3. 모듈 경계

**문헌 DB → 문제 정의·조건 → 입력 생성 → Cluster 실행 → 결과 회수·파싱 → 후처리·연계**

- 문제 정의: 무엇을 비교하는지, 근거 문헌, 목표 물리량, 표면 구조와 N 상태를 기록.
- 입력 생성: 공통 과학 조건을 엔진별 입력으로 매핑. VASP와 QE의 cutoff·SCF 기준은 숫자만 복사하지 않음. 구조·potential·수렴 검증 없이는 실제 제출을 차단.
- Cluster: SSH/파일 전송·스케줄러 어댑터로 분리. 서버 프로필, Slurm/PBS, job ID, 로그, 재시도·취소, 결과 회수, checksum과 실행 이력 관리. 인증 정보는 연구 데이터에 넣지 않음.
- 결과: 종료 코드와 과학적 수렴을 별도로 판정. 에너지·힘·구조·반응 경로를 표시하고 원본 출력과 연결. NEB 장벽과 TS 진동 검증은 별개.
- 후처리: 전자에너지 ΔE‡를 자유에너지 ΔG‡로 바로 사용하지 않음. ZPE·진동·온도·표준상태와 정/역반응 일관성을 확인한 뒤 속도상수 생성.
- COMSOL: k(T)만으로 표면 플럭스가 완성되지 않음. 반응식·site density·피복률·기상종 공급을 포함한 순속도 모델과 단위·부호·면적 기준을 정의. 처음에는 CSV/JSON/식으로 전달하고 실제 모델 매핑을 검증.

## 4. 목업에서 동작하는 범위

자료 검색·선택, 문제 정의·조건 변경, VASP/QE 입력 **초안** 미리보기·다운로드, Slurm/PBS 실행 단계 **시연**, 합성 결과 표시, 예시 ΔG‡와 온도를 바꾸는 TST 계산, JSON/CSV 예시 출력.

원자 구조 업로드는 파일명 표시만 수행한다. 미등록 구조·potential의 자리를 임의 생성하지 않는다. 실제 SSH 접속·파일 전송·VASP/QE 실행·실제 출력 파싱·COMSOL 실행은 미연결이다. 서버에 연결할 때에는 보유 엔진과 라이브러리, 검증된 구조·수렴 조건, 인증 및 스케줄러 설정이 필요하다.

## 5. 다음 구현에서 필요한 그룹 정보

- Cluster 주소·접속 방식·Slurm/PBS·queue/partition·작업 디렉터리·자원 제한.
- VASP/QE 설치 버전·실행 명령·모듈·POTCAR/UPF 라이브러리.
- 첫 재현 대상으로 사용할 검증된 표면 구조와 기존 입력·출력 한 세트.
- COMSOL 버전·모듈·기준 모델과 필요한 속도식·변수명·입출력 단위.

## 검증 기록

스크립트 문법 및 로직 점검: 6개 화면 생성, VASP/QE 설정 매핑, NEB 초안, Slurm/PBS 초안 분기, 실행 상태 시연, 합성 결과 표시, 온도에 따른 TST 갱신, 문헌값 미등록 시 후처리 제한을 확인했다. 현재 환경에서 브라우저 프로세스 실행이 제한되어 실제 렌더링·다운로드·모바일 배치의 브라우저 검증은 완료하지 못했다.
