export type Treatment = {
  name: string;
  description: string;
  signs: string[];
};

export type Step = {
  title: string;
  description: string;
};

export type ServicePage = {
  slug: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  intro: string;
  whatIsTitle: string;
  whatIs: string;
  treatments: Treatment[];
  warningSigns: string[];
  steps: Step[];
  benefits: string[];
  cta: string;
};

export const servicePages: ServicePage[] = [
  {
    slug: "terapia-miofuncional-xativa",
    metaTitle: "Terapia miofuncional en Xàtiva · LUMIA",
    metaDescription:
      "Especialistas en terapia miofuncional orofacial, respiración oral, deglución atípica, frenillo lingual y ortodoncia en Xàtiva.",
    h1: "Terapia miofuncional en Xàtiva · Especialistas en función orofacial",
    intro:
      "En LUMIA somos especialistas en terapia miofuncional orofacial en Xàtiva, un tratamiento especializado que trabaja la correcta función y coordinación de la musculatura implicada en procesos esenciales como respirar, masticar, deglutir y hablar. La terapia miofuncional permite abordar alteraciones funcionales que pueden influir en el desarrollo orofacial, la calidad del sueño, la ortodoncia, la postura lingual y la calidad de vida. Trabajamos con niños y adultos mediante tratamientos personalizados y basados en evidencia científica.",
    whatIsTitle: "Qué es y por qué importa",
    whatIs:
      "La terapia miofuncional es una especialidad clínica centrada en evaluar, prevenir y tratar alteraciones relacionadas con las funciones orofaciales. Trabaja la respiración, la deglución, la masticación, la succión, la postura lingual, el sellado labial y la coordinación muscular. Su objetivo es conseguir patrones funcionales adecuados y ayudar a que el sistema orofacial trabaje de forma más eficiente.",
    treatments: [
      {
        name: "Respiración oral",
        description:
          "Respirar por la boca de forma mantenida puede afectar al desarrollo facial, la postura, la calidad del sueño y determinados tratamientos de ortodoncia. En LUMIA evaluamos el patrón respiratorio y trabajamos la reeducación funcional cuando existe indicación clínica.",
        signs: [
          "Boca abierta en reposo",
          "Ronquidos frecuentes",
          "Labios entreabiertos",
          "Fatiga diurna",
          "Sueño poco reparador",
        ],
      },
      {
        name: "Deglución atípica",
        description:
          "La deglución atípica aparece cuando la lengua realiza patrones de movimiento inadecuados durante la deglución. Puede relacionarse con interposición lingual, mordida abierta, problemas dentales o inestabilidad en tratamientos de ortodoncia.",
        signs: [
          "Lengua entre los dientes al tragar",
          "Presión lingual anterior",
          "Mordida abierta",
          "Dificultad para mantener resultados ortodónticos",
        ],
      },
      {
        name: "Frenillo lingual",
        description:
          "Valoramos la función de la lengua y acompañamos la preparación previa y el seguimiento posterior en casos de frenectomía. El objetivo es mejorar movilidad, coordinación y funcionalidad, no solo observar la estructura.",
        signs: [
          "Limitación de movilidad lingual",
          "Dificultades de succión, habla o deglución",
          "Necesidad de trabajo pre y post frenectomía",
        ],
      },
      {
        name: "Reeducación miofuncional en ortodoncia",
        description:
          "La terapia miofuncional puede ser clave antes, durante o después de un tratamiento de ortodoncia. Trabajamos patrones funcionales que pueden influir en la mordida, la postura lingual y la estabilidad del resultado.",
        signs: [
          "Clase II y Clase III funcional",
          "Mordida abierta",
          "Interposición lingual",
          "Sellado labial insuficiente",
        ],
      },
      {
        name: "Hábitos orales nocivos",
        description:
          "Algunos hábitos mantenidos pueden alterar el equilibrio orofacial y el desarrollo de las funciones orales. La terapia se orienta a sustituir patrones inadecuados por funciones más saludables.",
        signs: [
          "Chupete prolongado",
          "Succión digital",
          "Onicofagia",
          "Mordisqueo de objetos",
        ],
      },
    ],
    warningSigns: [
      "Respiración por la boca",
      "Ronquidos infantiles",
      "Labios abiertos en reposo",
      "Lengua baja o adelantada",
      "Dificultad al masticar",
      "Deglución con empuje lingual",
      "Alteraciones de mordida",
      "Falta de sellado labial",
      "Dolor orofacial o molestias en ATM",
    ],
    steps: [
      {
        title: "Valoración funcional completa",
        description:
          "Analizamos respiración, deglución, postura lingual, sellado labial, masticación, tono muscular y hábitos orales.",
      },
      {
        title: "Objetivos personalizados",
        description:
          "Definimos un plan de tratamiento adaptado a la edad, necesidades y contexto de cada paciente.",
      },
      {
        title: "Tratamiento activo",
        description:
          "Trabajamos ejercicios específicos para mejorar coordinación, tono, movilidad y automatización funcional.",
      },
      {
        title: "Seguimiento y coordinación",
        description:
          "Revisamos evolución y, cuando es necesario, coordinamos el tratamiento con odontología, ortodoncia, otorrino, maxilofacial o fisioterapia.",
      },
    ],
    benefits: [
      "Mejora de la función respiratoria",
      "Mayor coordinación muscular orofacial",
      "Mejor deglución y masticación",
      "Apoyo a tratamientos de ortodoncia",
      "Mejora de la calidad del sueño",
      "Prevención de compensaciones funcionales",
      "Mejora de la calidad de vida",
    ],
    cta: "¿Buscas especialistas en terapia miofuncional en Xàtiva? Solicita tu primera valoración en LUMIA.",
  },
  {
    slug: "logopedia-infantil-xativa",
    metaTitle: "Logopeda infantil en Xàtiva · LUMIA",
    metaDescription:
      "Tratamiento de lenguaje, habla, dislalias, tartamudez, TDL, dislexia y comunicación infantil en Xàtiva.",
    h1: "Logopeda infantil en Xàtiva · Lenguaje, habla y desarrollo infantil",
    intro:
      "En LUMIA trabajamos la logopedia infantil en Xàtiva desde una visión especializada, personalizada y basada en evidencia científica. Acompañamos a niños y familias en dificultades relacionadas con el habla, el lenguaje, la comunicación, la lectoescritura y el desarrollo funcional. La intervención temprana permite detectar necesidades, acompañar mejor el aprendizaje y favorecer la comunicación del niño en su entorno familiar, escolar y social.",
    whatIsTitle: "Qué es y por qué importa",
    whatIs:
      "La logopedia infantil evalúa y trata dificultades relacionadas con la comunicación, el lenguaje oral, la pronunciación, la fluidez, la comprensión, la expresión y la lectoescritura. Su objetivo es ayudar al niño a comunicarse mejor, participar con más seguridad y desarrollar sus capacidades de forma adaptada a su edad y necesidades.",
    treatments: [
      {
        name: "Retraso del lenguaje",
        description:
          "Intervenimos cuando la adquisición del lenguaje se encuentra por debajo de lo esperado para la edad del niño. El tratamiento busca estimular comprensión, vocabulario, estructura de frases y uso funcional del lenguaje.",
        signs: [
          "Pocas palabras para su edad",
          "Dificultad para construir frases",
          "Escasa intención comunicativa",
          "Problemas de comprensión",
        ],
      },
      {
        name: "Trastorno del Desarrollo del Lenguaje · TDL",
        description:
          "El TDL requiere una intervención especializada y continuada. Trabajamos objetivos adaptados a cada perfil lingüístico, favoreciendo la comunicación, el aprendizaje y la participación escolar.",
        signs: [
          "Dificultad persistente en lenguaje",
          "Problemas de comprensión y expresión",
          "Necesidad de apoyo escolar y familiar",
        ],
      },
      {
        name: "Dislalias y dificultades articulatorias",
        description:
          "Tratamos dificultades en la producción de determinados sonidos, ayudando al niño a mejorar pronunciación, precisión articulatoria e inteligibilidad del habla.",
        signs: [
          "No pronuncia algunos sonidos",
          "Sustituye o elimina fonemas",
          "Habla poco clara",
          "Dificultad para que le entiendan",
        ],
      },
      {
        name: "Tartamudez o disfemia",
        description:
          "La intervención se orienta a mejorar la fluidez, reducir tensión comunicativa y acompañar emocionalmente al niño y su familia.",
        signs: [
          "Bloqueos al hablar",
          "Repeticiones frecuentes",
          "Miedo o evitación al comunicarse",
        ],
      },
      {
        name: "Lectoescritura y aprendizaje",
        description:
          "Trabajamos habilidades relacionadas con conciencia fonológica, lectura, escritura, comprensión lectora y dificultades específicas como dislexia o disortografía.",
        signs: [
          "Dificultad para leer",
          "Confusión de letras",
          "Problemas de comprensión lectora",
          "Errores de escritura persistentes",
        ],
      },
      {
        name: "Comunicación social y pragmática",
        description:
          "Acompañamos a niños con necesidades comunicativas específicas, incluyendo TEA, Síndrome de Down u otras condiciones del neurodesarrollo.",
        signs: [
          "Dificultad para iniciar conversaciones",
          "Problemas para entender normas sociales",
          "Necesidad de apoyo comunicativo",
        ],
      },
    ],
    warningSigns: [
      "Pronunciación poco clara",
      "Retraso respecto a otros niños de su edad",
      "Dificultades para entender instrucciones",
      "Frases muy cortas o poco estructuradas",
      "Problemas de lectura o escritura",
      "Bloqueos al hablar",
      "Baja participación comunicativa",
      "Dificultades en el colegio relacionadas con lenguaje",
    ],
    steps: [
      {
        title: "Entrevista familiar",
        description:
          "Recogemos información del desarrollo, contexto familiar, escolar y necesidades observadas.",
      },
      {
        title: "Evaluación logopédica",
        description:
          "Analizamos lenguaje, habla, comprensión, expresión, articulación, fluidez y habilidades asociadas.",
      },
      {
        title: "Plan de intervención",
        description:
          "Definimos objetivos terapéuticos adaptados a la edad y al perfil del niño.",
      },
      {
        title: "Trabajo con familia",
        description:
          "Ofrecemos pautas y orientación para reforzar avances en el día a día.",
      },
      {
        title: "Coordinación escolar si procede",
        description:
          "Cuando es necesario, se favorece la coordinación con el entorno educativo.",
      },
    ],
    benefits: [
      "Mejora de la comunicación",
      "Mayor seguridad al hablar",
      "Apoyo al aprendizaje escolar",
      "Mejora de la pronunciación",
      "Mejor comprensión y expresión oral",
      "Acompañamiento a familias",
      "Mayor autonomía comunicativa",
    ],
    cta: "¿Buscas un logopeda infantil en Xàtiva? En LUMIA podemos valorar el caso y orientarte desde el primer contacto.",
  },
  {
    slug: "logopedia-adultos-xativa",
    metaTitle: "Logopedia para adultos en Xàtiva · LUMIA",
    metaDescription:
      "Rehabilitación logopédica en adultos: afasia, ictus, Parkinson, disfagia, disartria y daño cerebral adquirido.",
    h1: "Logopedia para adultos en Xàtiva · Rehabilitación neurológica, habla y deglución",
    intro:
      "En LUMIA ofrecemos atención especializada en logopedia para adultos en Xàtiva, abordando alteraciones del habla, el lenguaje, la voz, la comunicación y la deglución relacionadas con procesos neurológicos, enfermedades neurodegenerativas o daño cerebral adquirido. Nuestro objetivo es mejorar funcionalidad, seguridad, autonomía y calidad de vida.",
    whatIsTitle: "Qué es y por qué importa",
    whatIs:
      "La logopedia para adultos trabaja la rehabilitación de funciones que pueden verse afectadas por ictus, Parkinson, daño cerebral adquirido, deterioro cognitivo u otras alteraciones neurológicas. La intervención puede centrarse en recuperar lenguaje, mejorar habla, reforzar comunicación funcional, trabajar deglución segura o mantener capacidades comunicativas.",
    treatments: [
      {
        name: "Afasia",
        description:
          "Alteración del lenguaje que puede afectar a la comprensión, expresión, lectura o escritura, frecuentemente tras un ictus o daño cerebral. La intervención busca recuperar o compensar habilidades comunicativas.",
        signs: [
          "Dificultad para encontrar palabras",
          "Problemas para comprender",
          "Dificultad para leer o escribir",
        ],
      },
      {
        name: "Disartria",
        description:
          "Dificultad motora que afecta a la articulación del habla. Trabajamos respiración, precisión, ritmo, intensidad y claridad comunicativa.",
        signs: [
          "Habla lenta o poco clara",
          "Baja intensidad vocal",
          "Dificultad para articular",
        ],
      },
      {
        name: "Apraxia del habla",
        description:
          "Alteración en la planificación motora del habla. Requiere ejercicios específicos para mejorar secuencias, coordinación y producción verbal.",
        signs: [
          "Errores inconsistentes al hablar",
          "Dificultad para iniciar palabras",
          "Mayor esfuerzo al producir sonidos",
        ],
      },
      {
        name: "Parkinson",
        description:
          "La intervención logopédica puede ayudar a trabajar voz, intensidad, articulación, ritmo y comunicación funcional en personas con Parkinson.",
        signs: [
          "Voz baja",
          "Habla monótona",
          "Dificultad para proyectar la voz",
        ],
      },
      {
        name: "Ictus y daño cerebral adquirido",
        description:
          "Tras un ictus o daño cerebral, la logopedia ayuda a recuperar o compensar funciones del lenguaje, habla, deglución y comunicación.",
        signs: [
          "Afasia",
          "Disartria",
          "Problemas de deglución",
          "Dificultades cognitivas asociadas",
        ],
      },
      {
        name: "Disfagia",
        description:
          "La disfagia es una alteración de la deglución que puede comprometer la seguridad al comer o beber. La intervención busca mejorar seguridad, eficacia y calidad de vida.",
        signs: [
          "Tos al comer o beber",
          "Atragantamientos",
          "Sensación de alimento retenido",
          "Cambios de voz después de comer",
        ],
      },
    ],
    warningSigns: [
      "Dificultad para hablar tras ictus",
      "Problemas para tragar",
      "Voz más débil",
      "Habla poco clara",
      "Dificultad para encontrar palabras",
      "Atragantamientos frecuentes",
      "Deterioro de la comunicación diaria",
      "Necesidad de rehabilitación tras daño neurológico",
    ],
    steps: [
      {
        title: "Valoración inicial",
        description:
          "Analizamos antecedentes, diagnóstico médico, necesidades funcionales y objetivos de la persona.",
      },
      {
        title: "Evaluación específica",
        description:
          "Valoramos lenguaje, habla, voz, deglución y comunicación funcional según el caso.",
      },
      {
        title: "Plan terapéutico",
        description:
          "Diseñamos un tratamiento individualizado orientado a funcionalidad y calidad de vida.",
      },
      {
        title: "Acompañamiento familiar",
        description:
          "Ofrecemos pautas para facilitar la comunicación y la seguridad en el entorno cotidiano.",
      },
      {
        title: "Coordinación sanitaria",
        description:
          "Cuando procede, coordinamos el abordaje con otros profesionales sanitarios.",
      },
    ],
    benefits: [
      "Mayor autonomía comunicativa",
      "Mejor claridad del habla",
      "Más seguridad en la deglución",
      "Mejor participación social",
      "Apoyo a familiares y cuidadores",
      "Mantenimiento de capacidades funcionales",
      "Mejora de la calidad de vida",
    ],
    cta: "Solicita una valoración especializada de logopedia para adultos en Xàtiva.",
  },
  {
    slug: "rehabilitacion-vocal-xativa",
    metaTitle: "Rehabilitación vocal en Xàtiva · LUMIA",
    metaDescription:
      "Tratamiento de disfonía, sobrecarga vocal, técnica vocal y voz profesional en Xàtiva.",
    h1: "Rehabilitación vocal en Xàtiva · Disfonía, técnica vocal y voz profesional",
    intro:
      "La voz es una herramienta esencial de comunicación. En LUMIA ofrecemos tratamiento especializado para alteraciones vocales y entrenamiento específico para personas con alta demanda vocal. Trabajamos disfonías, sobrecarga vocal, técnica vocal y rehabilitación de la voz desde un enfoque funcional y personalizado.",
    whatIsTitle: "Qué es y por qué importa",
    whatIs:
      "La rehabilitación vocal permite evaluar cómo se utiliza la voz, detectar patrones de esfuerzo o mal uso vocal y entrenar una emisión más eficiente. Puede ser útil tanto en personas con disfonías como en profesionales que utilizan la voz como herramienta principal de trabajo.",
    treatments: [
      {
        name: "Disfonía infantil y adulta",
        description:
          "Tratamos cambios persistentes en la voz, ronquera, fatiga vocal o pérdida de voz frecuente. La intervención se adapta a edad, origen y uso vocal del paciente.",
        signs: [
          "Ronquera",
          "Voz soplada",
          "Cambios de tono",
          "Pérdida frecuente de voz",
        ],
      },
      {
        name: "Nódulos vocales",
        description:
          "En coordinación con el diagnóstico médico correspondiente, trabajamos pautas de higiene vocal, técnica y reeducación para reducir esfuerzo y favorecer un uso vocal más saludable.",
        signs: ["Sobrecarga vocal", "Esfuerzo al hablar", "Fatiga vocal"],
      },
      {
        name: "Sobrecarga vocal",
        description:
          "Muy frecuente en docentes, profesionales sanitarios, comerciales, monitores y personas que hablan durante muchas horas. El tratamiento busca mejorar eficiencia vocal y prevenir recaídas.",
        signs: [
          "Cansancio al final del día",
          "Necesidad de forzar la voz",
          "Dolor o molestia al hablar",
        ],
      },
      {
        name: "Voz profesional",
        description:
          "Entrenamiento para profesionales que necesitan una voz resistente, clara y eficiente. Trabajamos proyección, respiración, resonancia, articulación y cuidado vocal.",
        signs: [
          "Docentes",
          "Cantantes",
          "Locutores",
          "Profesionales sanitarios",
          "Personas con alta demanda comunicativa",
        ],
      },
    ],
    warningSigns: [
      "Ronquera durante más de dos semanas",
      "Pérdida de voz frecuente",
      "Cansancio al hablar",
      "Dolor o tensión en garganta",
      "Necesidad constante de aclarar la voz",
      "Voz débil o poco proyectada",
      "Sobrecarga al final de la jornada",
    ],
    steps: [
      {
        title: "Valoración vocal",
        description:
          "Analizamos calidad vocal, hábitos, uso diario de la voz y posibles factores de sobrecarga.",
      },
      {
        title: "Objetivos terapéuticos",
        description:
          "Definimos necesidades: rehabilitación, técnica, prevención o entrenamiento vocal.",
      },
      {
        title: "Reeducación vocal",
        description:
          "Trabajamos respiración, proyección, resonancia, higiene vocal y reducción del esfuerzo.",
      },
      {
        title: "Prevención de recaídas",
        description:
          "Ofrecemos pautas para mantener una voz más eficiente en el día a día.",
      },
    ],
    benefits: [
      "Menor fatiga vocal",
      "Mejor proyección",
      "Mayor claridad al hablar",
      "Reducción del esfuerzo",
      "Prevención de lesiones",
      "Mejor rendimiento profesional",
      "Más seguridad comunicativa",
    ],
    cta: "Cuida tu voz con tratamiento especializado en rehabilitación vocal en Xàtiva.",
  },
];

export function getServicePage(slug: string) {
  return servicePages.find((page) => page.slug === slug);
}
