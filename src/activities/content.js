// Course content for lectures, library study, exams and orientation trivia.
export const COURSES = [
  {
    code: 'DA 221', title: 'Introduction to Machine Learning',
    board: ['Linear model: y = w·x + b', 'Loss (MSE) = (1/n) Σ (yᵢ − ŷᵢ)²', 'Gradient descent: w ← w − η ∇L', 'Overfitting ↔ high variance'],
    slide: ['Today: supervised learning', '• Training vs. test split', '• Gradient descent, learning rate η', '• Bias-variance trade-off', '• Regularisation: L2 penalty λ‖w‖²'],
    qs: [
      ['Which loss is standard for linear regression?', ['Mean squared error', 'Hinge loss', 'Cross-entropy', 'KL divergence'], 0],
      ['A model that fits training data well but test data badly is…', ['Overfitting', 'Underfitting', 'Converged', 'Regularised'], 0],
      ['In gradient descent, a very large learning rate usually…', ['Diverges or oscillates', 'Always converges faster', 'Has no effect', 'Removes bias'], 0],
      ['L2 regularisation adds which term to the loss?', ['λ‖w‖²', 'λ‖w‖₁', 'log(w)', 'e^w'], 0],
    ],
  },
  {
    code: 'DA 101', title: 'Probability for Data Science',
    board: ['P(A|B) = P(B|A) P(A) / P(B)', 'E[X] = Σ x p(x)', 'Var(X) = E[X²] − (E[X])²'],
    slide: ['Bayes\' theorem', '• Prior, likelihood, posterior', '• Expectation and variance', '• Independence: P(A∩B) = P(A)P(B)'],
    qs: [
      ['A fair die is rolled. P(even) = ?', ['1/2', '1/3', '1/6', '2/3'], 0],
      ['Var(X) equals…', ['E[X²] − (E[X])²', 'E[X]²', 'E[X − 1]', '√E[X]'], 0],
      ['If A and B are independent, P(A∩B) = ?', ['P(A)·P(B)', 'P(A)+P(B)', 'P(A|B)·P(B|A)', '0'], 0],
      ['Expected value of a fair coin flip scored 1 for heads, 0 for tails?', ['0.5', '1', '0', '0.25'], 0],
    ],
  },
  {
    code: 'MA 101', title: 'Linear Algebra',
    board: ['A x = b', 'det(A) ≠ 0 ⇔ A invertible', 'A v = λ v  (eigen pair)'],
    slide: ['Matrices and linear maps', '• Rank and nullity', '• Determinant and inverse', '• Eigenvalues and eigenvectors'],
    qs: [
      ['A square matrix is invertible exactly when…', ['det(A) ≠ 0', 'A is symmetric', 'trace(A) = 0', 'A has a zero row'], 0],
      ['Rank + nullity of an m×n matrix equals…', ['n', 'm', 'm + n', 'm·n'], 0],
      ['Eigenvalues of [[2,0],[0,3]] are…', ['2 and 3', '0 and 5', '1 and 6', '5 and 6'], 0],
      ['The identity matrix has determinant…', ['1', '0', 'n', '−1'], 0],
    ],
  },
  {
    code: 'CS 101', title: 'Introduction to Computing',
    board: ['for i in range(n):', '    total += a[i]', 'O(n) time, O(1) space', 'Binary search: O(log n)'],
    slide: ['Algorithms and complexity', '• Big-O notation', '• Linear vs. binary search', '• Recursion and base cases'],
    qs: [
      ['Binary search on a sorted array of n items takes…', ['O(log n)', 'O(n)', 'O(n log n)', 'O(1)'], 0],
      ['Which structure is First-In, First-Out?', ['Queue', 'Stack', 'Tree', 'Heap'], 0],
      ['A recursive function must have…', ['A base case', 'A loop', 'Two parameters', 'A global variable'], 0],
      ['In Python, len([3, 1, 4]) is…', ['3', '4', '8', '1'], 0],
    ],
  },
  {
    code: 'PH 101', title: 'Physics I: Mechanics',
    board: ['F = m a', 'T = 2π √(L / g)', 'KE = ½ m v²', 'p = m v'],
    slide: ['Newton\'s laws and oscillations', '• Simple pendulum', '• Energy conservation', '• Momentum'],
    qs: [
      ['Period of a simple pendulum depends on…', ['Length and g', 'Mass only', 'Amplitude only', 'Colour of the bob'], 0],
      ['Kinetic energy is…', ['½ m v²', 'm g h', 'm v', 'F / a'], 0],
      ['SI unit of force is the…', ['Newton', 'Joule', 'Watt', 'Pascal'], 0],
      ['Acceleration due to gravity near Earth is about…', ['9.8 m/s²', '1.6 m/s²', '98 m/s²', '0.98 m/s²'], 0],
    ],
  },
  {
    code: 'CH 101', title: 'Chemistry',
    board: ['NaOH + HCl → NaCl + H₂O', 'M₁V₁ = M₂V₂', 'pH = −log[H⁺]'],
    slide: ['Acids, bases and titration', '• Neutralisation', '• Indicators: phenolphthalein', '• Molarity calculations'],
    qs: [
      ['Phenolphthalein turns pink in…', ['Basic solution', 'Acidic solution', 'Pure water', 'Salt water'], 0],
      ['pH of pure water at 25 °C is…', ['7', '0', '14', '1'], 0],
      ['In titration, M₁V₁ = ?', ['M₂V₂', 'M₂/V₂', 'V₁/M₂', '1'], 0],
      ['NaOH + HCl gives NaCl and…', ['H₂O', 'CO₂', 'O₂', 'H₂'], 0],
    ],
  },
  {
    code: 'EE 101', title: 'Electrical Sciences',
    board: ['V = I R', 'P = V I', 'Series: R = R₁ + R₂', 'Parallel: 1/R = 1/R₁ + 1/R₂'],
    slide: ['DC circuits', '• Ohm\'s law', '• Kirchhoff\'s laws', '• Power dissipation'],
    qs: [
      ['Two 10 Ω resistors in series give…', ['20 Ω', '5 Ω', '10 Ω', '100 Ω'], 0],
      ['Two 10 Ω resistors in parallel give…', ['5 Ω', '20 Ω', '10 Ω', '0 Ω'], 0],
      ['Ohm\'s law is…', ['V = I R', 'P = I R', 'V = I / R', 'I = V R'], 0],
      ['Power in a resistor is…', ['V × I', 'V / I', 'I / V', 'V + I'], 0],
    ],
  },
];

