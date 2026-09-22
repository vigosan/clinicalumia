import { isPending, PENDING, site } from "./site";

export const dataController = {
  name: PENDING,
  taxId: PENDING,
  address: PENDING,
  email: site.email,
};

function field(value: string, label: string) {
  return isPending(value) ? `[${PENDING}: ${label}]` : value;
}

export const pendingPattern = new RegExp(`(\\[${PENDING}: [^\\]]+\\])`);

export const consentTitle = "Consentimiento de protección de datos";

export const consentClauses = [
  `[${PENDING}: revisión legal de este texto]`,
  `Responsable del tratamiento: ${field(dataController.name, "razón social o nombre del titular")}, con NIF ${field(dataController.taxId, "NIF/CIF")} y domicilio en ${field(dataController.address, "domicilio social")}. Contacto: ${dataController.email}.`,
  "Finalidad: gestionar tu atención en la clínica (valoración, tratamiento, seguimiento e historia clínica), las citas y la facturación, incluidas las imágenes o grabaciones que sea necesario realizar durante las sesiones para el tratamiento.",
  "Legitimación: la prestación de la asistencia sanitaria que solicitas y tu consentimiento. Los datos de salud se tratan conforme al artículo 9.2.h del RGPD.",
  "Conservación: los datos se conservarán mientras dure la relación asistencial y, después, durante los plazos que exija la normativa sanitaria sobre historia clínica.",
  "Destinatarios: no se cederán datos a terceros salvo obligación legal.",
  `Derechos: puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad escribiendo a ${dataController.email} y acreditando tu identidad. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).`,
  "Esta información se facilita conforme al Reglamento (UE) 2016/679 (RGPD) y a la Ley Orgánica 3/2018, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD).",
];

export const marketingLabel = `Acepto recibir información sobre los servicios de ${site.name} por email u otros medios (opcional).`;

export const privacyLabel =
  "He leído la información sobre protección de datos y doy mi consentimiento para el tratamiento de mis datos.";
