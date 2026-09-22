// 서비스 아이콘(파비콘, 설치 아이콘, 공유 미리보기 이미지)을 scripts/icon-source.jpg 한 장에서 만든다.
//   node scripts/gen-icons.mjs
import sharp from 'sharp'
import { mkdirSync, writeFileSync } from 'node:fs'

const SOURCE = 'scripts/icon-source.jpg'
const BG = { r: 251, g: 127, b: 91 } // 원본 그림의 배경색 (#FB7F5B)

// 얼굴 원(지름 약 2370px)을 중심으로 자른 정사각형 영역 (원본 3832x2748 기준)
const CROP = { left: 681, top: 30, width: 2500, height: 2500 }

// 얼굴 원만 동그랗게 잘라낸 영역: 몸통이 잘려 생기는 직선 경계를 없애고 배경색 위에 얼굴만 올릴 때 쓴다.
const BALL = { left: 731, top: 80, size: 2400 }

mkdirSync('public/icons', { recursive: true })

const square = () => sharp(SOURCE).extract(CROP)

/** 일반 아이콘: 자른 그림을 꽉 채우고 모서리만 둥글게. */
async function rounded(size) {
  const r = Math.round(size * 0.22)
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}"/></svg>`,
  )
  return square()
    .resize(size, size)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** 얼굴 원만 동그랗게 잘라 `size`px 크기로 (바깥은 투명). */
async function ball(size) {
  const mask = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/></svg>`,
  )
  return sharp(SOURCE)
    .extract({ left: BALL.left, top: BALL.top, width: BALL.size, height: BALL.size })
    .resize(size, size)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer()
}

/** 마스크용 아이콘: 안드로이드가 원/둥근 사각형으로 잘라도 얼굴이 안 잘리게, 얼굴을 안전 영역(중앙 약 66%) 안에 넣는다. */
async function maskable(size) {
  return sharp({ create: { width: size, height: size, channels: 3, background: BG } })
    .composite([{ input: await ball(Math.round(size * 0.68)), gravity: 'centre' }])
    .png()
    .toBuffer()
}

/** iOS는 알아서 모서리를 둥글게 하므로 투명 없이 꽉 채운다. */
const appleTouch = (size) => square().resize(size, size).png().toBuffer()

/** PNG 이미지들을 담은 .ico 파일을 만든다. */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(entries.length, 4)
  let offset = 6 + entries.length * 16
  const dirs = entries.map(({ size, data }) => {
    const dir = Buffer.alloc(16)
    dir.writeUInt8(size >= 256 ? 0 : size, 0)
    dir.writeUInt8(size >= 256 ? 0 : size, 1)
    dir.writeUInt16LE(1, 4)
    dir.writeUInt16LE(32, 6)
    dir.writeUInt32LE(data.length, 8)
    dir.writeUInt32LE(offset, 12)
    offset += data.length
    return dir
  })
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.data)])
}

const write = (path, data) => {
  writeFileSync(path, data)
  console.log('generated', path)
}

write('public/icons/icon-192.png', await rounded(192))
write('public/icons/icon-512.png', await rounded(512))
write('public/icons/apple-touch-icon.png', await appleTouch(180))
write('public/icons/icon-maskable-192.png', await maskable(192))
write('public/icons/icon-maskable-512.png', await maskable(512))

// 파비콘: 작은 크기에서도 알아보도록 그림을 꽉 채운다 (둥근 모서리 없음).
const favSizes = [16, 32, 48]
const favs = await Promise.all(favSizes.map(async (size) => ({ size, data: await appleTouch(size) })))
write('public/favicon.ico', buildIco(favs))

// 링크 공유(카카오톡 등) 미리보기 이미지 1200x630
const OG_W = 1200
const OG_H = 630
const art = await ball(540)
const text = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}">
  <style>
    .t { font-family: 'Malgun Gothic', 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif; fill: #fff; }
  </style>
  <text class="t" x="640" y="290" font-size="104" font-weight="800">JunsVoca</text>
  <text class="t" x="644" y="372" font-size="42" font-weight="700">초등 영어 단어 테스트</text>
  <text class="t" x="644" y="436" font-size="30" opacity="0.92">단어장 만들고 · 시험 보고 · 오답 노트</text>
</svg>`)
await sharp({ create: { width: OG_W, height: OG_H, channels: 3, background: BG } })
  .composite([
    { input: art, left: 70, top: 45 },
    { input: text, left: 0, top: 0 },
  ])
  .png()
  .toFile('public/og-image.png')
console.log('generated public/og-image.png')
