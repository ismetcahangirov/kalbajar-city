/**
 * Seed data: the facts known today and a demo inventory that stands in for the
 * owner's (#7). Facts come from kalbajarcity.com and Instagram (spec §1); the
 * layout list and its room areas were read from kalbajarcity.com's
 * "Öz mənzilini seç" section on 2026-11-02. Nothing here is a constant: every
 * value is editable in the console.
 */
import { contacts } from "@/config/contacts";
import type { Translatable } from "@/i18n/content";
import type { HomeSectionContentByKey, HomeSectionKey } from "@/shared/home-sections";
import type { RoomArea, RoomKind } from "@/shared/inventory";
import { defaultLeadSettings, type SettingsKey, type SettingsValue } from "@/shared/settings";

const t = (az: string, en: string, ru: string): Translatable => ({ az, en, ru });

type RoomRow = [RoomKind, string];

export type SeedLayout = { rooms: number; areaTotal: string; roomAreas: RoomArea[] };

const layout = (rooms: number, areaTotal: string, ...rows: RoomRow[]): SeedLayout => ({
  rooms,
  areaTotal,
  roomAreas: rows.map(([kind, area]) => ({ kind, area })),
});

/** The ten plans published on kalbajarcity.com, in its order. */
export const layouts: SeedLayout[] = [
  layout(
    1,
    "62.09",
    ["living", "21.14"],
    ["kitchen", "15.45"],
    ["hall", "5.91"],
    ["bathroom", "4.38"],
    ["storage", "3.76"],
    ["balcony", "4.27"],
  ),
  layout(
    2,
    "74.40",
    ["living", "21.29"],
    ["bedroom", "15.15"],
    ["kitchen", "10.71"],
    ["hall", "6.92"],
    ["bathroom", "3.92"],
    ["balcony", "4.29"],
    ["balcony", "3.64"],
  ),
  layout(
    2,
    "102.17",
    ["living", "29.84"],
    ["bedroom", "20.39"],
    ["kitchen", "14.67"],
    ["hall", "11.99"],
    ["bathroom", "5.27"],
    ["wardrobe", "4.44"],
    ["balcony", "3.96"],
  ),
  layout(
    3,
    "104.33",
    ["living", "22.51"],
    ["bedroom", "12.50"],
    ["bedroom", "17.99"],
    ["kitchen", "13.65"],
    ["hall", "14.66"],
    ["bathroom", "5.22"],
    ["balcony", "4.29"],
    ["balcony", "3.11"],
  ),
  layout(
    3,
    "106.22",
    ["living", "25.08"],
    ["bedroom", "18.24"],
    ["bedroom", "11.29"],
    ["kitchen", "13.74"],
    ["hall", "12.11"],
    ["bathroom", "2.56"],
    ["bathroom", "3.28"],
    ["balcony", "5.19"],
    ["balcony", "3.64"],
  ),
  layout(
    3,
    "111.79",
    ["living", "25.08"],
    ["bedroom", "18.24"],
    ["bedroom", "11.29"],
    ["kitchen", "13.83"],
    ["hall", "16.22"],
    ["bathroom", "2.56"],
    ["bathroom", "4.24"],
    ["balcony", "5.19"],
    ["balcony", "3.64"],
  ),
  layout(
    3,
    "121.92",
    ["living", "29.24"],
    ["bedroom", "17.66"],
    ["bedroom", "13.62"],
    ["kitchen", "13.94"],
    ["hall", "17.36"],
    ["bathroom", "3.78"],
    ["bathroom", "6.44"],
    ["balcony", "4.13"],
    ["balcony", "3.57"],
  ),
  layout(
    4,
    "142.79",
    ["living", "26.20"],
    ["bedroom", "11.29"],
    ["bedroom", "19.20"],
    ["bedroom", "18.24"],
    ["kitchen", "13.74"],
    ["hall", "16.81"],
    ["bathroom", "4.85"],
    ["bathroom", "2.56"],
    ["bathroom", "4.24"],
    ["balcony", "3.64"],
    ["balcony", "4.27"],
    ["balcony", "5.19"],
  ),
  layout(
    4,
    "150.62",
    ["living", "29.25"],
    ["bedroom", "17.66"],
    ["bedroom", "17.72"],
    ["bedroom", "13.62"],
    ["kitchen", "15.38"],
    ["hall", "21.00"],
    ["bathroom", "3.78"],
    ["bathroom", "4.00"],
    ["bathroom", "6.44"],
    ["balcony", "4.13"],
    ["balcony", "3.57"],
  ),
  layout(
    4,
    "186.90",
    ["living", "35.35"],
    ["bedroom", "15.04"],
    ["bedroom", "18.83"],
    ["bedroom", "22.58"],
    ["kitchen", "20.98"],
    ["hall", "23.49"],
    ["bathroom", "4.50"],
    ["bathroom", "4.50"],
    ["bathroom", "4.35"],
    ["balcony", "3.66"],
    ["balcony", "4.52"],
    ["balcony", "4.52"],
    ["balcony", "3.66"],
  ),
];

