export const faqTopics = [
  { id: "primera-visita", label: "Primera visita" },
  { id: "ninos", label: "Niños" },
  { id: "adultos", label: "Adultos" },
  { id: "terapia-miofuncional", label: "Terapia miofuncional" },
] as const;

export type FaqTopic = (typeof faqTopics)[number]["id"];

export type Faq = {
  question: string;
  answer: string;
  topic: FaqTopic;
  featured?: boolean;
};

export const faqs: Faq[] = [
  {
    question: "¿Cuándo debería acudir a un logopeda?",
    topic: "primera-visita",
    featured: true,
    answer:
      "Es recomendable acudir cuando aparecen dificultades relacionadas con el habla, el lenguaje, la voz, la respiración, la deglución o la masticación. También cuando existen alteraciones como respiración oral, deglución atípica, frenillo lingual, retraso del lenguaje o dificultades en la pronunciación. Una valoración temprana permite detectar el origen del problema y comenzar el tratamiento adecuado.",
  },
  {
    question: "¿Qué es la terapia miofuncional?",
    topic: "terapia-miofuncional",
    answer:
      "La terapia miofuncional es una especialidad de la logopedia centrada en reeducar la musculatura y las funciones orofaciales. Su objetivo es conseguir que acciones tan importantes como respirar, masticar, deglutir o hablar se realicen de forma correcta y eficiente.",
  },
  {
    question:
      "¿Qué diferencia hay entre la logopedia tradicional y la terapia miofuncional?",
    topic: "terapia-miofuncional",
    answer:
      "La logopedia aborda las dificultades relacionadas con la comunicación, el habla, el lenguaje, la voz y la deglución. La terapia miofuncional se centra específicamente en la función de la musculatura orofacial y en el equilibrio entre respiración, lengua, labios, mandíbula y deglución. En LUMIA ambas disciplinas trabajan de forma integrada.",
  },
  {
    question: "¿Cómo sé si mi hijo respira por la boca?",
    topic: "ninos",
    featured: true,
    answer:
      "Algunas señales habituales son dormir con la boca abierta, roncar, presentar labios secos con frecuencia, mantener la boca entreabierta durante el día, cansancio al despertar o alteraciones en el desarrollo facial y dental. Una valoración logopédica puede determinar si existe una respiración oral y cómo corregirla.",
  },
  {
    question: "¿Qué es la deglución atípica?",
    topic: "ninos",
    answer:
      "Es un patrón de deglución en el que la lengua realiza un movimiento incorrecto al tragar. Con el tiempo puede influir en la posición de los dientes, favorecer maloclusiones y dificultar el tratamiento de ortodoncia. La terapia miofuncional ayuda a recuperar un patrón de deglución funcional.",
  },
  {
    question: "¿Trabajáis con adultos?",
    topic: "adultos",
    answer:
      "Sí. En LUMIA atendemos población infantil y adulta, incluyendo casos de voz, disfagia, Parkinson, ictus, afasia, disartria y daño cerebral adquirido.",
  },
  {
    question: "¿Se necesita derivación médica?",
    topic: "primera-visita",
    featured: true,
    answer:
      "No siempre. Puedes solicitar una primera valoración directamente. En algunos casos puede ser recomendable coordinar el proceso con otros profesionales sanitarios.",
  },
];
