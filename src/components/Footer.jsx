import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-16 border-t border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm sm:px-6 md:flex-row md:items-center md:justify-between">
        <p className="muted max-w-2xl">
          MedEasy is an educational decision-support tool, not a medical device. Results and risk estimates
          must be reviewed with a qualified doctor.
        </p>
        <div className="flex gap-4 faint">
          <Link to="/analyze" className="hover:text-[var(--ink)]">Analyze</Link>
          <Link to="/models" className="hover:text-[var(--ink)]">Model performance</Link>
        </div>
      </div>
    </footer>
  );
}
