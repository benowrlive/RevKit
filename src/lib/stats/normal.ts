// src/lib/stats/normal.ts — Normal & chi-squared distribution primitives.
// Pure TypeScript, no external deps. Client-side safe.

const SQRT_2PI = Math.sqrt(2 * Math.PI);

/**
 * Standard normal probability density function φ(x).
 */
export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/**
 * Standard normal cumulative distribution function Φ(x).
 *
 * Uses the Abramowitz & Stegun 7.1.26 polynomial approximation (max error < 7.5e-8).
 * For x < 0 we use the symmetry Φ(-x) = 1 - Φ(x).
 */
export function normalCdf(x: number): number {
  // A&S 7.1.26 coefficients.
  const a1 = 0.31938153;
  const a2 = -0.356563782;
  const a3 = 1.781477937;
  const a4 = -1.821255978;
  const a5 = 1.330274429;
  const p = 0.2316419;

  const z = Math.abs(x);
  const t = 1 / (1 + p * z);
  const pdf = normalPdf(z);
  // Φ(|x|) approximation.
  const cdfPos = 1 - pdf * (a1 * t + a2 * t ** 2 + a3 * t ** 3 + a4 * t ** 4 + a5 * t ** 5);
  return x < 0 ? 1 - cdfPos : cdfPos;
}

/**
 * Inverse standard normal CDF (quantile function) Φ⁻¹(p) for p ∈ (0, 1).
 *
 * Uses Peter Acklam's algorithm (relative error < 1.15e-9 across the central region,
 * and well-behaved in the tails via the rational tail approximation).
 */
export function normalInverseCdf(p: number): number {
  if (Number.isNaN(p) || p < 0 || p > 1) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;

  // Rational coefficients (Acklam).
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.38357751867269e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    // Lower tail (p near 0).
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      (((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1))
    );
  }
  if (p <= pHigh) {
    // Central region.
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
      ((((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1))
    );
  }
  // Upper tail (p near 1).
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return (
    -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

/**
 * Two-sided z multiplier for a given confidence level.
 * E.g. confidence = 0.95 → 1.959963984540054 (the 0.975 quantile).
 */
export function zForConfidence(confidence: number): number {
  if (confidence <= 0 || confidence >= 1) return NaN;
  return normalInverseCdf(0.5 + confidence / 2);
}

/**
 * Lanczos approximation to ln(Γ(x)).
 */
function gammaln(xx: number): number {
  const cof = [
    76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 1.208650973866179e-3, -5.395239384953e-6,
  ];
  let x = xx;
  let y = xx;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += cof[j] / y;
  }
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

/**
 * Regularized lower incomplete gamma function P(a, x) = γ(a, x) / Γ(a).
 *
 * Implementation follows Numerical Recipes: series expansion for x < a + 1
 * (faster convergence near zero) and continued fraction for x ≥ a + 1 (computes
 * the upper regularized gamma Q then inverts).
 *
 * Signature order is gammainc(x, a) to match the spec.
 */
export function gammainc(x: number, a: number): number {
  if (x < 0 || a <= 0) return NaN;
  if (x === 0) return 0;
  const gln = gammaln(a);

  if (x < a + 1) {
    // Series: γ(a,x) = x^a · e^-x · Σ_{n=0..} x^n / (a(a+1)...(a+n))
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 0; n < 1000; n++) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }

  // Continued fraction (Lentz's method) for Q(a, x) = Γ(a,x)/Γ(a) = 1 - P(a, x).
  const fpmin = 1e-300;
  let b = x + 1 - a;
  let c = 1 / fpmin;
  let dVal = 1 / b;
  let h = dVal;
  for (let i = 1; i <= 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    dVal = an * dVal + b;
    if (Math.abs(dVal) < fpmin) dVal = fpmin;
    c = b + an / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    dVal = 1 / dVal;
    const del = dVal * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-15) break;
  }
  const q = Math.exp(-x + a * Math.log(x) - gln) * h;
  return 1 - q;
}

/**
 * Chi-squared CDF for df degrees of freedom: P(X ≤ x) = P(df/2, x/2).
 */
export function chiSqCdf(x: number, df: number): number {
  if (df <= 0) return NaN;
  if (x <= 0) return 0;
  return gammainc(x / 2, df / 2);
}

/**
 * Upper-tail chi-squared p-value: P(X ≥ x) = 1 - chiSqCdf(x, df).
 */
export function chiSqPValue(x: number, df: number): number {
  return 1 - chiSqCdf(x, df);
}
