export type Service = {
  number: string;
  slug: string;
  title: string;
  summary: string;
  tags: string[];
};

export const services: Service[] = [
  {
    number: "01",
    slug: "terapia-miofuncional-xativa",
    title: "Terapia Miofuncional orofacial",
    summary:
      "Reeducamos la respiración, la deglución, la masticación y la función de la musculatura orofacial.",
    tags: [
      "Respiración oral",
      "Deglución atípica",
      "Frenillo lingual",
      "Ortodoncia",
      "ATM",
    ],
  },
  {
    number: "02",
    slug: "logopedia-infantil-xativa",
    title: "Logopedia infantil",
    summary:
      "Acompañamos el desarrollo del lenguaje, el habla y la comunicación desde un enfoque personalizado.",
    tags: [
      "Retraso del lenguaje",
      "TDL",
      "Dislalias",
      "Tartamudez",
      "Lectoescritura",
    ],
  },
  {
    number: "03",
    slug: "logopedia-adultos-xativa",
    title: "Logopedia en adultos",
    summary:
      "Recuperamos funciones comunicativas y de deglución tras patologías neurológicas o alteraciones funcionales.",
    tags: ["Afasia", "Disartria", "Parkinson", "Ictus", "Disfagia"],
  },
  {
    number: "04",
    slug: "rehabilitacion-vocal-xativa",
    title: "Voz y Rehabilitación Vocal",
    summary:
      "Tratamientos para personas que utilizan la voz como herramienta de trabajo o presentan alteraciones vocales.",
    tags: ["Disfonía", "Sobrecarga vocal", "Voz profesional", "Técnica vocal"],
  },
  {
    number: "05",
    slug: "terapia-miofuncional-xativa",
    title: "Respiración, Sueño y Ortodoncia",
    summary:
      "La función respiratoria influye directamente en el crecimiento, el descanso y la salud.",
    tags: [
      "Ronquido",
      "Apnea infantil",
      "Reeducación miofuncional",
      "Mordida abierta",
    ],
  },
  {
    number: "06",
    slug: "psicologia-xativa",
    title: "Psicología",
    summary:
      "Atención psicológica individualizada, con enfoque cognitivo-conductual, para afrontar dificultades emocionales y personales.",
    tags: [
      "Ansiedad",
      "Depresión",
      "Autoestima",
      "Trauma",
      "Terapia de pareja",
    ],
  },
];
