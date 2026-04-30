import Link from "next/link";

interface Article {
  title: string;
  authors?: string;
  source: string;
  year?: string;
  url: string;
  blurb: string;
  type: "Peer-reviewed" | "Industry guide" | "Industry blog";
}

const BATTERY_ARTICLES: Article[] = [
  {
    title: "Battery Temperature Compensation — Ultimate Guide",
    source: "PowMr",
    url: "https://powmr.com/blogs/news/battery-temperature-compensation",
    type: "Industry guide",
    blurb:
      "Practitioner reference on how ambient temperature shifts a battery's optimal charging voltage. Includes compensation charts for lead-acid and lithium chemistries and explains why uncompensated charging at high temperatures accelerates degradation.",
  },
  {
    title:
      "Novel cell screening and prognosing based on neurocomputing-based multiday-ahead time-series forecasting for predictive maintenance of battery modules in frequency regulation–energy storage systems",
    authors: "Lin & Shen",
    source: "Applied Energy",
    year: "2023",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S0306261923013090",
    type: "Peer-reviewed",
    blurb:
      "Predictive-maintenance framework for grid-scale battery modules used in frequency regulation. Demonstrates that operating-condition signals (including thermal stress) drive cell-level degradation that can be forecast multiple days ahead — directly motivating thermally-aware dispatch.",
  },
];

const CONSUMPTION_ARTICLES: Article[] = [
  {
    title: "How Does Weather Affect Energy Consumption Behaviour?",
    source: "Montel Energy",
    url: "https://montel.energy/resources/blog/how-does-weather-affect-energy-consumption-behaviour",
    type: "Industry blog",
    blurb:
      "Walks through the practical and behavioural channels by which weather drives load: heating/cooling demand, humidity, daylight hours, and habit-driven consumption. Useful framing for why weather features belong in a day-ahead price forecaster.",
  },
  {
    title:
      "Extreme temperatures and residential electricity consumption: Evidence from Chinese households",
    authors: "Zhang, Guo, Smyth & Yao",
    source: "Energy Economics, vol. 107",
    year: "2022",
    url: "https://www.sciencedirect.com/science/article/abs/pii/S014098832200072X",
    type: "Peer-reviewed",
    blurb:
      "Causal estimates from the China Residential Energy Consumption Survey (CRECS) showing that extreme heat and cold meaningfully raise household electricity demand. Empirical anchor for treating temperature as a first-order driver of load — and, in turn, day-ahead prices.",
  },
];

const TYPE_BADGE: Record<Article["type"], string> = {
  "Peer-reviewed":
    "bg-accent-electric/10 text-accent-electric border-accent-electric/40",
  "Industry guide":
    "bg-accent-green/10 text-accent-green border-accent-green/40",
  "Industry blog":
    "bg-accent-amber/10 text-accent-amber border-accent-amber/40",
};

