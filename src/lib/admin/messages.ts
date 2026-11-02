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

  "panel.title": "İdarə paneli",
  "panel.welcome": "Xoş gəldiniz, {name}.",
  "panel.role": "Rolunuz: {role}",
  "panel.signOut": "Çıxış",

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
