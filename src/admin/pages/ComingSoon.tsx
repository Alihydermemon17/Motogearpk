import type { ReactNode } from 'react';
import { PageHeader } from '../components/ui';

export function ComingSoonPage({
  title,
  description,
  body,
  icon,
}: {
  title: string;
  description: string;
  body: string;
  icon?: ReactNode;
}) {
  return (
    <div className="adm-page">
      <PageHeader crumb="System / Coming soon" title={title} description={description} />
      <div className="adm-coming-soon">
        <span className="adm-coming-icon" aria-hidden="true">{icon}</span>
        <h2>{title} is not connected</h2>
        <p>{body}</p>
        <span className="adm-pill adm-pill--grey">Coming soon</span>
      </div>
    </div>
  );
}