function ArticleCard({ a }: { a: Article }) {
  return (
    <a
      href={a.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card block group hover:border-accent-electric/60 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold uppercase tracking-widest ${TYPE_BADGE[a.type]}`}
        >
          {a.type}
        </span>
        <span
          aria-hidden
          className="text-slate-500 group-hover:text-accent-electric transition-colors text-sm"
        >
          ↗
        </span>
      </div>

      <h3 className="mt-3 text-base md:text-lg font-semibold text-navy-950 leading-snug tracking-tight group-hover:text-accent-electric transition-colors">
        {a.title}
      </h3>

      <p className="mt-1 text-xs font-mono text-slate-600">
        {a.authors ? `${a.authors} · ` : ""}
        {a.source}
        {a.year ? ` · ${a.year}` : ""}
      </p>

      <p className="mt-3 text-sm text-slate-700 leading-relaxed">{a.blurb}</p>
    </a>
  );
}

function Section({
  eyebrow,
  title,
  intro,
  articles,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  articles: Article[];
}) {
  return (
    <section className="mt-10">
      <div className="mb-5">
        <div className="text-xs uppercase tracking-[0.18em] text-accent-electric font-semibold">
          {eyebrow}
        </div>
        <h2 className="mt-1 text-2xl md:text-3xl font-semibold text-navy-950 tracking-tight">
          {title}
        </h2>
        <p className="mt-2 text-sm text-slate-700 leading-relaxed max-w-3xl">
          {intro}
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {articles.map((a) => (
          <ArticleCard key={a.url} a={a} />
        ))}
      </div>
    </section>
  );
}

export default function ResearchPage() {
  return (
    <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-navy-700 pb-5 mb-6">
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent-electric to-accent-neon shadow-glow grid place-items-center text-white font-black text-lg"
          >
            Δ
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-navy-950 tracking-tight">
              Delphi Prediction · Research
            </h1>
            <p className="text-xs text-slate-600 font-mono">
              Why temperature belongs in a price-and-dispatch model
            </p>
          </div>
        </div>

        <Link
          href="/"
          className="rounded-xl px-5 py-2.5 text-sm font-semibold transition-all bg-accent-electric text-white shadow-glow hover:bg-accent-neon"
        >
          ← Back to dashboard
        </Link>
      </header>

      <section className="card">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-700 font-semibold">
          Thesis
        </div>
        <p className="mt-2 text-base md:text-lg text-navy-950 leading-relaxed max-w-3xl">
          Temperature shows up <strong>twice</strong> in a battery
          optimizer&apos;s economics: it changes how much energy the grid
          consumes (driving prices), and it changes how hard the battery
          itself can push and how quickly it degrades (capping revenue
          capture). Modelling either side alone leaves money — and asset
          life — on the table. The literature below grounds both halves of
          that claim.
        </p>
      </section>

      <Section
        eyebrow="Side A · the battery"
        title="Temperature affects battery performance and life"
        intro="Cell electrochemistry is temperature-dependent. High temperatures accelerate degradation and shift safe operating windows; cold temperatures cut available power. Both ends of the curve push back on a naively-aggressive dispatch schedule."
        articles={BATTERY_ARTICLES}
      />

      <Section
        eyebrow="Side B · the market"
        title="Temperature affects electricity consumption"
        intro="Household and commercial load track temperature through heating, cooling, and behavioural channels — and load drives day-ahead prices. Treating weather as an exogenous input to the price forecaster captures most of the systematic variation a battery operator can trade against."
        articles={CONSUMPTION_ARTICLES}
      />

      <section className="mt-10 card">
        <div className="text-xs uppercase tracking-[0.18em] text-slate-700 font-semibold">
          How Delphi uses this
        </div>
        <ul className="mt-3 space-y-2 text-sm text-slate-700 leading-relaxed">
          <li>
            <strong className="text-navy-950">Forecaster.</strong> Athens
            temperature, wind speed, cloud cover, and shortwave radiation are
            features in the implemented price forecaster. In code today that is
            a scikit-learn `HistGradientBoostingRegressor` quantile setup when
            available, or a ridge-plus-empirical-quantile fallback otherwise.
          </li>
          <li>
            <strong className="text-navy-950">Thermal envelope.</strong>{" "}
            Per-period maximum charge and discharge MW are derated by 1% per
            °C above 25°C — operationalising the battery-side evidence above.
          </li>
          <li>
            <strong className="text-navy-950">Optimizer.</strong> The MILP
            schedule respects both signals jointly, so the dispatch never
            promises power the cells can&apos;t deliver on a hot afternoon
            and never ignores a price spike that the weather forecast already
            implied.
          </li>
          <li>
            <strong className="text-navy-950">Reference markets.</strong> The
            dashboard also shows CAISO, OMIE, and Germany as reference markets.
            In the current code they are part of the ingestion/provenance story
            and UI context; they are not direct evidence of cross-market price
            training.
          </li>
        </ul>
      </section>

      <footer className="mt-8 text-center text-[11px] text-slate-600 font-mono">
        Sources are linked above · open access status varies by publisher
      </footer>
    </main>
  );
}