/**
 * Demo structure: 6 buildings and 9 blocks are known, how the blocks split
 * between buildings and how many floors they have is not. Every row the seed
 * makes from this is `is_demo`.
 */
export const demoInventory = {
  /** Blocks per building, in building order: 6 buildings, 9 blocks. */
  blocksPerBuilding: [2, 2, 2, 1, 1, 1],
  blockCodes: ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
  floorsPerBlock: 4,
  apartmentsPerFloor: 4,
  /** The published total; the grid above has one more slot, left empty. */
  apartments: 143,
};

export const settings: { [K in SettingsKey]: SettingsValue<K> } = {
  contacts: {
    phones: [...contacts.phones],
    whatsapp: contacts.whatsapp,
    email: null,
    address: null,
    hours: null,
    coordinates: null,
  },
  socials: { instagram: contacts.instagram, facebook: null, youtube: null, tiktok: null },
  developer: {
    name: "InCity Projects",
    instagram: "https://www.instagram.com/incityprojects/",
    website: null,
  },
  complex: {
    totalArea: "22634",
    residentialArea: "14192",
    nonResidentialArea: "3603",
    landHectares: "1.13",
    apartments: 143,
    buildings: 6,
    blocks: 9,
    parkingSpaces: 160,
    amenities: [
      {
        icon: "security",
        title: t(
          "24 saat mühafizə və müşahidə kameraları",
          "24/7 security and CCTV",
          "Круглосуточная охрана и видеонаблюдение",
        ),
      },
      {
        icon: "fire-safety",
        title: t(
          "Yanğın təhlükəsizliyi sistemi",
          "Fire safety systems",
          "Системы пожарной безопасности",
        ),
      },
      { icon: "perimeter", title: t("Qapalı həyət", "Closed courtyard", "Закрытый двор") },
      {
        icon: "parking",
        title: t("Yeraltı qaraj", "Underground parking", "Подземный паркинг"),
      },
      { icon: "gas", title: t("Qaz təchizatı", "Gas supply", "Газоснабжение") },
      {
        icon: "lobby",
        title: t("Geniş giriş lobbisi", "Spacious entrance lobby", "Просторное лобби"),
      },
      {
        icon: "playground",
        title: t("Uşaq meydançası", "Children's playground", "Детская площадка"),
      },
      {
        icon: "windows",
        title: t(
          "Alüminium çərçivəli izolyasiyalı pəncərələr",
          "Insulated aluminium-framed windows",
          "Утеплённые окна в алюминиевых рамах",
        ),
      },
    ],
  },
  prices: { visible: false },
  analytics: { googleAnalyticsId: null, metaPixelId: null },
  leads: defaultLeadSettings,
  placeholders: { paths: [] },
};

/**
 * Stand-ins for the facts the owner has not decided yet (#7), by placeholder
 * path (`@/shared/placeholders`). The owner chose (2026-11-02) to fill them
 * so the pages are complete; the seed writes one only where the field is
 * empty and flags it, and the console shows the flag until a real value is
 * saved. They stay modest and generic: the town, not a street; approximate
 * travel times; a sales mailbox on the site's own domain. There is no logo
 * stand-in: a made-up logo would misrepresent the developer.
 */
export const placeholderValues = {
  "contacts.address": t(
    "Kəlbəcər şəhəri, Azərbaycan",
    "Kalbajar, Azerbaijan",
    "г. Кельбаджар, Азербайджан",
  ),
  /** The town, approximately. */
  "contacts.coordinates": { lat: 40.1053, lng: 46.0389 },
  "contacts.hours": t(
    "Bazar ertəsi–Şənbə, 10:00–19:00",
    "Monday–Saturday, 10:00–19:00",
    "Понедельник–суббота, 10:00–19:00",
  ),
  "contacts.email": "satis@kalbajarcity.com",
  "homeLocation.distances": [
    { place: t("Şəhər mərkəzi", "Town centre", "Центр города"), minutes: 5 },
    { place: t("İstisu", "Istisu", "Истису"), minutes: 40 },
    { place: t("Murovdağ aşırımı", "Murovdag pass", "Перевал Муровдаг"), minutes: 60 },
    { place: t("Gəncə", "Ganja", "Гянджа"), minutes: 150 },
    { place: t("Bakı", "Baku", "Баку"), minutes: 360 },
  ],
  "homeLocation.directions": t(
    "Bakıdan M2 magistralı ilə Gəncəyə, oradan Murovdağ aşırımından keçərək Kəlbəcərə gəlinir.",
    "From Baku, take the M2 highway to Ganja, then cross the Murovdag pass to Kalbajar.",
    "Из Баку по трассе M2 до Гянджи, затем через перевал Муровдаг в Кельбаджар.",
  ),
} satisfies Record<string, unknown>;

