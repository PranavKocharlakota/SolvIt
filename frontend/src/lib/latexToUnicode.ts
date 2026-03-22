/** Convert common LaTeX math expressions to readable Unicode strings. */

const SUPER: Record<string, string> = {
  '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
  'n':'ⁿ','i':'ⁱ','a':'ᵃ','b':'ᵇ','c':'ᶜ','d':'ᵈ','e':'ᵉ','f':'ᶠ','g':'ᵍ',
  'h':'ʰ','j':'ʲ','k':'ᵏ','l':'ˡ','m':'ᵐ','o':'ᵒ','p':'ᵖ','r':'ʳ','s':'ˢ',
  't':'ᵗ','u':'ᵘ','v':'ᵛ','w':'ʷ','x':'ˣ','y':'ʸ','z':'ᶻ',
  '+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾',
};

const SUB: Record<string, string> = {
  '0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉',
  'a':'ₐ','e':'ₑ','i':'ᵢ','j':'ⱼ','k':'ₖ','l':'ₗ','m':'ₘ','n':'ₙ','o':'ₒ',
  'p':'ₚ','r':'ᵣ','s':'ₛ','t':'ₜ','u':'ᵤ','v':'ᵥ','x':'ₓ',
  '+':'₊','-':'₋','=':'₌','(':'₍',')':'₎',
};

const GREEK: Record<string, string> = {
  alpha:'α', beta:'β', gamma:'γ', delta:'δ', epsilon:'ε', zeta:'ζ', eta:'η',
  theta:'θ', iota:'ι', kappa:'κ', lambda:'λ', mu:'μ', nu:'ν', xi:'ξ',
  pi:'π', rho:'ρ', sigma:'σ', tau:'τ', upsilon:'υ', phi:'φ', chi:'χ',
  psi:'ψ', omega:'ω',
  Alpha:'Α', Beta:'Β', Gamma:'Γ', Delta:'Δ', Epsilon:'Ε', Zeta:'Ζ', Eta:'Η',
  Theta:'Θ', Iota:'Ι', Kappa:'Κ', Lambda:'Λ', Mu:'Μ', Nu:'Ν', Xi:'Ξ',
  Pi:'Π', Rho:'Ρ', Sigma:'Σ', Tau:'Τ', Upsilon:'Υ', Phi:'Φ', Chi:'Χ',
  Psi:'Ψ', Omega:'Ω',
};

const SYMBOLS: Record<string, string> = {
  times:'×', div:'÷', pm:'±', mp:'∓', cdot:'·', cdots:'⋯', ldots:'…',
  leq:'≤', geq:'≥', neq:'≠', le:'≤', ge:'≥', ne:'≠',
  approx:'≈', equiv:'≡', sim:'∼', propto:'∝',
  infty:'∞', partial:'∂', nabla:'∇',
  int:'∫', oint:'∮', iint:'∬', sum:'∑', prod:'∏',
  in:'∈', notin:'∉', subset:'⊂', supset:'⊃', subseteq:'⊆', supseteq:'⊇',
  cup:'∪', cap:'∩', emptyset:'∅', varnothing:'∅',
  forall:'∀', exists:'∃', nexists:'∄',
  to:'→', rightarrow:'→', leftarrow:'←', leftrightarrow:'↔',
  Rightarrow:'⇒', Leftarrow:'⇐', Leftrightarrow:'⇔',
  uparrow:'↑', downarrow:'↓',
  circ:'∘', oplus:'⊕', otimes:'⊗',
  lfloor:'⌊', rfloor:'⌋', lceil:'⌈', rceil:'⌉',
};

function toSuperscript(s: string): string {
  return s.split('').map(c => SUPER[c] ?? c).join('');
}

function toSubscript(s: string): string {
  return s.split('').map(c => SUB[c] ?? c).join('');
}

export function latexToUnicode(latex: string): string {
  let s = latex.trim();

  // Strip display math delimiters
  s = s.replace(/^\$\$|\$\$$/g, '').replace(/^\$|\$$/g, '').trim();

  // \frac{a}{b} → (a)/(b), handle nested
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');
  }

  // \sqrt[n]{x} and \sqrt{x}
  s = s.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, (_, n, x) => `${toSuperscript(n)}√(${x})`);
  s = s.replace(/\\sqrt\{([^}]+)\}/g, (_, x) => `√(${x})`);
  s = s.replace(/\\sqrt\s/g, '√');

  // Superscripts: ^{...} and ^x
  s = s.replace(/\^\{([^}]+)\}/g, (_, e) => toSuperscript(e));
  s = s.replace(/\^(-?\d+|[a-zA-Z])/g, (_, c) => toSuperscript(c));

  // Subscripts: _{...} and _x
  s = s.replace(/_\{([^}]+)\}/g, (_, e) => toSubscript(e));
  s = s.replace(/_(-?\d+|[a-zA-Z])/g, (_, c) => toSubscript(c));

  // Greek letters
  for (const [name, sym] of Object.entries(GREEK)) {
    s = s.replace(new RegExp(`\\\\${name}(?![a-zA-Z])`, 'g'), sym);
  }

  // Math symbols (longest first to avoid partial matches)
  const sorted = Object.entries(SYMBOLS).sort((a, b) => b[0].length - a[0].length);
  for (const [name, sym] of sorted) {
    s = s.replace(new RegExp(`\\\\${name}(?![a-zA-Z])`, 'g'), sym);
  }

  // \left( \right) etc.
  s = s.replace(/\\left\s*\(/g, '(').replace(/\\right\s*\)/g, ')');
  s = s.replace(/\\left\s*\[/g, '[').replace(/\\right\s*\]/g, ']');
  s = s.replace(/\\left\s*\{/g, '{').replace(/\\right\s*\}/g, '}');
  s = s.replace(/\\left\s*\|/g, '|').replace(/\\right\s*\|/g, '|');

  // Remove remaining unknown commands
  s = s.replace(/\\[a-zA-Z]+/g, '');

  // Remove bare braces
  s = s.replace(/[{}]/g, '');

  // Normalize whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}
