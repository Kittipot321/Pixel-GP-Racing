// UI text for every supported language.
//
// Thai (`th`) is the source dictionary and the default language; English
// (`en`) must provide exactly the same keys, which the `Messages` type
// enforces at compile time. Entries that need a value are functions.
//
// The API and the shared validation schemas send English messages. Thai
// translates the known ones through `apiMessage`; an unknown message is shown
// as sent rather than hidden.

import type { CarColor } from '@pixel-race/shared-types';

export const LANGUAGES = ['th', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = 'th';

/** English messages from the API and shared schemas, with their Thai text. */
const TH_API_MESSAGES: Record<string, string> = {
  'Username must be at least 3 characters': 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร',
  'Username must be at most 32 characters': 'ชื่อผู้ใช้ต้องไม่เกิน 32 ตัวอักษร',
  'Username may contain only letters, numbers, "_" and "-"':
    'ชื่อผู้ใช้ใช้ได้เฉพาะตัวอักษรภาษาอังกฤษ ตัวเลข "_" และ "-"',
  'A valid email address is required': 'กรุณากรอกอีเมลให้ถูกต้อง',
  'Email is too long': 'อีเมลยาวเกินไป',
  'Password must be at least 8 characters': 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
  'Password must be at most 128 characters': 'รหัสผ่านต้องไม่เกิน 128 ตัวอักษร',
  'Username or email is required': 'กรุณากรอกชื่อผู้ใช้หรืออีเมล',
  'Password is required': 'กรุณากรอกรหัสผ่าน',
  'Username or email is already taken': 'ชื่อผู้ใช้หรืออีเมลนี้ถูกใช้แล้ว',
  'Invalid username/email or password': 'ชื่อผู้ใช้/อีเมล หรือรหัสผ่านไม่ถูกต้อง',
  'This race is no longer accepting guesses': 'รอบนี้ไม่รับคำทายแล้ว',
  'You have already guessed in this race': 'คุณทายในรอบนี้ไปแล้ว',
};

const th = {
  apiMessage: (message: string): string => TH_API_MESSAGES[message] ?? message,
  common: {
    authChecking: 'กำลังตรวจสอบการเข้าสู่ระบบ…',
    close: 'ปิด',
    loading: 'กำลังโหลด…',
    prev: 'ก่อนหน้า',
    next: 'ถัดไป',
    pageStatus: (page: number, total: number) => `หน้า ${page} / ${total}`,
    or: 'หรือ',
    playAsGuest: 'เล่นแบบ Guest',
    noScoreSaved: '(ไม่บันทึกคะแนน)',
    login: 'เข้าสู่ระบบ',
    register: 'สมัครสมาชิก',
  },
  language: {
    groupLabel: 'ภาษา',
  },
  seo: {
    tagline: 'เกมทายผลแข่งรถ F1 พิกเซล',
  },
  theme: {
    toggle: 'โหมดมืด',
    toLight: 'เปลี่ยนเป็นโหมดสว่าง',
    toDark: 'เปลี่ยนเป็นโหมดมืด',
  },
  nav: {
    play: 'เล่นเกม',
    leaderboard: 'อันดับ',
    profile: 'โปรไฟล์',
    logout: 'ออกจากระบบ',
    menu: 'เปิดเมนู',
    closeMenu: 'ปิดเมนู',
  },
  donate: {
    ariaLabel: 'Buy me a coffee (เปิดในแท็บใหม่)',
  },
  login: {
    identifier: 'ชื่อผู้ใช้หรืออีเมล',
    password: 'รหัสผ่าน',
    incomplete: 'กรุณากรอกข้อมูลให้ครบถ้วน',
    failed: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่',
    submitting: 'กำลังเข้าสู่ระบบ…',
    noAccount: 'ยังไม่มีบัญชี?',
  },
  register: {
    username: 'ชื่อผู้ใช้',
    email: 'อีเมล',
    password: 'รหัสผ่าน',
    invalid: 'กรุณากรอกข้อมูลให้ถูกต้อง',
    failed: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่',
    submitting: 'กำลังสมัคร…',
    haveAccount: 'มีบัญชีอยู่แล้ว?',
  },
  leaderboard: {
    title: 'กระดานอันดับ',
    daily: 'วันนี้',
    allTime: 'ตลอดกาล',
    loadFailed: 'โหลดอันดับไม่สำเร็จ',
    empty: 'ยังไม่มีคะแนนในช่วงเวลานี้',
    colRank: 'อันดับ',
    colPlayer: 'ผู้เล่น',
    colTotal: 'คะแนนรวม',
  },
  profile: {
    title: (username: string | null) => (username ? `โปรไฟล์ ของ ${username}` : 'โปรไฟล์'),
    statsLoading: 'กำลังโหลดสถิติ…',
    statsError: 'โหลดสถิติไม่สำเร็จ',
    totalPoints: 'คะแนนรวม',
    settledRaces: 'รอบที่จบแล้ว',
    correctGuesses: 'ทายถูก',
    accuracy: 'ความแม่นยำ',
    historyTitle: 'ประวัติการแข่ง',
    historyLoading: 'กำลังโหลดประวัติ…',
    historyError: 'โหลดประวัติไม่สำเร็จ',
    historyEmpty: 'ยังไม่มีประวัติการแข่ง',
    colGuess: 'ทาย',
    colWinner: 'ผู้ชนะ',
    colResult: 'ผล',
    colPoints: 'คะแนน',
    correct: 'ถูก',
    wrong: 'ผิด',
  },
  cars: {
    RED: 'แดง',
    YELLOW: 'เหลือง',
    BLUE: 'น้ำเงิน',
    WHITE: 'ขาว',
  } as Record<CarColor, string>,
  play: {
    startGame: 'เริ่มเกม',
    creatingRound: 'กำลังสร้างรอบ…',
    racing: 'กำลังแข่ง…',
    resultTitle: 'ผลการแข่ง',
    winner: 'ผู้ชนะ:',
    guessedRight: 'คุณทายถูก! 🎉',
    guessedWrong: 'คุณทายผิด ❌',
    tryAgain: 'ลองอีกครั้ง',
    pickTitle: 'เลือกรถ',
    confirmTitle: '? ยืนยันคำตอบ',
    pickPrompt: 'เลือกสีรถที่คิดว่าจะชนะ',
    submitGuess: 'ส่งคำตอบ',
    selectedCar: 'รถที่เลือก:',
    changeCar: 'เปลี่ยนรถ',
    waitingResult: 'รอผลการแข่ง…',
    yourGuess: 'คำตอบของคุณ:',
    back: 'ย้อนกลับ',
    confirming: 'กำลังยืนยัน…',
    confirm: 'ยืนยันคำตอบ',
    confirmFailed: 'ยืนยันคำตอบไม่สำเร็จ',
    confirmFailedRetry: 'ยืนยันคำตอบไม่สำเร็จ กรุณาลองใหม่',
    createFailed: 'สร้างรอบใหม่ไม่สำเร็จ',
    raceMismatch: 'รอบแข่งไม่ตรงกัน',
    guestBanner: 'คุณกำลังเล่นแบบ Guest ผลการแข่งจะไม่ถูกบันทึกและไม่มีคะแนนสะสม',
    guestModeBanner:
      'สามารถเล่นเกมได้ทันที โดยระบบการบันทึกผลและคะแนนสะสม จะพร้อมให้บริการได้ (เร็วๆ นี้)',
    guestInvite: 'อยากเก็บคะแนนและติดอันดับ?',
  },
  game: {
    sound: 'เสียงเกม',
    mute: 'ปิดเสียง',
    unmute: 'เปิดเสียง',
    fullscreen: 'เต็มจอ',
    exitFullscreen: 'ออกจากเต็มจอ',
  },
  landing: {
    navLabel: 'เมนูหน้าแรก',
    guide: 'คู่มือการเล่น',
    playNow: 'เล่นเกมเลย!',
    heroSlogan: 'เกมทายผลแข่งรถ F1 พิกเซล ลุ้นให้สุดใน 15 วินาที',
    heroIntro:
      'เลือกรถหนึ่งในสี่สีที่คิดว่าจะเข้าเส้นชัยก่อน แล้วดูการแข่งสไตล์ Retro ลุ้นไปจนโค้งสุดท้าย',
    heroIntro2: 'เล่นฟรีบนเบราว์เซอร์ ไม่ต้องดาวน์โหลด ไม่ต้องสมัครก็เล่นได้ทันที',
    heroCta: 'คลิกเพื่อเริ่มเล่นทันที',
    whyTitle: 'ทำไมต้องเล่นเกมนี้?',
    features: [
      {
        icon: '🌐',
        title: 'เล่นฟรีบนเว็บ',
        body: 'เปิดเบราว์เซอร์ก็เล่นได้เลย ไม่ต้องดาวน์โหลด และเล่นแบบ Guest ได้โดยไม่ต้องสมัคร',
      },
      {
        icon: '👾',
        title: 'ภาพพิกเซลสไตล์ Retro',
        body: 'รถ F1 พิกเซล ไฟสตาร์ท อัฒจันทร์คนดู พร้อมเสียงเครื่องยนต์และเสียงฉลองแบบ 8-bit',
      },
      {
        icon: '⏱️',
        title: 'ลุ้นจบใน 15 วินาที',
        body: 'คันนำสลับกันไปมาตลอดทาง เล่นได้ไม่จำกัดรอบ มีทั้งภาษาไทย/อังกฤษ และโหมดสว่าง/มืด',
      },
    ],
    howTitle: 'วิธีการเล่น',
    step: (n: number) => `ขั้นที่ ${n}`,
    steps: [
      {
        title: 'เลือกสีรถ',
        body: 'เลือกรถหนึ่งคันจากสี่สี แดง เหลือง น้ำเงิน หรือขาว ที่คิดว่าจะชนะ',
      },
      { title: 'กดเริ่มแข่ง', body: 'ไฟแดง 5 ดวงติดทีละดวง เมื่อไฟดับรถทั้ง 4 คันออกตัวพร้อมกัน' },
      {
        title: 'ลุ้นผู้ชนะ',
        body: 'ภายใน 15 วินาทีก็รู้ผลว่าคุณทายถูกหรือไม่ แล้วเริ่มรอบใหม่ได้ทันที',
      },
    ],
    scoreNote: 'เข้าสู่ระบบเพื่อเก็บคะแนนเมื่อทายถูกและไต่อันดับบน Leaderboard',
    galleryTitle: 'ภาพบรรยากาศในเกม',
    shots: {
      hero: 'ภาพตัวอย่างการแข่งใน Pixel GP Racing',
      start: 'ไฟสตาร์ท 5 ดวงก่อนออกตัว',
      race: 'รถ F1 สี่สีชิงตำแหน่งกลางสนาม',
      finish: 'ผู้ชนะเข้าเส้นชัยธงตาหมากรุก',
    },
    finalTitle: 'พร้อมลุ้นแล้วหรือยัง?',
    finalCta: 'เล่นเกมฟรีได้เลยตอนนี้!',
    footerRights: 'สงวนลิขสิทธิ์',
    footerPowered: 'By TopChoco',
    socialLabel: 'ช่องทางโซเชียล',
    legalLabel: 'ข้อกำหนด',
    terms: 'ข้อตกลงการใช้งาน',
    privacy: 'นโยบายความเป็นส่วนตัว',
  },
};

export type Messages = typeof th;

const en: Messages = {
  apiMessage: (message: string): string => message,
  common: {
    authChecking: 'Checking your login…',
    close: 'Close',
    loading: 'Loading…',
    prev: 'Previous',
    next: 'Next',
    pageStatus: (page: number, total: number) => `Page ${page} / ${total}`,
    or: 'or',
    playAsGuest: 'play as a guest',
    noScoreSaved: '(scores are not saved)',
    login: 'Log in',
    register: 'Sign up',
  },
  language: {
    groupLabel: 'Language',
  },
  seo: {
    tagline: 'Pixel F1 race prediction game',
  },
  theme: {
    toggle: 'Dark mode',
    toLight: 'Switch to light mode',
    toDark: 'Switch to dark mode',
  },
  nav: {
    play: 'Play',
    leaderboard: 'Leaderboard',
    profile: 'Profile',
    logout: 'Log out',
    menu: 'Open menu',
    closeMenu: 'Close menu',
  },
  donate: {
    ariaLabel: 'Buy me a coffee (opens in a new tab)',
  },
  login: {
    identifier: 'Username or email',
    password: 'Password',
    incomplete: 'Please fill in all fields',
    failed: 'Login failed. Please try again.',
    submitting: 'Logging in…',
    noAccount: "Don't have an account?",
  },
  register: {
    username: 'Username',
    email: 'Email',
    password: 'Password',
    invalid: 'Please check your details',
    failed: 'Sign-up failed. Please try again.',
    submitting: 'Signing up…',
    haveAccount: 'Already have an account?',
  },
  leaderboard: {
    title: 'Leaderboard',
    daily: 'Today',
    allTime: 'All time',
    loadFailed: 'Could not load the leaderboard',
    empty: 'No scores for this period yet',
    colRank: 'Rank',
    colPlayer: 'Player',
    colTotal: 'Total points',
  },
  profile: {
    title: (username: string | null) => (username ? `${username}'s profile` : 'Profile'),
    statsLoading: 'Loading stats…',
    statsError: 'Could not load stats',
    totalPoints: 'Total points',
    settledRaces: 'Races finished',
    correctGuesses: 'Correct guesses',
    accuracy: 'Accuracy',
    historyTitle: 'Race history',
    historyLoading: 'Loading history…',
    historyError: 'Could not load history',
    historyEmpty: 'No races yet',
    colGuess: 'Guess',
    colWinner: 'Winner',
    colResult: 'Result',
    colPoints: 'Points',
    correct: 'Correct',
    wrong: 'Wrong',
  },
  cars: {
    RED: 'Red',
    YELLOW: 'Yellow',
    BLUE: 'Blue',
    WHITE: 'White',
  },
  play: {
    startGame: 'Start game',
    creatingRound: 'Creating round…',
    racing: 'Racing…',
    resultTitle: 'Race result',
    winner: 'Winner:',
    guessedRight: 'You guessed right! 🎉',
    guessedWrong: 'Wrong guess ❌',
    tryAgain: 'Try again',
    pickTitle: 'Pick a car',
    confirmTitle: '? Confirm your answer',
    pickPrompt: 'Pick the car color you think will win',
    submitGuess: 'Submit guess',
    selectedCar: 'Your pick:',
    changeCar: 'Change car',
    waitingResult: 'Waiting for result…',
    yourGuess: 'Your guess:',
    back: 'Back',
    confirming: 'Confirming…',
    confirm: 'Confirm answer',
    confirmFailed: 'Could not confirm your answer',
    confirmFailedRetry: 'Could not confirm your answer. Please try again.',
    createFailed: 'Could not create a new round',
    raceMismatch: 'Race does not match',
    guestBanner: "You're playing as a guest. Race results are not saved and no points are earned.",
    guestInvite: 'Want to keep score and climb the leaderboard?',
    guestModeBanner:
      'You can enjoy it right now!. Saving results and earning points will be available soon.',
  },
  game: {
    sound: 'Game sound',
    mute: 'Mute',
    unmute: 'Unmute',
    fullscreen: 'Fullscreen',
    exitFullscreen: 'Exit fullscreen',
  },
  landing: {
    navLabel: 'Home menu',
    guide: 'How to play',
    playNow: 'Play now!',
    heroSlogan: 'The pixel F1 race prediction game, decided in 15 seconds',
    heroIntro:
      'Pick which of the four cars will cross the line first, then watch a retro race that stays close to the final corner.',
    heroIntro2: 'Free in your browser. No download, no sign-up needed to start.',
    heroCta: 'Click to start playing',
    whyTitle: 'Why play?',
    features: [
      {
        icon: '🌐',
        title: 'Free on the web',
        body: 'Open your browser and play. Nothing to download, and guests can play without an account.',
      },
      {
        icon: '👾',
        title: 'Retro pixel art',
        body: 'Pixel F1 cars, start lights and a cheering crowd, with 8-bit engine sounds and a finish fanfare.',
      },
      {
        icon: '⏱️',
        title: 'Over in 15 seconds',
        body: 'The lead keeps changing. Play as many rounds as you like, in Thai or English, light or dark.',
      },
    ],
    howTitle: 'How to play',
    step: (n: number) => `Step ${n}`,
    steps: [
      {
        title: 'Pick a color',
        body: 'Choose the car you think will win: red, yellow, blue or white.',
      },
      {
        title: 'Start the race',
        body: 'Five red lights come on one by one. Lights out, and all four cars go.',
      },
      {
        title: 'Cheer the winner',
        body: 'Within 15 seconds you know if you were right. Start a new round straight away.',
      },
    ],
    scoreNote: 'Log in to earn points for correct guesses and climb the leaderboard.',
    galleryTitle: 'Screenshots',
    shots: {
      hero: 'A race in Pixel GP Racing',
      start: 'Five start lights before the launch',
      race: 'Four F1 cars fighting for the lead',
      finish: 'The winner crosses the checkered line',
    },
    finalTitle: 'Ready to race?',
    finalCta: 'Play free right now!',
    footerRights: 'All rights reserved.',
    footerPowered: 'By TopChoco',
    socialLabel: 'Social links',
    legalLabel: 'Legal',
    terms: 'Terms of use',
    privacy: 'Privacy policy',
  },
};

export const MESSAGES: Record<Language, Messages> = { th, en };

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}
