// Question-cluster content for the analysis screen. Ported verbatim from
// prototype-analysis.jsx. Stable ids let a star/done toggle persist across
// the 5 / 1 / combined views.

export const Q = {
  thermo5: { id: "thermo5", topic: "Thermodynamics", marks: "5 marks", appears: 6, variants: 7,
    q: "State the first law of thermodynamics and use it to derive an expression for the work done by an ideal gas during an isothermal expansion.",
    similars: [
      { src: "2023 · Q5", text: "Derive the relation Cp − Cv = R between the two principal specific heats of an ideal gas." },
      { src: "2022 · Q4", starred: true, text: "A gas absorbs 250 J of heat and performs 80 J of work. Calculate the change in its internal energy." },
      { src: "2021 · Q5", text: "Distinguish between isothermal and adiabatic processes and compare the work done in each." },
      { src: "2019 · Q6", text: "State the first law of thermodynamics and apply it to an isochoric process." }] },
  optics5: { id: "optics5", topic: "Optics", marks: "5 marks", appears: 4, variants: 4,
    q: "Derive the lens maker's formula for a thin convex lens, clearly stating the assumptions made.",
    similars: [
      { src: "2023 · Q7", text: "Using the lens maker's formula, find the focal length of a biconvex lens of radii 20 cm each." },
      { src: "2021 · Q8", text: "Define the power of a lens and derive its relation to focal length." },
      { src: "2019 · Q7", text: "Derive the thin-lens equation 1/v − 1/u = 1/f from refraction at curved surfaces." }] },
  mech5: { id: "mech5", topic: "Mechanics", marks: "5 marks", appears: 3, variants: 2,
    q: "A projectile is fired at 30° above the horizontal at 20 m/s. Derive expressions for its time of flight, maximum height and range.",
    similars: [
      { src: "2022 · Q3", text: "Show that the trajectory of a projectile is parabolic and obtain an expression for its range." },
      { src: "2020 · Q4", text: "A ball is thrown at 25 m/s at 45° to the horizontal. Calculate its maximum height and range." }] },
  modern5: { id: "modern5", topic: "Modern Physics", marks: "5 marks", unique: true,
    q: "Explain the photoelectric effect and state Einstein's photoelectric equation." },
  units1: { id: "units1", topic: "Units & Measurement", marks: "1 mark", appears: 8, variants: 9,
    q: "Write the SI unit and dimensional formula of pressure.",
    similars: [
      { src: "2023 · Q1", text: "Define one mole of a substance." },
      { src: "2022 · Q1", starred: true, text: "What is the dimensional formula of work?" },
      { src: "2021 · Q2", text: "Name the SI unit of luminous intensity." },
      { src: "2019 · Q1", text: "State the number of base quantities in the SI system." }] },
  thermo1: { id: "thermo1", topic: "Thermodynamics", marks: "1 mark", appears: 6, variants: 5,
    q: "State the zeroth law of thermodynamics.",
    similars: [
      { src: "2023 · Q3", text: "Define an adiabatic process." },
      { src: "2021 · Q4", text: "What is meant by an isothermal process?" },
      { src: "2020 · Q2", text: "Define the specific heat capacity of a gas at constant volume." }] },
  current1: { id: "current1", topic: "Current Electricity", marks: "1 mark", appears: 4, variants: 3,
    q: "Define resistivity and state its SI unit.",
    similars: [
      { src: "2022 · Q6", text: "State Ohm's law." },
      { src: "2019 · Q5", text: "Define the drift velocity of electrons in a conductor." }] },
  semi1: { id: "semi1", topic: "Semiconductors", marks: "1 mark", unique: true,
    q: "What is meant by a doped semiconductor?" },
};

export const MODES = {
  "5": { blurb: "Long-answer 5-mark clusters — strongest (most-repeated) sit on top.", ranked: ["thermo5", "optics5", "mech5"], unique: ["modern5"] },
  "1": { blurb: "Quick 1-mark clusters — definitions, facts and objectives.", ranked: ["units1", "thermo1", "current1"], unique: ["semi1"] },
  combined: { blurb: "Everything together — ranked by repetition × number of variants.", ranked: ["units1", "thermo5", "optics5"], unique: ["modern5"] },
};

export const DEFAULT_DONE = new Set(["optics5", "units1"]);
export const DEFAULT_STAR = new Set(["thermo5", "thermo1"]);
