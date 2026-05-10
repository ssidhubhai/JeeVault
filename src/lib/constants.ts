export const ERROR_TAGS = [
  'Calculation Error',
  'Misread Question',
  'Concept Gap',
  'Silly Mistake',
  'Formula Forgotten',
  'Time Trap',
  'New Concept Learnt',
  'Out of Syllabus'
];

export const QUICK_TAGS = [
  'PYQ',
  'Good Question',
  'Doubt',
  'Important',
  'Revision',
  ...ERROR_TAGS
];

export const JEE_SYLLABUS: Record<string, { "Class 11": string[], "Class 12": string[] }> = {
  Physics: {
    "Class 11": [
      "Units and Measurements",
      "Motion in a Straight Line",
      "Motion in a Plane",
      "Laws of Motion",
      "Circular Motion",
      "Work, Energy and Power",
      "Centre of Mass",
      "System of Particles and Rotational Motion",
      "Gravitation",
      "Mechanical Properties of Solids",
      "Mechanical Properties of Fluids",
      "Thermal Properties of Matter",
      "Thermodynamics",
      "Kinetic Theory",
      "Oscillations",
      "Waves"
    ],
    "Class 12": [
      "Electric Charges and Fields",
      "Electrostatic Potential and Capacitance",
      "Current Electricity",
      "Moving Charges and Magnetism",
      "Magnetism and Matter",
      "Electromagnetic Induction",
      "Alternating Current",
      "Electromagnetic Waves",
      "Ray Optics and Optical Instruments",
      "Wave Optics",
      "Dual Nature of Radiation and Matter",
      "Atoms",
      "Nuclei",
      "Semiconductor Electronics",
      "Communication Systems"
    ]
  },
  "Physical Chemistry": {
    "Class 11": [
      "Some Basic Concepts of Chemistry",
      "Structure of Atom",
      "States of Matter (Gaseous and Liquids)",
      "Chemical Thermodynamics",
      "Equilibrium (Chemical & Ionic)",
      "Redox Reactions"
    ],
    "Class 12": [
      "Solid State",
      "Solutions",
      "Electrochemistry",
      "Chemical Kinetics",
      "Surface Chemistry"
    ]
  },
  "Inorganic Chemistry": {
    "Class 11": [
      "Classification of Elements and Periodicity",
      "Chemical Bonding and Molecular Structure",
      "Hydrogen",
      "s-Block Elements",
      "p-Block Elements (Group 13 & 14)",
      "Environmental Chemistry"
    ],
    "Class 12": [
      "General Principles and Processes of Isolation of Elements",
      "p-Block Elements (Group 15 to 18)",
      "d- and f-Block Elements",
      "Coordination Compounds"
    ]
  },
  "Organic Chemistry": {
    "Class 11": [
      "Organic Chemistry: Some Basic Principles and Techniques",
      "Hydrocarbons"
    ],
    "Class 12": [
      "Haloalkanes and Haloarenes",
      "Alcohols, Phenols and Ethers",
      "Aldehydes, Ketones and Carboxylic Acids",
      "Organic Compounds Containing Nitrogen",
      "Biomolecules",
      "Polymers",
      "Chemistry in Everyday Life"
    ]
  },
  Mathematics: {
    "Class 11": [
      "Sets",
      "Relations and Functions",
      "Trigonometric Functions",
      "Principle of Mathematical Induction",
      "Complex Numbers and Quadratic Equations",
      "Linear Inequalities",
      "Permutations and Combinations",
      "Binomial Theorem",
      "Sequence and Series",
      "Straight Lines",
      "Conic Sections",
      "Introduction to Three Dimensional Geometry",
      "Limits and Derivatives",
      "Mathematical Reasoning",
      "Statistics",
      "Probability"
    ],
    "Class 12": [
      "Relations and Functions",
      "Inverse Trigonometric Functions",
      "Matrices",
      "Determinants",
      "Continuity and Differentiability",
      "Application of Derivatives",
      "Integrals",
      "Application of Integrals",
      "Differential Equations",
      "Vector Algebra",
      "Three Dimensional Geometry",
      "Linear Programming",
      "Probability"
    ]
  }
};
