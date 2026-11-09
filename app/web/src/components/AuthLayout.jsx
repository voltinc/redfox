import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { Logo, LogoMark } from '../components/Brand.jsx';

const PROOF = [
  'Real builds with live logs and rollbacks',
  'A database, repository and URL per project',
  'Encrypted configuration and an audit trail',
];

export default function AuthLayout({ title, subtitle, children, footer, wide = false }) {
  return (
    <div className="[&>*]:min-w-0 grid min-h-screen overflow-x-hidden bg-base lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="focus-ring rounded-md" aria-label="Redfox home">
            <Logo size={26} />
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-[11.5px] text-dim transition-colors hover:text-fg">
            <ArrowLeft size={12} /> Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className={wide ? 'w-full max-w-[420px]' : 'w-full max-w-[368px]'}>
            <h1 className="display text-[30px] text-fg sm:text-[34px]">{title}</h1>
            {subtitle ? <p className="mt-2 max-w-[38ch] text-[13px] leading-6 text-muted">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
            {footer ? <div className="mt-6 border-t border-line pt-4 text-[12px] text-muted">{footer}</div> : null}
          </div>
        </div>

        <p className="text-[10.5px] text-dim">redfox 0.9.0 · self-hosted developer cloud · MIT licensed</p>
      </div>

      <aside className="relative hidden overflow-hidden border-l border-line bg-[#fffaf1] lg:block">
        <div className="pointer-events-none absolute inset-0 hatch" aria-hidden="true" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <LogoMark size={34} />
          <div>
            <p className="display max-w-[360px] text-[26px] leading-[1.15] text-fg">
              Everything you deploy needs a place to live. <span className="serif-accent text-accentInk">This is that place.</span>
            </p>
            <ul className="mt-5 space-y-2.5">
              {PROOF.map((item) => (
                <li key={item} className="flex items-start gap-2 text-[12px] leading-5 text-muted">
                  <Check size={13} className="mt-0.5 shrink-0 text-success" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <figure className="overflow-hidden rounded-xl border border-line-strong bg-panel raised-shadow">
            <img src="/product/solene.png" alt="The Redfox console" className="block w-full" loading="lazy" />
          </figure>
        </div>
      </aside>
    </div>
  );
}
