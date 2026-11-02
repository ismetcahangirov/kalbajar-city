import type { UserRole } from "@/db/schema/auth";

/**
 * The console's message catalogue. The console is Azerbaijani only (spec §5),
 * so it has one locale; the public site's catalogues are in `src/i18n/messages`.
 */
const messages = {
  brand: "Kalbajar City",
  "meta.title": "Kalbajar City · İdarə paneli",

  "login.title": "Giriş",
  "login.lead": "İdarə panelinə daxil olmaq üçün e-poçt və şifrənizi yazın.",
  "login.submit": "Daxil ol",
  "login.submitting": "Yoxlanılır…",
  "login.forgot": "Şifrəni unutmusunuz?",

  "field.email": "E-poçt",
  "field.password": "Şifrə",
  "field.newPassword": "Yeni şifrə",
  "field.confirmPassword": "Yeni şifrəni təkrarlayın",
  "field.passwordHint": "Ən azı {min} simvol.",
  "field.showPassword": "Şifrəni göstər",
  "field.hidePassword": "Şifrəni gizlət",

  "reset.title": "Şifrənin bərpası",
  "reset.lead": "Hesabınızın e-poçtunu yazın. Yeni şifrə təyin etmək üçün link göndərəcəyik.",
  "reset.submit": "Link göndər",
  "reset.submitting": "Göndərilir…",
  "reset.sent":
    "Bu ünvanla hesab varsa, bərpa linki göndərildi. Poçtunuzu yoxlayın; link 1 saat etibarlıdır.",
  "reset.newTitle": "Yeni şifrə",
  "reset.newLead": "Hesabınız üçün yeni şifrə təyin edin.",
  "reset.save": "Şifrəni yadda saxla",
  "reset.saving": "Yadda saxlanılır…",
  "reset.done": "Şifrə yeniləndi. İndi yeni şifrə ilə daxil ola bilərsiniz.",
  "reset.backToLogin": "Girişə qayıt",

  "error.required": "Bu xananı doldurun.",
  "error.email": "Düzgün e-poçt ünvanı yazın.",
  "error.passwordShort": "Şifrə ən azı {min} simvol olmalıdır.",
  "error.passwordLong": "Şifrə ən çox {max} simvol ola bilər.",
  "error.passwordMismatch": "Şifrələr eyni deyil.",
  "error.invalidCredentials": "E-poçt və ya şifrə yanlışdır.",
  "error.banned": "Hesabınız deaktiv edilib. Administratorla əlaqə saxlayın.",
  "error.locked":
    "Çox sayda uğursuz cəhd oldu. Hesab {minutes} dəqiqəlik bağlandı; sonra yenidən yoxlayın.",
  "error.rateLimited": "Çox cəhd edildi. Bir dəqiqə sonra yenidən yoxlayın.",
  "error.invalidToken": "Link etibarsızdır və ya vaxtı keçib. Yeni link istəyin.",
  "error.generic": "Xəta baş verdi. Yenidən cəhd edin.",
  "error.tooShort": "Ən azı {min} simvol yazın.",
  "error.tooLong": "Ən çox {max} simvol yazın.",
  "error.tooSmall": "Dəyər ən azı {min} olmalıdır.",
  "error.tooBig": "Dəyər ən çox {max} ola bilər.",
  "error.tooFew": "Ən azı {min} seçim edin.",
  "error.tooMany": "Ən çox {max} seçim edin.",
  "error.url": "Düzgün link yazın.",
  "error.format": "Dəyərin formatı düzgün deyil.",
  "error.choice": "Siyahıdakı dəyərlərdən birini seçin.",
  "error.invalid": "Dəyər düzgün deyil.",
  "error.server": "Server bu dəyəri qəbul etmədi. Yoxlayıb yenidən göndərin.",
  "error.validation": "Bəzi xanalar düzgün doldurulmayıb.",
  "error.forbidden": "Rolunuz bu əməliyyata icazə vermir.",
  "error.notFound": "Qeyd tapılmadı. Ola bilər ki, silinib.",
  "error.conflict": "Bu dəyər artıq istifadə olunur və ya başqa qeydlər ona bağlıdır.",
  "error.unauthorized": "Sessiyanın vaxtı keçib. Yenidən daxil olun.",
  "error.network": "Serverə qoşulmaq olmadı. İnternet bağlantısını yoxlayın.",

  "panel.title": "İdarə paneli",
  "panel.signOut": "Çıxış",
  "panel.skipToContent": "Məzmuna keç",

  "sidebar.title": "Menyu",
  "sidebar.description": "İdarə panelinin bölmələri.",
  "sidebar.toggle": "Menyunu aç və ya bağla",

  "nav.group.sales": "Satış",
  "nav.group.content": "Məzmun",
  "nav.group.system": "Sistem",
  "nav.dashboard": "İcmal",
  "nav.apartments": "Mənzillər",
  "nav.leads": "Müraciətlər",
  "nav.news": "Xəbərlər",
  "nav.media": "Media",
  "nav.settings": "Ayarlar",
  "nav.users": "İstifadəçilər",
  "nav.audit": "Audit jurnalı",

  "ui.close": "Bağla",
  "ui.more": "Daha çox",
  "ui.breadcrumb": "Naviqasiya yolu",
  "ui.cancel": "İmtina",
  "ui.confirm": "Təsdiqlə",
  "ui.retry": "Yenidən cəhd et",

  "module.comingTitle": "Bu bölmə hazırlanır",
  "module.comingLead":
    "Bu bölmə növbəti mərhələdə əlavə olunacaq. Menyudakı digər bölmələr artıq işləyir.",
  "module.leads": "Saytın formalarından gələn müraciətlər: zəng sifarişi, baxış və sorğu.",
  "module.news": "Xəbərlər, qalereya, tikinti gedişatı və səhifələrin mətni.",
  "module.media": "Şəkil və videoların kitabxanası.",
  "module.settings": "Əlaqə məlumatları, qiymətlərin göstərilməsi və saytın ümumi ayarları.",
  "module.users": "İdarə panelinin hesabları və rolları.",
  "module.audit": "İdarə panelində edilən hər dəyişikliyin jurnalı.",
  "module.apartments": "Bütün mənzillər, hər statusda. Redaktə növbəti mərhələdə əlavə olunur.",

  "table.loading": "Yüklənir…",
  "table.empty": "Heç nə tapılmadı.",
  "table.emptyFiltered": "Seçilmiş filtrlərə uyğun heç nə tapılmadı.",
  "table.error": "Siyahını yükləmək olmadı.",
  "table.results": "{total} nəticə",
  "table.page": "Səhifə {page} / {pageCount}",
  "table.previous": "Əvvəlki",
  "table.next": "Növbəti",
  "table.pagination": "Səhifələr",
  "table.sort": "Sıralama",
  "table.sortBy": "{column} üzrə sırala",
  "table.sortAsc": "{column}, artan",
  "table.sortDesc": "{column}, azalan",
  "table.clearFilters": "Filtrləri təmizlə",

  "apartments.caption": "Mənzillərin siyahısı",
  "apartments.number": "Mənzil",
  "apartments.block": "Blok",
  "apartments.floor": "Mərtəbə",
  "apartments.rooms": "Otaq",
  "apartments.roomsValue": "{rooms} otaq",
  "apartments.area": "Sahə",
  "apartments.price": "Qiymət",
  "apartments.noPrice": "Təyin edilməyib",
  "apartments.status": "Status",
  "apartments.updatedAt": "Yenilənib",
  "apartments.demo": "Demo",
  "apartments.demoHint": "Nümunə məlumat: sahibin siyahısı ilə əvəz olunacaq",

  "status.available": "Satışda",
  "status.reserved": "Rezerv",
  "status.sold": "Satılıb",
  "status.not_for_sale": "Satışda deyil",

  "leadType.inquiry": "Sorğu",
  "leadType.viewing": "Baxış",
  "leadType.callback": "Zəng sifarişi",

  "leadStatus.new": "Yeni",
  "leadStatus.contacted": "Əlaqə saxlanılıb",
  "leadStatus.viewing": "Baxış",
  "leadStatus.reserved": "Rezerv",
  "leadStatus.closed": "Bağlanıb",
  "leadStatus.lost": "İtirilib",

  "dashboard.title": "İcmal",
  "dashboard.welcome": "Xoş gəldiniz, {name}.",
  "dashboard.leads": "Bu həftənin müraciətləri",
  "dashboard.leadsTotal": "Bazar ertəsindən bəri {total} müraciət",
  "dashboard.byType": "Növə görə",
  "dashboard.byStatus": "Statusa görə",
  "dashboard.noLeads": "Bu həftə hələ müraciət yoxdur.",
  "dashboard.apartments": "Mənzillər statusa görə",
  "dashboard.apartmentsTotal": "Cəmi {total} mənzil",
  "dashboard.translations": "Çatışmayan tərcümələr",
  "dashboard.translationsCount": "{count} mətn ingilis və ya rus dilində boşdur.",
  "dashboard.translationsNone": "Bütün mətnlər üç dildədir.",
  "dashboard.translationsHint": "Tərcüməsi olmayan mətn saytda azərbaycanca göstərilir.",
  "dashboard.activity": "Son fəaliyyət",
  "dashboard.noActivity": "Hələ heç bir dəyişiklik qeydə alınmayıb.",
  "dashboard.system": "Sistem",
  "dashboard.open": "Bölməni aç: {module}",

  "audit.apartment.update": "Mənzili yenilədi",
  "audit.user.create": "Hesab yaratdı",
  "audit.user.update": "Hesabı yenilədi",
  "audit.user.set_role": "Rolu dəyişdi",
  "audit.user.deactivate": "Hesabı deaktiv etdi",
  "audit.user.reactivate": "Hesabı aktiv etdi",
  "audit.user.remove": "Hesabı sildi",
  "audit.user.password_set": "Şifrə təyin etdi",
  "audit.user.password_change": "Şifrəsini dəyişdi",
  "audit.user.password_reset": "Şifrəsini bərpa etdi",
  "audit.user.sessions_revoke": "Sessiyaları bağladı",
  "audit.other": "Dəyişiklik etdi ({action})",

  "form.missingTranslation": "tərcümə yoxdur",
  "form.copyFromAz": "Azərbaycanca mətni köçür",
  "form.translationHint": "Boş qalan dil saytda azərbaycanca göstərilir.",
  "form.unsavedTitle": "Dəyişikliklər yadda saxlanmayıb",
  "form.unsavedLead": "Səhifədən çıxsanız, etdiyiniz dəyişikliklər itəcək.",
  "form.unsavedLeave": "Çıx",
  "form.unsavedStay": "Səhifədə qal",

  "locale.az": "Azərbaycanca",
  "locale.en": "İngiliscə",
  "locale.ru": "Rusca",

  "forbidden.title": "Giriş icazəsi yoxdur",
  "forbidden.lead": "Rolunuz bu bölməni açmağa icazə vermir.",
  "forbidden.back": "İdarə panelinə qayıt",

  "role.owner": "Sahib",
  "role.admin": "Administrator",
  "role.editor": "Redaktor",
  "role.sales": "Satış",

  "mail.reset.subject": "Kalbajar City idarə paneli: şifrənin bərpası",
  "mail.reset.greeting": "Salam, {name}.",
  "mail.reset.lead":
    "Şifrəni bərpa etmək üçün sorğu göndərilib. Yeni şifrə təyin etmək üçün linkə keçin.",
  "mail.reset.action": "Yeni şifrə təyin et",
  "mail.reset.footer":
    "Link 1 saat etibarlıdır. Bu sorğunu siz göndərməmisinizsə, məktuba məhəl qoymayın.",

  "lead.type.inquiry": "Sorğu",
  "lead.type.viewing": "Baxış",
  "lead.type.callback": "Geri zəng",

  "mail.lead.subject": "Yeni müraciət: {type} · {name}",
  "mail.lead.lead": "Saytdan yeni müraciət gəldi.",
  "mail.lead.type": "Növ",
  "mail.lead.name": "Ad",
  "mail.lead.phone": "Telefon",
  "mail.lead.email": "E-poçt",
  "mail.lead.preferredAt": "İstədiyi vaxt (Bakı)",
  "mail.lead.apartment": "Mənzil",
  "mail.lead.message": "Mesaj",
  "mail.lead.sourcePath": "Göndərildiyi səhifə",
  "mail.lead.locale": "Dil",
  "mail.lead.utm": "UTM",
  "mail.lead.referrer": "Gəldiyi sayt",
  "mail.lead.open": "Müraciəti idarə panelində açın",
} as const;

export type MessageKey = keyof typeof messages;

/** A console message, with `{name}` placeholders filled from `values`. */
export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  return messages[key].replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export const roleLabel = (role: UserRole) => t(`role.${role}`);

/** Whether `key` names a console message, e.g. a schema's `"error.required"`. */
export function isMessageKey(key: string): key is MessageKey {
  return Object.hasOwn(messages, key);
}
