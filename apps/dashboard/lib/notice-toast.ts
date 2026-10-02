export const NOTICE_FAILED = "No se ha podido avisar al paciente.";
export const NOTICE_FAILED_PARAM = "aviso=sin-avisar";

export function noticeToast(message: string) {
  return (location: string): string =>
    location.includes(NOTICE_FAILED_PARAM)
      ? `${message}. ${NOTICE_FAILED}`
      : message;
}
