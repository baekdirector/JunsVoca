# JunsVoca

초등학교 고학년~중학교 대비 영어 단어/숙어 학습을 위한 PWA 웹앱입니다.

학원 프린트물을 사진으로 찍으면 OCR로 단어와 뜻을 추출하고, 추출된 단어로
스펠링 쓰기 / 뜻 쓰기 두 가지 유형의 문제를 랜덤으로 출제합니다. 틀린 문제는
전부 맞을 때까지 반복 라운드로 다시 출제됩니다. 부모는 별도 기기에서도
테이블 형태로 학습 이력과 정답률을 확인할 수 있습니다 (서버 DB 공유).

화면 디자인 시안: 이 프로젝트의 Design 아티팩트 참고.

## 구성

- **프론트엔드**: Vite + React + TypeScript + Tailwind, PWA(installable)
- **백엔드**: Express (`server/`), 정적 빌드 결과물(`dist/`)도 같은 서버가 서빙
- **DB**: PostgreSQL (Neon 등 어떤 Postgres도 가능) — `DATABASE_URL` 환경변수 하나로 연결

## 로컬 개발

```bash
npm install
cp .env.example .env   # DATABASE_URL을 로컬/Neon 연결 문자열로 채우기
npm run build           # 프론트엔드 빌드 (dist/)
npm start                # Express 서버 실행 (:3000) — API + 정적 파일 서빙
```

프론트엔드만 빠르게 수정하며 볼 때는 `npm run dev` (Vite dev 서버, `:5173`)를
쓰되, API 호출은 같은 오리진을 기대하므로 백엔드도 별도 포트로 함께 띄워두고
Vite 프록시 설정이 필요할 수 있습니다.

## 배포 (Render)

저장소 루트의 `render.yaml`을 Render의 **New → Blueprint**로 연결하면
빌드/실행 명령이 자동 설정됩니다. 배포 전 Render 대시보드에서
`DATABASE_URL` 환경변수에 Postgres(Neon) connection string만 넣어주면 됩니다.