export const TRIVIA = [
  ['IIT Guwahati\'s campus is on the north bank of which river?', ['Brahmaputra', 'Ganga', 'Barak', 'Teesta'], 0],
  ['What is IITG\'s cultural festival called?', ['Alcheringa', 'Techniche', 'Spirit', 'Udgam'], 0],
  ['What is IITG\'s techno-management festival called?', ['Techniche', 'Alcheringa', 'Kriti', 'Manthan'], 0],
  ['The IITG hostels are named after…', ['Rivers of the Northeast', 'Mountains', 'Scientists', 'Birds'], 0],
  ['The main auditorium is named after which singer?', ['Dr. Bhupen Hazarika', 'Zubeen Garg', 'Lata Mangeshkar', 'Kishore Kumar'], 0],
  ['IIT Guwahati was established in…', ['1994', '1961', '2008', '1985'], 0],
  ['Which is the largest lake on the IITG campus?', ['Serpentine Lake', 'Dal Lake', 'Chilika', 'Loktak'], 0],
  ['Which gate is near Khokha market?', ['Khokha Gate', 'Main Gate', 'KV Gate', 'Lake Gate'], 0],
  ['What is the traditional Assamese cloth with red borders?', ['Gamosa', 'Pashmina', 'Ikat', 'Phulkari'], 0],
  ['Which hostel is a girls\' hostel?', ['Subansiri', 'Brahmaputra', 'Kameng', 'Barak'], 0],
];

/** Lecture running in a hall at a given time (rotates through the week). */
export function lectureFor(weekday, hour, lm) {
  const slot = Math.max(0, Math.floor(hour) - 9);
  const c = COURSES[(weekday * 3 + slot + (lm === 'academic' ? 2 : 0)) % COURSES.length];
  return { ...c, title: `${c.code}: ${c.title}` };
}

export function shuffleQ(q, rnd = Math.random) {
  const [text, opts, ans] = q;
  const idx = opts.map((_, i) => i).sort(() => rnd() - 0.5);
  return { text, opts: idx.map((i) => opts[i]), ans: idx.indexOf(ans) };
}

export function examPaper(n = 8, rnd = Math.random) {
  const all = COURSES.flatMap((c) => c.qs.map((q) => [...q, c.code]));
  return all.sort(() => rnd() - 0.5).slice(0, n).map((q) => ({ ...shuffleQ(q, rnd), course: q[3] }));
}