export const galleryCategories = [
  { slug: "eksteryer", name: t("Eksteryer", "Exterior", "Экстерьер") },
  { slug: "interyer", name: t("İnteryer", "Interior", "Интерьер") },
  { slug: "menzereler", name: t("Mənzərələr", "Views", "Виды") },
  { slug: "tikinti", name: t("Tikinti", "Construction", "Строительство") },
];

/**
 * Answers use only the facts above; the owner adds the rest in the console.
 * Numbers are placeholders (`@/shared/faq`) the site fills from the settings
 * and the layout types, so an answer follows the console when a fact changes
 * (#29). Russian puts the count after a dash, where the noun's form does not
 * depend on the number.
 */
export const faq = [
  {
    question: t(
      "Kompleksdə neçə mənzil var?",
      "How many apartments are there?",
      "Сколько квартир в комплексе?",
    ),
    answer: t(
      "Kalbajar City-də {buildings} yaşayış binasında, {blocks} blokda {apartments} mənzil var.",
      "Kalbajar City has {apartments} apartments in {buildings} residential buildings with {blocks} blocks.",
      "Квартир в Kalbajar City — {apartments}, жилых домов — {buildings}, блоков — {blocks}.",
    ),
  },
  {
    question: t(
      "Hansı planlar təklif olunur?",
      "Which layouts are available?",
      "Какие планировки предлагаются?",
    ),
    answer: t(
      "{roomsMin} otaqlıdan {roomsMax} otaqlıya qədər {layouts} plan var: sahəsi {areaMin}-dən {areaMax}-ə qədər.",
      "There are {layouts} layouts with {roomsMin} to {roomsMax} rooms, from {areaMin} to {areaMax}.",
      "Планировок — {layouts}: от {roomsMin}- до {roomsMax}-комнатных, площадью от {areaMin} до {areaMax}.",
    ),
  },
  {
    question: t("Avtomobil üçün yer varmı?", "Is there parking?", "Есть ли парковка?"),
    answer: t(
      "Bəli, kompleksdə {parking} yerlik yeraltı qaraj var.",
      "Yes, the complex has an underground car park with {parking} spaces.",
      "Да, в комплексе есть подземный паркинг. Машино-мест — {parking}.",
    ),
  },
  {
    question: t("Ərazi necə qorunur?", "How is the site secured?", "Как охраняется территория?"),
    answer: t(
      "Ərazi 24 saat mühafizə xidməti və müşahidə kameraları ilə nəzarətdə saxlanılır, həyət qapalıdır, yanğın təhlükəsizliyi sistemi var.",
      "The site has round-the-clock security and CCTV, a closed courtyard and fire safety systems.",
      "Территория под круглосуточной охраной и видеонаблюдением, двор закрытый, установлены системы пожарной безопасности.",
    ),
  },
  {
    question: t("Kompleksi kim inşa edir?", "Who is the developer?", "Кто застройщик?"),
    answer: t(
      "Kalbajar City-ni InCity Projects inşa edir.",
      "Kalbajar City is developed by InCity Projects.",
      "Застройщик Kalbajar City — InCity Projects.",
    ),
  },
  {
    question: t(
      "Mənzilə necə baxa bilərəm?",
      "How can I view an apartment?",
      "Как посмотреть квартиру?",
    ),
    answer: t(
      "Saytdakı formadan baxış üçün vaxt seçin və ya +994 12 434 32 32 nömrəsinə zəng edin.",
      "Choose a time for a viewing in the form on this site, or call +994 12 434 32 32.",
      "Выберите время просмотра в форме на сайте или позвоните по номеру +994 12 434 32 32.",
    ),
  },
];

