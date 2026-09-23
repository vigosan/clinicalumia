import { site } from "./site";

const { street, postalCode, locality, region } = site.address;

export const dataController = {
  name: "Patricia Hernán Sánchez",
  taxId: "20449989E",
  address: `${street}, ${postalCode} ${locality} (${region})`,
  email: site.email,
};

export const consentTitle = "Consentimiento de protección de datos";

export const consentClauses = [
  "Para guardar adecuadamente tus datos y cumplir con la normativa vigente en materia de protección de datos, te informamos de lo siguiente:",
  `1. Los datos personales que nos facilites voluntariamente formarán parte de los ficheros informáticos y documentales de ${site.name}, cuya titular y responsable del tratamiento es ${dataController.name}, con NIF ${dataController.taxId} y domicilio en ${dataController.address}.`,
  "2. Finalidad: elaborar tu ficha de paciente, gestionar tu atención (valoración, tratamiento, seguimiento e historia clínica) y realizar la gestión administrativa, contable y fiscal.",
  `3. Imágenes y grabaciones: autorizas que durante las sesiones se tomen fotografías, audios o vídeos, que ${site.name} utilizará exclusivamente para el seguimiento adecuado de tu tratamiento. Su uso con fines de investigación, ponencias o cursos requiere tu autorización expresa en la casilla correspondiente.`,
  `4. Destinatarios: tus datos son tratados exclusivamente por ${site.name} y, cuando intervengan en tu atención, por los profesionales colaboradores de la clínica. Solo se comunicarán a organismos oficiales cuando la ley lo exija.`,
  "5. Legitimación: tu consentimiento y la prestación de la asistencia sanitaria que solicitas. Los datos de salud se tratan conforme al artículo 9.2.h del RGPD.",
  "6. Conservación: los datos se conservarán mientras dure la relación asistencial y, después, durante los plazos que exija la normativa sanitaria sobre historia clínica.",
  `7. Derechos: puedes ejercer tus derechos de acceso, rectificación, supresión, oposición, limitación del tratamiento y portabilidad dirigiéndote a ${site.name} en ${dataController.address} o en ${dataController.email}, acreditando tu identidad. También puedes presentar una reclamación ante la Agencia Española de Protección de Datos (www.aepd.es).`,
  "Esta información se facilita conforme al Reglamento (UE) 2016/679 del Parlamento Europeo y del Consejo, de 27 de abril de 2016 (RGPD), a la Ley Orgánica 3/2018, de 5 de diciembre, de Protección de Datos Personales y garantía de los derechos digitales (LOPDGDD), y a la Ley 34/2002, de 11 de julio, de Servicios de la Sociedad de la Información y de Comercio Electrónico (LSSI).",
];

export const privacyLabel = `Completamente enterado/a y conforme con lo expuesto, doy mi consentimiento y autorizo a ${site.name} a tratar mis datos personales para los fines descritos.`;

export const marketingLabel = `Acepto recibir información sobre acontecimientos, servicios y otras informaciones de interés de ${site.name} por email u otros medios (opcional).`;

export const mediaForTrainingLabel =
  "Autorizo el uso de mis fotografías, audios o vídeos con fines de investigación, ponencias o cursos (opcional).";