export const homeSections: { [K in HomeSectionKey]: HomeSectionContentByKey[K] } = {
  hero: {
    title: t(
      "Sizin də dağ mənzərəli mənziliniz olsun!",
      "A home with a view of the mountains",
      "Квартира с видом на горы",
    ),
    subtitle: t(
      "Kəlbəcərdə arzularınızın yurdu.",
      "The home you have been waiting for, in Kalbajar.",
      "Дом вашей мечты в Кельбаджаре.",
    ),
    posterMediaId: null,
    videoMediaId: null,
  },
  stats: {
    items: [
      { fact: "totalArea", label: t("Ümumi sahə", "Total area", "Общая площадь") },
      { fact: "apartments", label: t("Mənzil", "Apartments", "Квартир") },
      {
        fact: "parkingSpaces",
        label: t("Yeraltı qaraj yeri", "Underground parking spaces", "Мест в подземном паркинге"),
      },
      { fact: "blocks", label: t("Blok", "Blocks", "Блоков") },
    ],
  },
  about: {
    eyebrow: t("Kompleks haqqında", "About the complex", "О комплексе"),
    title: t(
      "Biz öz yuvamıza daha uca bir səviyyədə qayıdırıq.",
      "We are coming home, to a higher standard.",
      "Мы возвращаемся домой — на новом уровне.",
    ),
    body: t(
      "Kəlbəcərin dağ silsiləsi və təbiətin təravəti ilə əhatələnən Kalbajar City dağların təbii harmoniyasını müasir memarlıqla birləşdirir. Möhtəşəm mənzərələr, təmiz hava və sakitlik: burada hər detal sakinlərin rahatlığı üçün düşünülüb.",
      "Surrounded by the mountains and fresh nature of Kalbajar, Kalbajar City brings modern architecture into harmony with the landscape. Wide views, clean air and quiet: every detail is designed around the comfort of the people who live here.",
      "Окружённый горами и свежей природой Кельбаджара, Kalbajar City соединяет современную архитектуру с гармонией гор. Простор, чистый воздух и тишина: здесь каждая деталь продумана для комфорта жителей.",
    ),
    mediaId: null,
  },
  layouts: {
    title: t("Öz mənzilinizi seçin", "Choose your apartment", "Выберите свою квартиру"),
    body: null,
  },
  amenities: {
    title: t("Rahatlıq və təhlükəsizlik", "Comfort and safety", "Комфорт и безопасность"),
  },
  card_zoom: {
    title: t("İnteryer və mənzərələr", "Interiors and views", "Интерьеры и виды"),
    items: [],
  },
  location: {
    title: t("Yerləşmə", "Location", "Расположение"),
    body: null,
    mapMediaId: null,
    directions: null,
    distances: [],
  },
  construction: {
    title: t("Tikintinin gedişatı", "Construction progress", "Ход строительства"),
  },
  process: {
    title: t("Yeni evinizə yol", "The path to your new home", "Путь к новому дому"),
    steps: [
      {
        title: t("Müraciət", "Inquiry", "Заявка"),
        body: t(
          "Formu doldurun və ya zəng edin, satış komandası sizinlə əlaqə saxlayacaq.",
          "Send the form or call us, and the sales team will get back to you.",
          "Оставьте заявку или позвоните, и отдел продаж свяжется с вами.",
        ),
      },
      {
        title: t("Baxış", "Viewing", "Просмотр"),
        body: t(
          "Kompleksə və mənzilə baxmaq üçün sizə uyğun vaxt seçin.",
          "Pick a time that suits you to see the complex and the apartment.",
          "Выберите удобное время, чтобы увидеть комплекс и квартиру.",
        ),
      },
      {
        title: t("Rezerv", "Reservation", "Бронирование"),
        body: t(
          "Bəyəndiyiniz mənzili seçin, o sizin üçün rezerv olunsun.",
          "Choose the apartment you like and we reserve it for you.",
          "Выберите понравившуюся квартиру, и мы забронируем её для вас.",
        ),
      },
      {
        title: t("Müqavilə", "Contract", "Договор"),
        body: t(
          "Şərtləri razılaşdırırıq və müqavilə bağlayırıq.",
          "We agree the terms and sign the contract.",
          "Согласовываем условия и подписываем договор.",
        ),
      },
      {
        title: t("Açarlar", "Keys", "Ключи"),
        body: t(
          "Tikinti başa çatanda açarlarınızı təhvil alırsınız.",
          "When construction is complete, you receive your keys.",
          "Когда строительство завершено, вы получаете ключи.",
        ),
      },
    ],
  },
  faq: {
    title: t("Tez-tez verilən suallar", "Frequently asked questions", "Частые вопросы"),
  },
  cta: {
    title: t(
      "Sualınız var? Bizə yazın.",
      "Have a question? Write to us.",
      "Есть вопрос? Напишите нам.",
    ),
    body: t(
      "Satış komandası sizə ən qısa zamanda zəng edəcək.",
      "The sales team will call you back shortly.",
      "Отдел продаж перезвонит вам в ближайшее время.",
    ),
  },
};
